@echo off
REM Start backend server in a new window
start "Backend Server" cmd /k "cd backend && npm start"

REM Start frontend server in a new window
start "Frontend Server" cmd /k "cd frontend && npm start"

REM Wait for 10 seconds to allow servers to start
timeout /t 10 /nobreak
