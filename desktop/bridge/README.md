# Research bridge (Agent Reach only)

The bridge is the only way the desktop app reaches the internet for research. It calls Agent Reach channels exactly as the Agent Reach skill documents them, never scrapes search engines itself, and never returns invented data.

## Files
| File | Role |
| --- | --- |
| `main.py` | Entry point. Wires `search.py` + `leads.py` together. Frozen into `orbit-bridge.exe` for the installer. |
| `search.py` | Helpers, Exa via mcporter, GitHub via gh, `doctor`, `setup`, command dispatch. |
| `leads.py` | Lead Finder / Market Research fan-out, structured parsing, enrichment (photos + published emails), Excel/JSON export, streaming events. |

## Commands
```
orbit-bridge search "<query>" 10
orbit-bridge leads "<query>" 1000          orbit-bridge leads-stream "<query>" 1000
orbit-bridge research "<query>" 1000       orbit-bridge research-stream "<query>" 1000
orbit-bridge enrich <leads.json> 50        orbit-bridge enrich-stream <leads.json> 50
orbit-bridge doctor | setup
```
`*-stream` variants print NDJSON events (`start`, `call`, `batch`, `lead`, `error`, `done`); the Rust side forwards each line as a Tauri event `bridge://<job id>`.

## How the app finds its tools
`src-tauri/src/lib.rs::bridge_cmd()`:
1. `orbit-bridge.exe` next to the app executable (installed build), else `python desktop/bridge/main.py` (development).
2. Bundled Node + mcporter from `resources/node` and `resources/mcporter`, exported as `ORBIT_NODE` / `ORBIT_MCPORTER_CLI`, with `MCPORTER_CONFIG=resources/mcporter.json` (Exa preconfigured). Falls back to a global `mcporter` on PATH.

End users therefore need no Python, Node.js, npm, or manual Exa setup. Rebuild the bundled tools with `scripts/bundle-tools.ps1`.

## Email and photo policy
Only addresses a company publishes on its own profile or website are recorded, tagged by role and source page. Personal mailboxes are skipped. Profile photos are public LinkedIn images referenced by URL, never downloaded. See `AGENT_REACH_INTEGRATION.md`.

## Bundled Agent Reach extensions
The installer ships every extension that can be obtained through a package manager, so the doctor shows them as available on a clean machine:

| Channel | Tool | How it ships |
| --- | --- | --- |
| YouTube | `yt-dlp` | inside `orbit-bridge.exe` (+ `tools/bin/yt-dlp.cmd` shim) |
| Twitter/X | `twitter` (twitter-cli) | inside the sidecar + shim |
| Reddit (Agent Reach channel) | `rdt` (rdt-cli) | inside the sidecar + shim |
| Xiaohongshu | `xhs` (xhs-cli) | inside the sidecar + shim |
| RSS | `feedparser` | inside the sidecar |
| Podcasts / audio | `ffmpeg` | `resources/tools/node_modules/ffmpeg-static` + shim |
| Facebook / Instagram / Reddit desktop | `opencli` | `resources/tools/node_modules/@jackwener/opencli` + shim (runs on the bundled Node) |
| Web search | `mcporter` + Exa | `resources/mcporter` + bundled Node |

Not bundled (no package-manager distribution): GitHub CLI `gh`, `deno`, `uvx`, `bili-cli`. The doctor lists them as optional with install hints. Login-based channels still need the user's own session/cookies.

## Social Media → Reddit
`main.py reddit-stream <params.json>` uses Arctic Shift (`social.py`): subreddit discovery, paced post search per subreddit with a date window, comments on the most discussed posts, monthly timeline, top subreddits and terms. The app then asks the configured LLM for a market report (established vs emerging markets, opportunities, opinions, pain points).

## Exa quota
Agent Reach's web search runs on Exa's MCP. Without a key it uses the free shared endpoint at `https://mcp.exa.ai/mcp`, whose rate limit is unpublished and low; it answers HTTP 429 after a burst of searches. Integrations → Agent Reach → "Exa API key" stores a personal key (free tier at https://dashboard.exa.ai/api-keys) in the credential store and writes `%APPDATA%\orbit\mcporter.json` with `?exaApiKey=…`, which the bridge prefers over the bundled config. The bridge also paces Exa calls (2.5 s apart on the shared endpoint, 1 s with a key), retries once after 20 s on 429, stops a run early after three near-empty queries, and caps a run at 25 calls.
