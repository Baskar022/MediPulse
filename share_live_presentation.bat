@echo off
setlocal

echo ===============================================================================
echo   MediPulse: Instant Live Presentation Tunnel Generator
echo   Shares your local running app over a public HTTPS link for presentations
echo ===============================================================================
echo.

:: Check if server is already running on port 8000
echo [1/2] Launching unified MediPulse server on port 8000...
start "MediPulse Server" cmd /k "python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"

timeout /t 3 /nobreak >nul

echo [2/2] Generating public HTTPS presentation link via localtunnel (npx)...
echo.
echo ===============================================================================
echo   Share the generated HTTPS URL with evaluators/professors to view on their
echo   laptops, tablets, or phones!
echo ===============================================================================
echo.
call npx --yes localtunnel --port 8000
pause
