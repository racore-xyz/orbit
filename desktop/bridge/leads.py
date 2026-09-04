# -*- coding: utf-8 -*-
"""
Lead Finder — structured people/company records from Agent Reach (Exa).

Fetches up to `target` deduplicated results by fanning the query out over
region/role variants (Exa returns at most 100 per call), then parses each hit
into a lead row: name, headline, company, industry, employees, growth, revenue,
funding, founded, HQ, location, homepage, LinkedIn URL, performance notes.

Email policy (see AGENT_REACH_INTEGRATION.md): `enrich` reads the company's
own website through Agent Reach's web channel (Jina Reader) and records only
addresses the company itself publishes, tagged by role (sales, marketing,
info, press, support, careers, named) with the page they came from. Personal
mailboxes are never harvested.

This module is concatenated into search.py at build time by the Rust side
(see src-tauri/src/lib.rs), so it may reference helpers defined there:
now(), which(), run(), domain(), parse_exa_text(), ch_exa().
"""
import json
import os
import re
import urllib.parse
import urllib.request
import hashlib
import sys
import time
from datetime import datetime

REGIONS = ["", "Egypt", "Saudi Arabia", "UAE Dubai", "Qatar", "Jordan", "Morocco", "Kuwait", "Oman", "Bahrain", "Lebanon", "Tunisia", "Algeria", "Iraq", "Turkey", "Pakistan", "India", "Nigeria", "Kenya", "United Kingdom", "Germany", "France", "United States", "Canada", "Singapore", "Indonesia", "Brazil", "Mexico", "Spain", "Netherlands"]
ANGLES = ["linkedin profile", "founder CEO linkedin", "company linkedin", "startup founder", "entrepreneur", "small business owner", "co-founder", "managing director", "CEO", "head of"]
# Market Research fans out over market-intelligence angles instead of people angles.
ANGLES_RESEARCH = ["companies", "startups list", "market size report", "competitors", "news 2026", "funding round", "industry analysis", "top players", "market trends", "case study"]


def favicon_for(url):
    """Display icon for a source domain (icon CDN, not a data source)."""
    d = domain(url)
    return f"https://icons.duckduckgo.com/ip3/{d}.ico" if d else None


def kind_of(url, raw):
    if "/in/" in url and "linkedin.com" in url:
        return "person"
    if "linkedin.com/company" in url or re.search(r" is an? [^.\n]+? company\.", raw or ""):
        return "company"
    if any(x in url for x in ("/news", "/article", "/blog", "/press", "/report", "/insights")):
        return "article"
    return "page"
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
EMAIL_ROLES = {
    "sales": ("sales", "business", "bd", "partnership", "commercial"),
    "marketing": ("marketing", "growth", "press", "media", "pr@", "comms"),
    "executive": ("ceo", "founder", "cto", "coo", "cfo", "director", "md@", "chairman", "president"),
    "support": ("support", "help", "care", "service"),
    "careers": ("career", "jobs", "hr@", "recruit", "talent"),
    "general": ("info", "hello", "contact", "office", "admin", "team", "mail@"),
}
PERSONAL_DOMAINS = ("gmail.", "yahoo.", "hotmail.", "outlook.", "icloud.", "proton.", "live.", "aol.")


def _first(pattern, text, flags=re.I | re.S, group=1):
    m = re.search(pattern, text, flags)
    return m.group(group).strip() if m else None


