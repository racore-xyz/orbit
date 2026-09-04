# -*- coding: utf-8 -*-
"""
orbit. research bridge — Agent Reach only.

Every result comes from an Agent Reach channel, invoked exactly the way the
Agent Reach skill documents it (vendor/agent-reach/agent_reach/skill):

  web search  -> Exa via mcporter:  mcporter call exa.web_search_exa query=... numResults=N
  code search -> GitHub via gh CLI: gh search repos "query" --limit N   (optional)

Nothing here scrapes search engines directly and nothing is fabricated: each
item carries its URL, the channel that produced it, and a fetch timestamp.

Usage:
  python search.py search "<query>" [max_results]
  python search.py doctor
  python search.py setup
"""
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

EXA_URL = "https://mcp.exa.ai/mcp"
CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def which(cmd):
    p = shutil.which(cmd)
    if p:
        return p
    if os.name == "nt":
        for ext in (".cmd", ".exe", ".ps1"):
            p = shutil.which(cmd + ext)
            if p:
                return p
    return None


def mcporter_cmd():
    """Command prefix for mcporter. Prefers the bundled Node + mcporter shipped in the installer
    (ORBIT_NODE / ORBIT_MCPORTER_CLI set by the app), then a global `mcporter` on PATH."""
    node, cli = os.environ.get("ORBIT_NODE"), os.environ.get("ORBIT_MCPORTER_CLI")
    if node and cli and os.path.exists(node) and os.path.exists(cli):
        return [node, cli]
    m = which("mcporter")
    return [m] if m else None


def run(args, timeout=60):
    return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout, shell=False, creationflags=CREATE_NO_WINDOW)


def domain(url):
    m = re.match(r"https?://(?:www\.)?([^/]+)", url or "")
    return m.group(1) if m else ""


# ---------------------------------------------------------------- Exa (Agent Reach web search)
def parse_exa_text(text):
    """mcporter renders Exa results as blocks: Title/URL/Published/Author/Highlights."""
    results = []
    for block in re.split(r"(?:^|\n)(?=Title: )", text):
        block = block.strip()
        if not block.startswith("Title:"):
            continue
        fields = {}
        for key in ("Title", "URL", "Published", "Author"):
            m = re.search(rf"^{key}: (.*)$", block, re.M)
            fields[key.lower()] = (m.group(1).strip() if m else "")
        hl = block.split("Highlights:", 1)[1].strip() if "Highlights:" in block else ""
        hl = re.sub(r"\n\.\.\.\n", " … ", hl)
        hl = re.sub(r"\s+", " ", hl)
        if not fields["url"]:
            continue
        results.append(
            {
                "title": fields["title"] or fields["url"],
                "url": fields["url"],
                "snippet": hl[:400],
                "snippet_full": hl[:4000],
                "published": fields["published"] if fields["published"] not in ("", "N/A") else None,
                "author": fields["author"] if fields["author"] not in ("", "N/A") else None,
                "source": domain(fields["url"]),
                "channel": "exa",
                "fetched_at": now(),
            }
        )
    return results


EXA_MIN_GAP = 1.0 if os.environ.get("ORBIT_EXA_KEYED") else 2.5   # seconds between calls (free shared endpoint is stricter)
_exa_last = [0.0]
EXA_LIMIT_MSG = ("Exa rate limit reached on the free shared endpoint. Add your own free Exa API key under Integrations → Agent Reach "
                 "(dashboard.exa.ai/api-keys) for a much higher limit, or wait a few minutes and retry.")


class ExaRateLimit(RuntimeError):
    pass


