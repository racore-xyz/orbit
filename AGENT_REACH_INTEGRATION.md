# Agent Reach integration

Orbit calls Agent Reach through the native Tauri layer so market research and lead discovery can use real upstream channels without inventing data.

Native commands:

- `agent_reach_search(query, limit)` runs the embedded bridge (`desktop/bridge/search.py`), which calls Agent Reach channels only: Exa web search through `mcporter call exa.web_search_exa` (required) and GitHub through `gh search repos` (optional). Returns JSON with per-channel status and normalized results (title, url, snippet, published, author, source, channel, fetched_at).
- `bridge_doctor` runs `AgentReach().doctor()` plus a live Exa probe and returns an English JSON report.
- `bridge_setup` installs `mcporter` and registers the Exa MCP in home scope (`mcporter config add exa https://mcp.exa.ai/mcp --scope home`). Runs only when the user clicks the setup button.
- `agent_reach_doctor` returns the raw upstream `agent-reach doctor` text (Chinese-only upstream), kept for debugging.

See `desktop/bridge/README.md` for the bridge contract.

Agent Reach supports webpage reading, YouTube transcripts/search, RSS, GitHub public repositories, and Exa semantic search with zero configuration. Login/session-dependent channels (X/Twitter, Reddit, Facebook, Instagram, Xiaohongshu, and some LinkedIn workflows) must be explicitly configured by the user. Cookies and tokens must remain local and should use a dedicated account where a platform permits session-based automation.

The app must never scrape private accounts, bypass authentication, or bulk collect personal email addresses without a lawful basis and user authorization. Lead records should store source URL, timestamp, channel, confidence, and consent/permission status.