def parse_lead(hit):
    """Turn one Exa hit (from parse_exa_text) into a structured lead row."""
    raw = hit.get("snippet_full") or hit.get("snippet") or ""
    url = hit["url"]
    is_person = "/in/" in url
    lines = [l.strip() for l in raw.split(" … ") if l.strip() and not l.strip().startswith("#")]
    headline = lines[0] if lines else ""
    title = hit.get("title", "").strip()
    person_name = re.split(r"\s+[-|–]\s+", title)[0].strip() if is_person else ""
    location = _first(r"([A-Z][^…]{2,60}\(([A-Z]{2})\))", raw) or _first(r"Headquartered in ([^.]+)\.", raw)
    company = None
    m = re.search(r"### [^\-\n]+ - \[([^\]]+)\]\([^)]+\) \(Current\)", raw) or re.search(r"### [^\-\n]+ - ([^\n(]+?) \(Current\)", raw)
    if m:
        company = m.group(1).strip()
    if not company:
        m = re.search(r"(?:at|@)\s+([A-Z][\w&.\- ]{1,50}?)(?:\s*[|·,]|$)", headline)
        company = m.group(1).strip() if m else None
    if not company and not is_person:
        company = hit.get("title", "").split(" | ")[0].split(" - ")[0].strip()
    # Company facts sentence: "<X> is a <Industry> company. ... has 10-20 employees (+20% YoY) ..."
    facts = _first(r"([A-Z][^.\n]{0,80} is an? [^.\n]+? company\.[^#]*?)(?:\n|$)", raw) or ""
    industry = _first(r" is an? ([^.\n]+?) company\.", facts or raw)
    employees = _first(r"(?:has|employs) (\d[\d,\-–+ ]*\s*(?:employees|people))", raw)
    growth = _first(r"\(([+\-]?\d[\d.\-–]*%?\s*YoY[^)]*|less than 1% YoY growth)\)", raw)
    revenue = _first(r"annual revenue in the ([^ ]+) range", raw)
    funding = _first(r"Has (\$[\d.,]+[KMB]?) in total funding", raw)
    rounds = _first(r"with (\d+) prior funding rounds?", raw)
    founded = _first(r"founded in (\d{4})", raw)
    hq = _first(r"Headquartered in ([^.]+)\.", raw)
    homepage = _first(r"Homepage: ([^\s]+)", raw) or _first(r"Website: ([^\s]+)", raw)
    if not homepage:
        m2 = re.search(r"### [^\-\n]+ - \[[^\]]+\]\((https?://[^)]+)\) \(Current\)", raw)
        if m2 and "linkedin.com" not in m2.group(1):
            homepage = m2.group(1)
    workforce = _first(r"(Its workforce is distributed across [^.]+\.)", raw)
    role_dept = _first(r"Department: ([^•\n]+)", raw)
    level = _first(r"Level: ([^\n…]+)", raw)
    emails = sorted(set(e.lower() for e in EMAIL_RE.findall(raw)))
    perf = "; ".join(x for x in [
        f"employees {employees}" if employees else None,
        f"growth {growth}" if growth else None,
        f"revenue {revenue}" if revenue else None,
        f"funding {funding}" + (f" over {rounds} rounds" if rounds else "") if funding else None,
        f"founded {founded}" if founded else None,
        workforce,
    ] if x)
    return {
        "id": "ORB-" + hashlib.sha1(url.split("?")[0].rstrip("/").lower().encode()).hexdigest()[:8].upper(),
        "name": person_name if is_person else (hit.get("author") or ""),
        "headline": headline[:200],
        "role_department": role_dept,
        "level": level,
        "company": company,
        "company_url": url if not is_person else None,
        "homepage": homepage,
        "industry": industry,
        "employees": employees,
        "employee_growth": growth,
        "revenue_range": revenue,
        "total_funding": funding,
        "funding_rounds": rounds,
        "founded": founded,
        "headquarters": hq,
        "location": location,
        "linkedin_url": url if "linkedin.com" in url else None,
        "source_url": url,
        "emails": [{"email": e, "role": classify_email(e), "source": url, "consent": "published-on-profile"} for e in emails],
        "performance": perf,
        "notes": facts.strip()[:600] or raw[:600],
        "published": hit.get("published"),
        "kind": kind_of(url, raw),
        "favicon": favicon_for(url),
        "logo": None,
        "title": title,
        "channel": "exa",
        "fetched_at": hit.get("fetched_at"),
    }


def classify_email(e):
    local = e.split("@")[0].lower()
    for role, keys in EMAIL_ROLES.items():
        for k in keys:
            k2 = k.rstrip("@")
            if local == k2 or local.startswith((k2 + ".", k2 + "-", k2 + "_")) or (len(k2) >= 4 and k2 in local):
                return role
    return "named"


def exa_full(q, n):
    """Like ch_exa but keeps the full highlight text for parsing."""
    hits = ch_exa(q, n)
    return hits


