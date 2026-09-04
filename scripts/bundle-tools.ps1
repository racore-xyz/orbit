# Rebuilds everything the installer ships so end users need nothing pre-installed.
#   1. Node.js runtime + mcporter  -> src-tauri/resources/{node,mcporter}
#   2. orbit-bridge sidecar (PyInstaller, includes agent_reach + openpyxl) -> src-tauri/binaries
# Then:  npm run desktop:build; npx tauri build   (installer lands in src-tauri/target/release/bundle/nsis)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

Write-Host '1/3  Node runtime + mcporter'
New-Item -ItemType Directory -Force src-tauri/resources/node, src-tauri/resources/mcporter | Out-Null
npm i --prefix src-tauri/resources/node node@24 --no-audit --no-fund
npm i --prefix src-tauri/resources/mcporter mcporter@0.13.8 --no-audit --no-fund --omit=dev
Write-Host '1b/3 Agent Reach extensions: OpenCLI + ffmpeg (npm)'
New-Item -ItemType Directory -Force src-tauri/resources/tools | Out-Null
npm i --prefix src-tauri/resources/tools @jackwener/opencli ffmpeg-static --no-audit --no-fund

Write-Host '2/3  Bridge sidecar (clean venv)'
if (-not (Test-Path build-bridge/venv)) { python -m venv build-bridge/venv }
& build-bridge/venv/Scripts/python.exe -m pip install -q --disable-pip-version-check pyinstaller openpyxl feedparser yt-dlp twitter-cli rdt-cli xhs-cli vendor/agent-reach
$env:PYTHONUTF8 = '1'
& build-bridge/venv/Scripts/python.exe -m PyInstaller --noconfirm --onefile --console `
  --name orbit-bridge-x86_64-pc-windows-msvc --icon (Resolve-Path src-tauri/icons/icon.ico) `
  --collect-all agent_reach --collect-all openpyxl --collect-all feedparser --collect-all yt_dlp --collect-all twitter_cli --collect-all rdt_cli --collect-all xhs_cli `
  --hidden-import social `
  --distpath src-tauri/binaries --workpath build-bridge/work --specpath build-bridge desktop/bridge/main.py

Write-Host '3/3  Smoke test'
& src-tauri/binaries/orbit-bridge-x86_64-pc-windows-msvc.exe doctor | Select-Object -First 1
Write-Host 'Done. Next: npm run desktop:build; npx tauri build'
