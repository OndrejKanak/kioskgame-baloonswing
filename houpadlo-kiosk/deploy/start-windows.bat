@echo off
REM ==========================================================
REM  Spusti backend a otevre hru v prohlizeci (vyvoj na Windows).
REM  Dvojklik na tento soubor.
REM ==========================================================
cd /d "%~dp0..\backend"
echo ============================================
echo  Houpadlo - hra pobezi na http://127.0.0.1:5000
echo  Okno nechte otevrene. Ukonceni = Ctrl+C.
echo ============================================
start "" http://127.0.0.1:5000
python app.py
