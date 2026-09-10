# orbit. Growth OS

**Your agentic go-to-market workspace.** Find leads, research markets, run outreach campaigns, and manage job applications — from one fast Windows desktop app. No Python or Node.js required: everything ships inside the installer.

Built by [racore.xyz](https://racore.xyz).

---

## What it does

**Lead Finder** — Describe your ideal customer. orbit. fans the query out across regions and roles through multi-channel web search until it reaches your target, then structures every record: company, people, published emails, photos, funding, headcount. Exports to `xlsx` + `json` with one click.

**Market Research** — The same pipeline aimed at markets instead of people: competitors, reports, news, funding signals, hiring demand — normalized into one research history you can reopen anytime.

**Outreach & Campaigns** — A WhatsApp-style inbox for every thread: AI drafting in your own writing style (it learns from your edits), template variants, sequences, scheduled follow-ups that **stop automatically the moment someone replies**, reply sync over IMAP, bounce detection, campaigns with mailbox rotation and daily caps.

**Jobs mode** — A full job-seeking workspace: search across global and Arab/Gulf boards, a tracked pipeline (saved → applied → replied), ATS review with letter grades (A+ to F), one-click résumé rewrite, per-application cover letters generated from the posting, and one-click apply emails with `.docx` attachments.

**Integrations** — Gmail/SMTP + IMAP mailboxes, signed webhooks, personal search key, 7 LLM providers (OpenAI, Anthropic, Gemini, Mistral, Groq, OpenRouter) plus the Racore license gateway as default.

**MCP server (built in)** — The whole system is also a Model Context Protocol server with 10 focused tools (lead finder, enrich, inbox check, variants, templates, campaign send, jobs search, one-click apply…). It starts automatically with the app on `http://127.0.0.1:18789/mcp` — point any MCP client (Hermes, Claude, Cursor) at it. Every tool call requires a valid license.

---

## Install (Windows)

1. Download the latest installer from [**Releases**](https://github.com/racore-xyz/orbit/releases/latest): `Orbit-Growth-OS_*_x64-setup.exe`.
2. Run it (current-user install, English/Arabic). Accept the EULA on first launch.
3. Open **Integrations** and activate with your license code (`orbit_…`). Done — AI routes through the gateway, no API keys needed.

The app updates itself: on launch it checks this repo's latest release and offers the update.

---

## License activation

- In the app: **Integrations → license code → Activate**.
- Headless/CLI: `Orbit Growth OS.exe --activate <code>` · device id: `--device-id` · full reset: `--reset-workspace`.

Every AI feature and every MCP tool call is gated on a valid, server-verified license. Expired or revoked sessions fall back to the activation screen — never silently.

---

## MCP quick start (Hermes)

`~/.hermes/config.yaml`:

```yaml
mcp_servers:
  orbit:
    url: "http://127.0.0.1:18789/mcp"
    timeout: 600
    connect_timeout: 60
```

Then `/reload-mcp` and: `Activate my Orbit license with code orbit_XXXX using orbit_license_activate`. Ready-made flows: *“Find 100 leads for SaaS startups in Riyadh, save the run”*, *“Sync inbox replies and draft answers”*, *“Send all due follow-ups”*, *“Add React developer postings with verified emails, then apply to the first one.”*

---

## How it works (high level)

- **Desktop shell** (Tauri 2 + React): dashboard, research, outreach, jobs, integrations, log center — English/Arabic, light/dark.
- **Research bridge** (bundled sidecar): multi-channel search, enrichment, exports. Runs windowless.
- **Local MCP endpoint** (bundled sidecar): serves the 10-tool API over Streamable HTTP, auto-started and auto-stopped with the app.
- **Data**: everything lives locally under `%APPDATA%\orbit` (runs, threads, pipeline, workspace). Secrets (mailbox passwords, LLM keys, license token) live only in Windows Credential Manager — never in files.
- **License gateway** (api.racore.xyz): server-authoritative verify/login, per-device seats, AI completions routing, desktop event webhook.

---

## Releases & auto-update

Releases are published here with signed updater artifacts (`latest.json` + signatures). The installed app checks for updates on launch. Keys are rotated by the maintainer; the public key is embedded in the app.

- Latest release: https://github.com/racore-xyz/orbit/releases/latest
- Report issues: https://github.com/racore-xyz/orbit/issues

---

© 2026 racore.xyz. All rights reserved. Distributed under the Racore EULA (shown during install).
