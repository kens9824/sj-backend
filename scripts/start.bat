@echo off

echo Starting XAMPP...
start "" "C:\xampp\xampp-control.exe"

timeout /t 5

echo Starting Backend...
start cmd /k "cd /d C:\Kenil-scale\sjslip\slip-backend && npm run dev"

echo Starting Frontend...
start cmd /k "cd /d C:\Kenil-scale\sjslip\slip-app && npm run dev"

exit