def ch_exa(q, n):
    """Exa via mcporter, paced and with one backoff retry on HTTP 429."""
    import time as _t
    mcporter = mcporter_cmd()
    if not mcporter:
        raise RuntimeError("mcporter is not installed. Run setup, or: npm i -g mcporter && mcporter config add exa https://mcp.exa.ai/mcp --scope home")
    for attempt in range(2):
        gap = EXA_MIN_GAP - (_t.time() - _exa_last[0])
        if gap > 0:
            _t.sleep(gap)
        _exa_last[0] = _t.time()
        p = run([*mcporter, "call", "exa.web_search_exa", f"query={q}", f"numResults={n}", "--output", "json"], timeout=90)
        if p.returncode == 0:
            break
        err = (p.stderr or p.stdout).strip()
        if "429" in err or "rate limit" in err.lower():
            if attempt == 0:
                _t.sleep(20)
                continue
            raise ExaRateLimit(EXA_LIMIT_MSG)
        if "exa" in err.lower() and ("not found" in err.lower() or "unknown" in err.lower()):
            err = "Exa is not configured in mcporter. Run setup, or: mcporter config add exa https://mcp.exa.ai/mcp --scope home"
        raise RuntimeError(err[-400:] or "mcporter call failed")
    text = ""
    try:
        data = json.loads(p.stdout)
        for c in data.get("content", []):
            if c.get("type") == "text":
                text += c.get("text", "") + "\n"
    except json.JSONDecodeError:
        text = p.stdout
    return parse_exa_text(text)


# ---------------------------------------------------------------- GitHub (Agent Reach code search, optional)
def ch_github(q, n):
    gh = which("gh")
    if not gh:
        raise RuntimeError("gh CLI not installed (optional). Install: https://cli.github.com")
    p = run([gh, "search", "repos", q, "--limit", str(n), "--json", "name,url,description,updatedAt,owner"], timeout=45)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout).strip()[-300:])
    out = []
    for r in json.loads(p.stdout or "[]"):
        out.append(
            {
                "title": r.get("name", ""),
                "url": r.get("url", ""),
                "snippet": (r.get("description") or "")[:400],
                "published": r.get("updatedAt"),
                "author": (r.get("owner") or {}).get("login"),
                "source": "github.com",
                "channel": "github",
                "fetched_at": now(),
            }
        )
    return out


CHANNELS = [("exa", ch_exa, True), ("github", ch_github, False)]


def search(q, n=10):
    channels, results, seen = [], [], set()
    for name, fn, required in CHANNELS:
        try:
            got = fn(q, n)
            added = 0
            for r in got:
                key = r["url"].split("#")[0].rstrip("/")
                if not key or key in seen:
                    continue
                seen.add(key)
                results.append(r)
                added += 1
            channels.append({"name": name, "status": "ok" if added else "empty", "count": added, "required": required})
        except Exception as e:  # noqa
            channels.append({"name": name, "status": "error" if required else "unavailable", "count": 0, "required": required, "error": str(e)[:400]})
    return {"query": q, "fetched_at": now(), "engine": "agent-reach", "channels": channels, "results": results}


# ---------------------------------------------------------------- doctor / setup
LABELS = {
    "exa_search": "Web search (Exa via mcporter)",
    "web": "Read any web page (Jina Reader)",
    "github": "GitHub repos and code (gh CLI)",
    "rss": "RSS / Atom feeds",
    "youtube": "YouTube videos and transcripts (yt-dlp)",
    "linkedin": "LinkedIn (MCP or Jina Reader)",
    "twitter": "Twitter / X",
    "reddit": "Reddit",
    "facebook": "Facebook",
    "instagram": "Instagram",
    "bilibili": "Bilibili",
    "xiaohongshu": "Xiaohongshu",
    "xiaoyuzhou": "Xiaoyuzhou podcasts",
    "v2ex": "V2EX",
    "xueqiu": "Xueqiu finance",
}
FIXES = {
    "exa_search": "npm i -g mcporter && mcporter config add exa https://mcp.exa.ai/mcp --scope home",
    "github": "Install GitHub CLI: https://cli.github.com then `gh auth login`",
    "youtube": 'python -m pip install -U "yt-dlp[default]"',
    "twitter": "pipx install twitter-cli",
}


