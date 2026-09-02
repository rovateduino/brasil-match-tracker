@echo off
setlocal
title Brasil Match Tracker
cd /d "%~dp0"

echo ============================================
echo   Brasil Match Tracker - Iniciando
echo ============================================
echo.

echo [1/3] Abrindo terminal do servidor (API)...
start "BMT - Server (porta 5000)" cmd /k "cd /d server && npm run dev"

echo [2/3] Abrindo terminal do client (Vite)...
start "BMT - Client (porta 5173)" cmd /k "cd /d client && npm run dev"

echo [3/3] Aguardando o app subir...
powershell -NoProfile -Command "for($i=0;$i -lt 45;$i++){ try{ $r=Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){ Start-Process 'http://localhost:5173'; exit 0 } }catch{}; Start-Sleep -Seconds 1 }; exit 1"
if %errorlevel% neq 0 (
    echo.
    echo Nao foi possivel conectar ao app apos 45s.
    echo Verifique os terminais abertos acima.
) else (
    echo.
    echo Pronto! A tela do app foi aberta no navegador.
)
echo.
echo Mantenha os dois terminais abertos. Para encerrar, feche-os.
echo.
pause
endlocal
