# Personal AI Assistant Startup Script

Write-Host "Starting Personal AI Assistant..." -ForegroundColor Green

# Start Laravel backend development server (with Vite)
Write-Host "Starting Laravel backend development server..." -ForegroundColor Yellow
Set-Location "c:\Users\cerzi\Desktop\laravel Projects\personalAi\personal-ai-assistant\backend"
Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\cerzi\Desktop\laravel Projects\personalAi\personal-ai-assistant\backend'; composer run dev" -WindowStyle Normal

# Wait a moment for backend to start
Start-Sleep 3

# Start React frontend development server in a separate window
Write-Host "Starting React frontend development server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\cerzi\Desktop\laravel Projects\personalAi\personal-ai-assistant\frontend'; npm run dev" -WindowStyle Normal

Write-Host "Application started! Backend and Frontend development servers are running in separate windows." -ForegroundColor Green
Write-Host "Backend: http://localhost:8000, Frontend: http://localhost:3000" -ForegroundColor Cyan