@echo off
cd /d "%~dp0"
set "NODUS_DATA_DIR=%~dp0.nodus-user-data"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron is missing. Follow the migration guide to install dependencies first.
  pause
  exit /b 1
)
start "Nodus" "node_modules\electron\dist\electron.exe" .
