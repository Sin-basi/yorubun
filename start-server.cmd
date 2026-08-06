@echo off
cd /d "%~dp0"
echo.
echo   yorubun
echo.
echo   here  ^>  http://localhost/
echo.
echo   手機不能用這條，他走行動數據不在這個網段。
echo   手機看 raw.githack 的網址，見 README。
echo.
echo   改了檔案沒變化的話是 service worker 在快取，
echo   清除方式見 README 的「在電腦上看」。
echo.
echo   Ctrl+C to stop.
echo.
python -m http.server 80 --bind 0.0.0.0