def exa_live_check():
    """Agent Reach's doctor does not call the remote Exa server; we do a 1-result probe."""
    mcporter = mcporter_cmd()
    if not mcporter:
        return False, "mcporter not installed"
    try:
        p = run([*mcporter, "call", "exa.web_search_exa", "query=agent reach", "numResults=1", "--output", "json"], timeout=60)
        if p.returncode == 0 and "URL:" in p.stdout:
            return True, "Exa responded"
        return False, (p.stderr or p.stdout).strip()[-200:] or "no response"
    except Exception as e:  # noqa
        return False, str(e)[:200]


def ensure_ytdlp_js_runtime():
    """yt-dlp needs a JS runtime for YouTube; the bundled Node is on PATH, so enable it once
    (the same change Agent Reach's `render_ytdlp_fix_command()` asks the user to make)."""
    try:
        from agent_reach.utils.paths import get_ytdlp_config_path

        cfg = get_ytdlp_config_path()
        cfg.parent.mkdir(parents=True, exist_ok=True)
        existing = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
        if "--js-runtimes" not in existing and which("node"):
            sep = "" if not existing or existing.endswith("\n") else "\n"
            with open(cfg, "a", encoding="utf-8") as f:
                f.write(sep + "--js-runtimes node\n")
    except Exception:
        pass


def doctor():
    checks = []
    have_pkg = True
    ensure_ytdlp_js_runtime()
    try:
        from agent_reach.core import AgentReach  # noqa

        report = AgentReach().doctor()
    except Exception as e:  # noqa
        have_pkg = False
        report = {}
        checks.append({"id": "agent_reach", "label": "Agent Reach package", "ok": False, "required": True, "detail": str(e)[:200], "fix": "python -m pip install -e vendor/agent-reach"})
    if have_pkg:
        checks.append({"id": "agent_reach", "label": "Agent Reach package", "ok": True, "required": True, "detail": "installed"})
    ok_exa, exa_detail = exa_live_check()
    exa_detail = exa_detail + (" · your Exa key" if os.environ.get("ORBIT_EXA_KEYED") else " · free shared endpoint (low rate limit; add your Exa key in Integrations)")
    checks.append({"id": "exa_search", "label": LABELS["exa_search"], "ok": ok_exa, "required": True, "detail": exa_detail, "fix": FIXES["exa_search"]})
    order = ["web", "github", "rss", "youtube", "linkedin", "twitter", "reddit", "facebook", "instagram"]
    for key in order:
        r = report.get(key)
        if not r:
            continue
        status = r.get("status")
        bundled = key in ("youtube", "twitter", "reddit", "facebook", "instagram", "xiaohongshu") and bool(which("twitter") or which("opencli") or which("yt-dlp"))
        if status == "ok":
            detail = r.get("active_backend") or ""
        elif bundled:
            detail = "installed (bundled) · needs your login/session"
        else:
            detail = "not installed · optional"
        checks.append(
            {
                "id": key,
                "label": LABELS.get(key, key),
                "ok": status == "ok",
                "required": False,
                "status": "warn" if (status != "ok" and bundled) else status,
                "detail": detail,
                "message": (r.get("message") or "")[:300],
                "fix": FIXES.get(key),
            }
        )
    ready = all(c["ok"] for c in checks if c.get("required"))
    return {"ready": ready, "checked_at": now(), "engine": "agent-reach", "checks": checks}


def setup():
    """Installs the Agent Reach web-search backbone: mcporter + Exa MCP (home scope)."""
    log = []
    npm = which("npm")
    if not npm:
        return {"ok": False, "log": "npm is not installed. Install Node.js 20+ from https://nodejs.org and retry."}
    if mcporter_cmd() and os.environ.get("ORBIT_NODE"):
        ok, detail = exa_live_check()
        return {"ok": ok, "log": f"Bundled mcporter in use. Exa probe: {detail}"}
    if not which("mcporter"):
        p = run([npm, "i", "-g", "mcporter"], timeout=300)
        log.append((p.stdout + p.stderr).strip()[-600:])
        if p.returncode != 0:
            return {"ok": False, "log": "\n".join(log)}
    mcporter = which("mcporter")
    if not mcporter:
        return {"ok": False, "log": "\n".join(log + ["mcporter installed but not found on PATH. Add %APPDATA%\\npm to PATH."])}
    p = run([mcporter, "config", "add", "exa", EXA_URL, "--scope", "home"], timeout=60)
    log.append((p.stdout + p.stderr).strip()[-300:])
    ok, detail = exa_live_check()
    log.append(f"Exa probe: {detail}")
    return {"ok": ok, "log": "\n".join(x for x in log if x)}


