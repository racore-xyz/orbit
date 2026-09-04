@echo off
rem Start a fresh onefile process: clear PyInstaller's inherited bootstrap variables.
set "_PYI_ARCHIVE_FILE="
set "_PYI_PARENT_PROCESS_LEVEL="
set "_PYI_APPLICATION_HOME_DIR="
set "_PYI_SPLASH_IPC="
set "_MEIPASS2="
"%~dp0..\..\..\orbit-bridge.exe" yt-dlp %*
