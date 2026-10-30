@echo off
cd /d "%~dp0"
where pythonw >nul 2>&1 && (
  start "" pythonw "%~dp0scripts\gameweek_app.py"
  exit /b 0
)
python "%~dp0scripts\gameweek_app.py"
if errorlevel 1 pause
