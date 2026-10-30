@echo off
cd /d "%~dp0"

rem Already running: just open the site.
netstat -ano | findstr /C:":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 goto open

if exist "node_modules\" goto start
echo Installing dependencies...
call npm install
if errorlevel 1 goto install_failed

:start
echo Starting server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = (Get-Location).Path; $logDir = Join-Path $root 'logs'; New-Item -ItemType Directory -Force -Path $logDir | Out-Null; $log = Join-Path $logDir 'dev.log'; Add-Content -LiteralPath $log -Encoding ascii -Value ('---- start {0} ----' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')); $psi = New-Object System.Diagnostics.ProcessStartInfo; $psi.FileName = 'cmd.exe'; $psi.Arguments = '/d /c npm run dev >> ' + [char]34 + $log + [char]34 + ' 2>&1'; $psi.WorkingDirectory = $root; $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden; $psi.CreateNoWindow = $true; $psi.UseShellExecute = $false; [void][System.Diagnostics.Process]::Start($psi)"
if errorlevel 1 goto failed

set /a tries=0
:waitloop
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 8; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto open
set /a tries+=1
if %tries% GEQ 45 goto failed
ping -n 2 127.0.0.1 >nul
goto waitloop

:open
start "" http://localhost:3000/
exit /b 0

:install_failed
echo npm install failed.
pause
exit /b 1

:failed
echo Server did not start. See logs\dev.log
pause
exit /b 1
