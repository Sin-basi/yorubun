@echo off
cd /d "%~dp0"
echo.
echo   yorubun prototype server
echo.
echo   phone  ^>  http://10.1.1.12
echo   here   ^>  http://localhost
echo.
echo   if the IP changed, run ipconfig and look at the
echo   IPv4 address of the ethernet adapter.
echo.
echo   Ctrl+C to stop.
echo.
python -m http.server 80 --bind 0.0.0.0
