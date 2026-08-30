@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  py -3 -m venv .venv || goto :error
)
.venv\Scripts\python.exe -m pip install -r backend\requirements.txt || goto :error
start "TrackMyRail Backend" cmd /k "cd /d %~dp0backend && ..\.venv\Scripts\python.exe ml_service.py"
start "TrackMyRail Frontend" cmd /k "cd /d %~dp0 && .venv\Scripts\python.exe -m http.server 8080"
timeout /t 2 >nul
start "" http://127.0.0.1:8080/index.html
exit /b 0
:error
echo Failed to prepare TrackMyRail. Check that Python 3.10+ is installed.
pause
