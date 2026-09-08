@echo off
REM ==========================================================
REM  Spusti backend a otevre hru v prohlizeci (vyvoj na Windows).
REM  Dvojklik na tento soubor.
REM
REM  Port lze zmenit: start-windows.bat 5050
REM  (bez parametru se pouzije 5000)
REM ==========================================================
if "%~1"=="" (set PORT=5000) else (set PORT=%~1)
cd /d "%~dp0..\backend"
echo ============================================
echo  Houpadlo - hra pobezi na http://127.0.0.1:%PORT%
echo  Okno nechte otevrene. Ukonceni = Ctrl+C.
echo ============================================
start "" http://127.0.0.1:%PORT%
python app.py
