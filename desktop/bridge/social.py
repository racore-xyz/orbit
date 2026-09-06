# -*- coding: utf-8 -*-
"""
Social Media channel: Reddit via Arctic Shift (https://arctic-shift.photon-reddit.com/).

Arctic Shift is a public Reddit archive with a search API. Constraints observed on its API:
  - /api/posts/search   needs `subreddit` (or `author`) together with `query`; `after`/`before`
    accept dates; `limit` <= 100; `sort` asc|desc; `sort_type` default|created_utc
  - /api/comments/search needs `subreddit`+`body`, or `link_id` (all comments of a post)
  - /api/subreddits/search  `subreddit_prefix=` for discovery
  - rate limit: "Timeout. Maybe slow down a bit" -> we pace requests and retry with backoff

Output is normalized for the app: posts with permalink, per-month timeline, top subreddits,
top terms, and sample opinions (comments), streamed as NDJSON events.

Usage: main.py reddit-stream <params.json>
  params: {query, subreddits: [..] | [], months: 12, limit_per_sub: 100, discover: true,
           include_comments: true, max_posts_comments: 8}
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta

BASE = "https://arctic-shift.photon-reddit.com/api"
UA = "orbit-growth-os/0.1 (market research; contact via app)"
POST_FIELDS = "id,title,subreddit,score,num_comments,created_utc,selftext,url,author,link_flair_text,over_18"
COMMENT_FIELDS = "id,body,score,created_utc,author,subreddit,link_id,parent_id"

# Default communities for market discovery when the user gives none (business + MENA).
DEFAULT_SUBS = ["startups", "Entrepreneur", "smallbusiness", "SaaS", "fintech", "marketing", "sales", "ecommerce", "growthhacking", "digitalnomad", "Egypt", "saudiarabia", "dubai", "UAE", "Jordan", "Morocco", "Qatar", "Bahrain", "kuwait", "Oman", "askegypt", "Cairo", "Riyadh", "sidehustle", "indiehackers", "EntrepreneurRideAlong", "B2BSaaS", "productmanagement", "freelance", "webdev"]
STOP = set("the a an and or of to in on for with is are was were be been it this that these those i you we they he she at by from as but not no so if then than too very can will just about into over your our their its my me our us them there here what which who how when where why all any more most some such only own same very also would could should may might do does did done have has had get got make made like one two new use used using out up down off".split())

_last = [0.0]


def _get(path, params, retries=5):
    url = f"{BASE}/{path}?" + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "", [])}, doseq=True)
    last_err = "unknown"
    for attempt in range(retries):
        try:
            base_gap = float(os.environ.get("ORBIT_REDDIT_GAP") or 1.2)
        except ValueError:
            base_gap = 1.2
        gap = base_gap - (time.time() - _last[0])
        if gap > 0:
            time.sleep(gap)
        _last[0] = time.time()
        body, status = "", 0
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                status, body = r.status, r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            status = e.code
            try:
                body = e.read().decode("utf-8", "ignore")
            except Exception:
                body = ""
        except Exception as e:  # noqa
            last_err = f"Arctic Shift unreachable: {str(e)[:120]}"
            time.sleep(2 * (attempt + 1))
            continue
        try:
            d = json.loads(body) if body else {}
        except json.JSONDecodeError:
            d = {"error": f"HTTP {status}"}
        err = d.get("error")
        if not err:
            return d.get("data") or []
        low = str(err).lower()
        if "slow down" in low or "timeout" in low or status in (429, 502, 503, 504):
            last_err = f"Arctic Shift busy ({err})"
            time.sleep(4 * (attempt + 1))
            continue
        raise RuntimeError(f"Arctic Shift: {err}")
    raise RuntimeError(last_err)


def permalink(p):
    return f"https://www.reddit.com/r/{p.get('subreddit', '')}/comments/{p.get('id', '')}/"


def norm_post(p):
    ts = int(p.get("created_utc") or 0)
    return {
        "id": p.get("id"), "title": p.get("title", ""), "subreddit": p.get("subreddit", ""), "score": int(p.get("score") or 0),
        "num_comments": int(p.get("num_comments") or 0), "created_utc": ts, "created": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds") if ts else None,
        "month": datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m") if ts else None,
        "text": (p.get("selftext") or "")[:1500], "url": p.get("url"), "permalink": permalink(p), "author": p.get("author"),
        "upvote_ratio": p.get("upvote_ratio"), "flair": p.get("link_flair_text"), "nsfw": bool(p.get("over_18")),
        "kind": "post", "channel": "reddit/arctic-shift", "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def norm_comment(c):
    ts = int(c.get("created_utc") or 0)
    return {"id": c.get("id"), "body": (c.get("body") or "")[:800], "score": int(c.get("score") or 0), "created": datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds") if ts else None, "author": c.get("author"), "subreddit": c.get("subreddit"), "link_id": (c.get("link_id") or "").replace("t3_", ""), "kind": "comment"}


def top_terms(texts, n=25):
    cnt = Counter()
    for t in texts:
        for w in re.findall(r"[a-zA-Z؀-ۿ][a-zA-Z0-9؀-ۿ\-']{2,}", (t or "").lower()):
            if w not in STOP and not w.isdigit():
                cnt[w] += 1
    return [{"term": w, "count": c} for w, c in cnt.most_common(n)]


def discover_subreddits(query, limit=8):
    found = []
    for token in [query] + [w for w in re.findall(r"[a-zA-Z]{4,}", query)][:3]:
        try:
            for s in _get("subreddits/search", {"subreddit_prefix": token, "limit": 10}):
                subs = s.get("subscribers") or 0
                if not s.get("over18") and subs >= 500:
                    found.append({"name": s.get("display_name"), "subscribers": subs, "title": s.get("title"), "posts": (s.get("_meta") or {}).get("num_posts")})
        except Exception:
            continue
    seen, out = set(), []
    for f in sorted(found, key=lambda x: -(x["subscribers"] or 0)):
        if f["name"] and f["name"].lower() not in seen:
            seen.add(f["name"].lower())
            out.append(f)
    return out[:limit]


def reddit_research(params, emit=None):
    query = (params.get("query") or "").strip()
    if not query:
        raise RuntimeError("empty query")
    months = int(params.get("months") or 12)
    limit = min(100, int(params.get("limit_per_sub") or 100))
    since_dt = datetime.now(timezone.utc) - timedelta(days=30 * months)
    since = since_dt.strftime("%Y-%m-%d")
    since_ts = int(since_dt.timestamp())
    subs = [s.strip().lstrip("r/") for s in (params.get("subreddits") or []) if s.strip()]
    discovered = []
    if params.get("discover", True):
        discovered = discover_subreddits(query)
        for d in discovered:
            if d["name"] not in subs:
                subs.append(d["name"])
    if not subs:
        subs = DEFAULT_SUBS[:12]
    subs = subs[: int(params.get("max_subs") or 14)]
    if emit:
        emit({"type": "start", "query": query, "subreddits": subs, "discovered": discovered, "since": since, "planned_calls": len(subs), "percent": 0})
    posts, seen = [], set()
    per_sub = {}
    for i, sub in enumerate(subs):
        if emit:
            emit({"type": "call", "index": i + 1, "planned_calls": len(subs), "query": f"r/{sub}", "count": len(posts), "percent": int(i / len(subs) * 90)})
        try:
            data = _get("posts/search", {"subreddit": sub, "query": query, "after": since_ts, "limit": limit, "sort": "desc", "fields": POST_FIELDS})
        except Exception as e:  # noqa
            if emit:
                emit({"type": "error", "index": i + 1, "query": f"r/{sub}", "error": str(e)[:200], "fatal": "unreachable" in str(e)})
            if "unreachable" in str(e):
                break
            if "not a valid field" in str(e):
                raise
            continue
        batch = []
        for p in data:
            if p.get("id") in seen or p.get("over_18"):
                continue
            seen.add(p.get("id"))
            n = norm_post(p)
            posts.append(n)
            batch.append(n)
        per_sub[sub] = len(batch)
        if emit:
            emit({"type": "batch", "index": i + 1, "planned_calls": len(subs), "query": f"r/{sub}", "returned": len(data), "new": len(batch), "count": len(posts), "percent": int((i + 1) / len(subs) * 90), "leads": batch})
    # opinions: comments on the top discussed posts
    comments = []
    if params.get("include_comments", True) and posts:
        top = sorted(posts, key=lambda p: (p["num_comments"], p["score"]), reverse=True)[: int(params.get("max_posts_comments") or 8)]
        for j, p in enumerate(top):
            if emit:
                emit({"type": "call", "index": len(subs) + j + 1, "planned_calls": len(subs) + len(top), "query": f"comments on “{p['title'][:50]}”", "count": len(posts), "percent": 90 + int(j / len(top) * 9)})
            try:
                for c in _get("comments/search", {"link_id": p["id"], "limit": 25, "sort": "desc", "fields": COMMENT_FIELDS}):
                    if c.get("body") and c["body"] not in ("[deleted]", "[removed]"):
                        nc = norm_comment(c)
                        nc["post_title"] = p["title"]
                        nc["permalink"] = p["permalink"]
                        comments.append(nc)
            except Exception:
                continue
    # aggregates
    timeline = defaultdict(lambda: {"posts": 0, "comments": 0, "score": 0})
    for p in posts:
        if p["month"]:
            t = timeline[p["month"]]
            t["posts"] += 1
            t["comments"] += p["num_comments"]
            t["score"] += p["score"]
    months_sorted = sorted(timeline)
    tl = [{"month": m, **timeline[m]} for m in months_sorted]
    half = len(tl) // 2 or 1
    recent = sum(x["posts"] for x in tl[half:])
    earlier = sum(x["posts"] for x in tl[:half]) or 1
    trend = round((recent - earlier) / earlier * 100)
    sub_stats = Counter()
    sub_engage = defaultdict(int)
    for p in posts:
        sub_stats[p["subreddit"]] += 1
        sub_engage[p["subreddit"]] += p["num_comments"] + p["score"]
    top_subs = [{"subreddit": s, "posts": n, "engagement": sub_engage[s]} for s, n in sub_stats.most_common(15)]
    result = {
        "query": query, "since": since, "subreddits": subs, "discovered": discovered, "count": len(posts), "comments": len(comments),
        "timeline": tl, "trend_percent": trend, "top_subreddits": top_subs,
        "top_terms": top_terms([p["title"] + " " + p["text"] for p in posts]),
        "top_posts": sorted(posts, key=lambda p: (p["score"] + 2 * p["num_comments"]), reverse=True)[:30],
        "opinions": sorted(comments, key=lambda c: c["score"], reverse=True)[:60],
        "posts": posts, "engine": "arctic-shift", "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    return result


def analysis_prompt(res, language="en"):
    """Prompt for the LLM analysis (run from the app through the configured provider)."""
    sample_posts = "\n".join(f"- [{p['subreddit']} · {p['score']}↑ {p['num_comments']}💬 · {p['month']}] {p['title']} :: {p['text'][:240]}" for p in res["top_posts"][:30])
    sample_ops = "\n".join(f"- ({c['score']}↑, r/{c['subreddit']}) {c['body'][:240]}" for c in res["opinions"][:40])
    tl = ", ".join(f"{x['month']}: {x['posts']} posts" for x in res["timeline"])
    lang = "Arabic" if language == "ar" else "English"
    top_subs = ", ".join("r/%s (%s)" % (s["subreddit"], s["posts"]) for s in res["top_subreddits"][:10])
    top_terms_s = ", ".join(t["term"] for t in res["top_terms"][:20])
    return (
        "You are a market analyst. Analyse Reddit discussion about: \"%s\" (since %s).\n\n" % (res["query"], res["since"])
        + "TIMELINE (posts per month): %s\nTREND (recent half vs earlier half): %s%%\n" % (tl, res["trend_percent"])
        + "TOP SUBREDDITS: %s\n" % top_subs
        + "TOP TERMS: %s\n\nTOP POSTS:\n%s\n\nPEOPLE'S OPINIONS (comments):\n%s\n\n" % (top_terms_s, sample_posts, sample_ops)
        +
        f"Write a Markdown report in {lang} with these sections: 1) Established markets (what people already buy/use, incumbents), "
        f"2) Emerging markets and new niches (what is growing, with evidence from the timeline/terms), 3) Opportunities (concrete gaps, unmet needs, with who has the pain), "
        f"4) What people think (opinions, objections, praise, pricing sensitivity), 5) Pain points ranked, 6) 5 quotable lines with subreddit attribution, "
        f"7) Recommended next actions for a founder or growth team. Be specific, cite subreddits, never invent numbers that are not in the data."
    )