def emit_line(obj):
    """NDJSON event for the streaming mode (Rust forwards each line as a Tauri event)."""
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def find_leads(query, target=1000, max_calls=40, angles=None, emit=None):
    seen, leads, calls = set(), [], []
    variants = []
    for region in REGIONS:
        for angle in (angles or ANGLES):
            variants.append(" ".join(x for x in [query, region, angle] if x))
    plan = variants[:max_calls]
    if emit:
        emit({"type": "start", "query": query, "target": target, "planned_calls": len(plan), "percent": 0})
    for i, v in enumerate(plan):
        if len(leads) >= target:
            break
        if emit:
            emit({"type": "call", "index": i + 1, "planned_calls": len(plan), "query": v, "count": len(leads), "target": target, "percent": _percent(len(leads), target, i, len(plan))})
        try:
            hits = ch_exa(v, 100)
            batch = []
            for h in hits:
                key = h["url"].split("?")[0].rstrip("/").lower()
                if key in seen:
                    continue
                seen.add(key)
                lead = parse_lead(h)
                leads.append(lead)
                batch.append(lead)
            calls.append({"query": v, "returned": len(hits), "new": len(batch)})
            if emit:
                emit({"type": "batch", "index": i + 1, "planned_calls": len(plan), "query": v, "returned": len(hits), "new": len(batch), "count": len(leads), "target": target, "percent": _percent(len(leads), target, i + 1, len(plan)), "leads": batch})
        except Exception as e:  # noqa
            calls.append({"query": v, "error": str(e)[:200]})
            if emit:
                emit({"type": "error", "index": i + 1, "query": v, "error": str(e)[:300], "fatal": "not installed" in str(e) or "not configured" in str(e)})
            if "not installed" in str(e) or "not configured" in str(e):
                break
    return {"query": query, "target": target, "count": len(leads), "calls": calls, "fetched_at": now(), "engine": "agent-reach/exa", "leads": leads}


def _percent(count, target, calls_done, planned):
    """Progress reaches 100 either when the target is met or when the plan is exhausted."""
    a = count / target if target else 1
    b = calls_done / planned if planned else 1
    return int(min(100, round(max(a, b) * 100)))


