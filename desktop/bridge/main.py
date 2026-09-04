# -*- coding: utf-8 -*-
"""
orbit. bridge entry point.

Runs as a standalone executable (PyInstaller sidecar `orbit-bridge.exe`, shipped
in the installer) or with a system Python during development:

  orbit-bridge search "<query>" 10
  orbit-bridge leads-stream "<query>" 1000
  orbit-bridge research-stream "<query>" 1000
  orbit-bridge enrich-stream <leads.json> 50
  orbit-bridge doctor | setup

Everything network-related goes through Agent Reach channels (see search.py / leads.py).
"""
import json
import os
import sys

# When frozen by PyInstaller the sibling modules are bundled; when run from source they
# live next to this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["ORBIT_BRIDGE_CONCAT"] = "1"  # tell search.py not to exec leads.py itself

import search  # noqa: E402
import leads  # noqa: E402
import social  # noqa: E402

# leads.py was written to share search.py's namespace; give it the helpers it expects.
for _name in ("now", "which", "run", "domain", "parse_exa_text", "ch_exa"):
    setattr(leads, _name, getattr(search, _name))
# and search.main() dispatches to the lead pipeline
for _name in ("find_leads", "enrich", "export", "emit_line", "ANGLES_RESEARCH"):
    setattr(search, _name, getattr(leads, _name))

# Bundled Agent Reach extensions: the same executable doubles as their CLI entry point
# (invoked through the .cmd shims in resources/tools/bin), so no Python is needed on the machine.
EXT = {
    "yt-dlp": ("yt_dlp", "main"),
    "twitter": ("twitter_cli.cli", "cli"),
    "rdt": ("rdt_cli.cli", "cli"),
    "xhs": ("xhs_cli.cli", "cli"),
}

def _social_entry():
    """reddit-stream <params.json>: NDJSON events, then a final done with the full result."""
    params = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else {}
    try:
        res = social.reddit_research(params, emit=leads.emit_line)
        leads.emit_line({"type": "done", "count": res["count"], "comments": res["comments"], "result": res, "percent": 100})
    except Exception as e:  # noqa
        leads.emit_line({"type": "error", "fatal": True, "error": str(e)[:300]})
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "reddit-stream":
        os.environ.setdefault("PYTHONUTF8", "1")
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
        _social_entry()
        sys.exit(0)
    if len(sys.argv) > 1 and sys.argv[1] in EXT:
        mod, fn = EXT[sys.argv[1]]
        sys.argv = [sys.argv[1]] + sys.argv[2:]
        import importlib
        sys.exit(getattr(importlib.import_module(mod), fn)())
    search._entry()
