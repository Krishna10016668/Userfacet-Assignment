@echo off
echo ============================================
echo   E-Library Management System - Starting
echo ============================================
echo.
echo Starting Python AI Service on port 5000...
start "AI Service" cmd /k "cd ai-service && py app.py"
timeout /t 3 /nobreak > nul
echo Starting Node.js API Server on port 3000...
start "API Server" cmd /k "node src/server.js"
echo.
echo ============================================
echo   Both services are starting!
echo   API Server: http://localhost:3000
echo   AI Service: http://localhost:5000
echo ============================================