def main(argv):
    if len(argv) < 2:
        print(json.dumps({"error": "usage: search.py search <query> [n] | doctor | setup"}))
        return 2
    cmd = argv[1]
    if cmd == "search":
        q = argv[2] if len(argv) > 2 else ""
        if not q.strip():
            print(json.dumps({"error": "empty query"}))
            return 2
        n = int(argv[3]) if len(argv) > 3 else 10
        print(json.dumps(search(q, n), ensure_ascii=False))
    elif cmd == "leads":
        q = argv[2] if len(argv) > 2 else ""
        target = int(argv[3]) if len(argv) > 3 else 1000
        if not q.strip():
            print(json.dumps({"error": "empty query"}))
            return 2
        res = find_leads(q, target)
        res["export"] = export(res["leads"], "leads")
        print(json.dumps(res, ensure_ascii=False))
    elif cmd in ("leads-stream", "research-stream"):
        # NDJSON: start / call / batch / error events, then a final "done" with the export paths.
        q = argv[2] if len(argv) > 2 else ""
        target = int(argv[3]) if len(argv) > 3 else 1000
        if not q.strip():
            emit_line({"type": "error", "error": "empty query", "fatal": True})
            return 2
        res = find_leads(q, target, angles=ANGLES_RESEARCH if cmd.startswith("research") else None, emit=emit_line)
        res["mode"] = "research" if cmd.startswith("research") else "leads"
        res["export"] = export(res["leads"], res["mode"])
        emit_line({"type": "done", "count": res["count"], "calls": res["calls"], "export": res["export"], "fetched_at": res["fetched_at"], "percent": 100})
    elif cmd == "enrich-stream":
        payload = json.load(open(argv[2], encoding="utf-8"))
        limit = int(argv[3]) if len(argv) > 3 else 50
        res = enrich(payload, limit, emit=emit_line)
        res["export"] = export(res["leads"], "leads-enriched")
        emit_line({"type": "done", "count": res["count"], "enriched": res["enriched"], "photos": res["photos"], "export": res["export"], "percent": 100})
    elif cmd == "research":
        q = argv[2] if len(argv) > 2 else ""
        target = int(argv[3]) if len(argv) > 3 else 1000
        if not q.strip():
            print(json.dumps({"error": "empty query"}))
            return 2
        res = find_leads(q, target, angles=ANGLES_RESEARCH)
        res["mode"] = "research"
        res["export"] = export(res["leads"], "research")
        print(json.dumps(res, ensure_ascii=False))
    elif cmd == "enrich":
        payload = json.load(open(argv[2], encoding="utf-8")) if len(argv) > 2 else json.load(sys.stdin)
        limit = int(argv[3]) if len(argv) > 3 else 50
        res = enrich(payload, limit)
        res["export"] = export(res["leads"], "leads-enriched")
        print(json.dumps(res, ensure_ascii=False))
    elif cmd == "doctor":
        print(json.dumps(doctor(), ensure_ascii=False))
    elif cmd == "setup":
        print(json.dumps(setup(), ensure_ascii=False))
    else:
        print(json.dumps({"error": f"unknown command {cmd}"}))
        return 2
    return 0


def _entry():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    os.environ.setdefault("AGENT_REACH_LANG", "en")
    sys.exit(main(sys.argv))


if __name__ == "__main__" and not os.environ.get("ORBIT_BRIDGE_CONCAT"):
    # Standalone run: pull in leads.py from the same folder.
    _here = os.path.dirname(os.path.abspath(__file__))
    exec(open(os.path.join(_here, "leads.py"), encoding="utf-8").read())
    _entry()