# ---------------------------------------------------------------- enrichment via Agent Reach web channel (Jina Reader)
def read_page(url, timeout=25):
    req = urllib.request.Request("https://r.jina.ai/" + url, headers={"User-Agent": "orbit-growth-os/0.1", "Accept": "text/plain"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")


SOCIAL = ("linkedin.", "facebook.", "instagram.", "twitter.", "x.com", "youtube.", "whatsapp", "tiktok.", "crunchbase.", "wikipedia.", "glassdoor.", "indeed.")
DOMAIN_RE = re.compile(r"\b((?:[a-z0-9-]+\.)+(?:com|io|ai|co|net|org|app|dev|tech|me|sa|eg|ae|qa|jo|ma|uk|de|fr|ca|in|sg|xyz|so|cloud|digital))\b", re.I)


def company_domain(lead):
    for cand in (lead.get("homepage"), lead.get("company_url")):
        d = domain(cand if (cand or "").startswith("http") else f"https://{cand}" if cand else "")
        if d and not any(s in d for s in SOCIAL):
            return d
    return None


def resolve_homepage(lead):
    """Find the company's own website: first a domain mentioned in the profile text,
    otherwise one Agent Reach (Exa) lookup for '<company> official website'."""
    company = (lead.get("company") or "").strip()
    text = " ".join(x for x in [lead.get("headline"), lead.get("notes"), company] if x)
    for cand in DOMAIN_RE.findall(text):
        c = cand.lower()
        if not any(s in c for s in SOCIAL) and not c.endswith((".png", ".jpg")):
            return c
    if not company or company.lower().startswith("stealth"):
        return None
    try:
        hits = ch_exa(f"{company} official website", 3)
    except Exception:
        return None
    for h in hits:
        d = domain(h["url"])
        if d and not any(s in d for s in SOCIAL):
            return d
    return None


def enrich_lead(lead, max_pages=3):
    d = company_domain(lead)
    if not d:
        d = resolve_homepage(lead)
        if d:
            lead["homepage"] = d
            lead["homepage_source"] = "resolved via Agent Reach/Exa"
    if not d:
        return lead, "no company website"
    found = {e["email"]: e for e in lead.get("emails", [])}
    pages_read = 0
    for path in ("", "/contact", "/about", "/team", "/contact-us"):
        if pages_read >= max_pages:
            break
        url = f"https://{d}{path}"
        try:
            text = read_page(url)
            pages_read += 1
        except Exception:
            continue
        if not lead.get("logo"):
            # Company logo as published on its own site (markdown image from Jina Reader).
            brand = d.split(".")[0].lower()
            cands = [(alt, src) for alt, src in re.findall(r"!\[([^\]]*)\]\((https?://[^)\s]+)\)", text) if "logo" in (alt + src).lower()]
            # Prefer a logo that names the company itself over partner/client logos.
            cands.sort(key=lambda c: 0 if brand and brand in (c[0] + c[1]).lower() else 1)
            if cands:
                lead["logo"] = cands[0][1]
        for e in set(x.lower() for x in EMAIL_RE.findall(text)):
            if any(e.endswith(ext) for ext in (".png", ".jpg", ".svg", ".gif")) or e in found:
                continue
            if any(p in e.split("@")[1] for p in PERSONAL_DOMAINS):
                continue  # published personal mailbox: skip by policy
            found[e] = {"email": e, "role": classify_email(e), "source": url, "consent": "published-by-company"}
        if len(found) >= 8:
            break
    lead["emails"] = list(found.values())
    lead["enriched_at"] = now()
    return lead, f"{pages_read} pages"


MD_IMG = re.compile(r"!\[([^\]]*)\]\((https?://[^)\s]+)\)")


def enrich_photo(lead):
    """Public profile photo / company logo from the lead's own LinkedIn page, read through
    Agent Reach's LinkedIn channel (Jina Reader). LinkedIn sometimes serves a sign-in wall;
    then the lead keeps its initials avatar. Only the image URL is stored, never the file."""
    url = lead.get("linkedin_url")
    if not url or lead.get("photo"):
        return "skip"
    text, err = "", ""
    # LinkedIn serves a sign-in wall at random; Jina Reader usually gets through on a retry.
    for attempt in range(3):
        try:
            text = read_page(url, timeout=30)
            err = ""
        except Exception as e:  # noqa
            err = f"unreadable: {str(e)[:60]}"
            break
        if not (text.lstrip().startswith("Title: Sign Up") or "Agree & Join LinkedIn" in text[:400]):
            break
        err = "login wall"
        time.sleep(1.5 * (attempt + 1))
    if err:
        return err
    imgs = MD_IMG.findall(text)
    name = (lead.get("name") or "").lower()
    if lead.get("kind") == "person":
        pick = [s for a, s in imgs if "profile-displayphoto" in s and name and name.split()[0] in a.lower()] or [s for a, s in imgs if "profile-displayphoto" in s]
    else:
        pick = [s for a, s in imgs if "company-logo" in s] or [s for a, s in imgs if "profile-displayphoto" in s]
    if not pick:
        return "no image"
    lead["photo"] = pick[0]
    lead["photo_source"] = url
    cover = [s for a, s in imgs if "displaybackgroundimage" in s]
    if cover:
        lead["cover"] = cover[0]
    return "ok"


def enrich(leads, limit=50, emit=None):
    out, log = [], []
    todo = min(limit, len(leads))
    if emit:
        emit({"type": "start", "planned": todo, "percent": 0})
    for i, lead in enumerate(leads):
        if i < limit:
            entry = {"name": lead.get("name") or lead.get("company"), "emails": 0, "photo": "skip", "site": "skip"}
            if company_domain(lead) or lead.get("company"):
                lead, note = enrich_lead(lead)
                entry["site"] = note
                entry["emails"] = len(lead.get("emails", []))
            entry["photo"] = enrich_photo(lead)
            log.append(entry)
            if emit:
                emit({"type": "lead", "index": i, "done": i + 1, "planned": todo, "percent": int(round((i + 1) / todo * 100)) if todo else 100, "lead": lead, "log": entry})
        out.append(lead)
    photos = sum(1 for l in out if l.get("photo"))
    return {"count": len(out), "enriched": len(log), "photos": photos, "log": log, "leads": out}


# ---------------------------------------------------------------- export
COLUMNS = ["id", "kind", "name", "title", "headline", "company", "industry", "employees", "employee_growth", "revenue_range", "total_funding", "funding_rounds", "founded", "headquarters", "location", "homepage", "linkedin_url", "sales_emails", "marketing_emails", "executive_emails", "other_emails", "performance", "notes", "source_url", "favicon", "logo", "photo", "cover", "published", "fetched_at"]


def export(leads, name="leads"):
    folder = os.path.join(os.path.expanduser("~"), "Documents", "orbit")
    os.makedirs(folder, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base = os.path.join(folder, f"{name}-{stamp}")
    rows = []
    for l in leads:
        em = l.get("emails", [])
        pick = lambda role: ", ".join(e["email"] for e in em if e["role"] == role)  # noqa
        rows.append({**{k: l.get(k) or "" for k in COLUMNS}, "sales_emails": pick("sales"), "marketing_emails": pick("marketing"), "executive_emails": pick("executive"), "other_emails": ", ".join(e["email"] for e in em if e["role"] not in ("sales", "marketing", "executive"))})
    paths = {}
    with open(base + ".json", "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=1)
    paths["json"] = base + ".json"
    try:
        import openpyxl  # noqa

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Leads"
        ws.append(COLUMNS)
        for r in rows:
            ws.append([r[c] for c in COLUMNS])
        wb.save(base + ".xlsx")
        paths["xlsx"] = base + ".xlsx"
    except Exception:
        import csv

        with open(base + ".csv", "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        paths["csv"] = base + ".csv"
    return {"count": len(leads), "paths": paths}
