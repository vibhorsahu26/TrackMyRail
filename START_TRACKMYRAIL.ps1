$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Test-Path '.venv\Scripts\python.exe')) { py -3 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot\backend'; & '$PSScriptRoot\.venv\Scripts\python.exe' ml_service.py"
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot'; & '$PSScriptRoot\.venv\Scripts\python.exe' -m http.server 8080"
Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:8080/index.html'
