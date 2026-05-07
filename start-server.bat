@echo off
echo Starting Schedule Visualizer on http://localhost:8000
echo Close this window to stop the server.
echo.
start "" "http://localhost:8000"
python -m http.server 8000
