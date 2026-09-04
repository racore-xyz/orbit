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
import os
import sys

# When frozen by PyInstaller the sibling modules are bundled; when run from source they
# live next to this file.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["ORBIT_BRIDGE_CONCAT"] = "1"  # tell search.py not to exec leads.py itself

import search  # noqa: E402
import leads  # noqa: E402

# leads.py was written to share search.py's namespace; give it the helpers it expects.
for _name in ("now", "which", "run", "domain", "parse_exa_text", "ch_exa"):
    setattr(leads, _name, getattr(search, _name))
# and search.main() dispatches to the lead pipeline
for _name in ("find_leads", "enrich", "export", "emit_line", "ANGLES_RESEARCH"):
    setattr(search, _name, getattr(leads, _name))

if __name__ == "__main__":
    search._entry()
