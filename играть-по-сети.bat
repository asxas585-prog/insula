@echo off
chcp 65001 >nul
title Insula Deserta - игра по сети
cd /d "%~dp0"

echo.
echo  ===============================================
echo     INSULA DESERTA - запуск игры по интернету
echo  ===============================================
echo.

rem ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 (
  echo  [!] Не найден Node.js. Сейчас откроется сайт для скачивания.
  echo      Установите версию LTS и запустите этот файл снова.
  start "" https://nodejs.org
  pause
  exit /b 1
)

rem ---------- 2. Зависимости игры ----------
if not exist "node_modules\ws" (
  echo  Устанавливаю зависимости игры, это нужно один раз...
  call npm install
  if errorlevel 1 (
    echo  [!] Не удалось установить зависимости. Проверьте интернет.
    pause
    exit /b 1
  )
)

rem ---------- 3. cloudflared ----------
set "CF="
if exist "%~dp0cloudflared.exe" set "CF=%~dp0cloudflared.exe"
if not defined CF (
  where cloudflared >nul 2>nul
  if not errorlevel 1 set "CF=cloudflared"
)
if not defined CF (
  echo  Скачиваю cloudflared, это нужно один раз...
  curl -L --fail -o "%~dp0cloudflared.exe" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  if errorlevel 1 (
    echo  [!] Не удалось скачать cloudflared.
    echo      Скачайте вручную cloudflared-windows-amd64.exe, переименуйте в cloudflared.exe
    echo      и положите в эту папку.
    start "" https://github.com/cloudflare/cloudflared/releases/latest
    pause
    exit /b 1
  )
  set "CF=%~dp0cloudflared.exe"
)

rem ---------- 4. Режим ----------
echo.
echo  Выберите режим:
echo    1 - обычная игра (3-8 игроков)
echo    2 - тестовый режим (от 1 игрока, выбор роли, команды /give и т.п.)
choice /c 12 /n /m "  Ваш выбор [1/2]: "
set "MODE="
if errorlevel 2 set "MODE=--dev"

rem ---------- 5. Сервер игры ----------
echo.
echo  Запускаю сервер игры...
start "Insula server" /min cmd /k node server.js %MODE%

set /a tries=0
:waitserver
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:3000
if not errorlevel 1 goto serverok
set /a tries+=1
if %tries% geq 30 (
  echo  [!] Сервер не запустился. Посмотрите окно "Insula server".
  echo      Возможно, порт 3000 занят другой программой или игра уже запущена.
  pause
  goto stop
)
goto waitserver
:serverok
echo  Сервер работает: http://localhost:3000

rem ---------- 6. Туннель ----------
echo  Открываю туннель через Cloudflare...
if exist tunnel.log del tunnel.log
rem --protocol http2: работает через обычный HTTPS, даже если провайдер режет UDP
start "Insula tunnel" /min cmd /c ""%CF%" tunnel --no-autoupdate --protocol http2 --url http://localhost:3000 > tunnel.log 2>&1"

set "URL="
set /a tries=0
:waittunnel
timeout /t 1 /nobreak >nul
for /f "delims=" %%u in ('powershell -NoProfile -Command "$m = Select-String -Path 'tunnel.log' -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1; if ($m) { $m.Matches[0].Value }"') do set "URL=%%u"
if defined URL goto gotname
set /a tries+=1
if %tries% geq 45 (
  echo  [!] Cloudflare не выдал адрес. Подробности в файле tunnel.log
  echo      Проверьте интернет; возможно, антивирус блокирует cloudflared.exe
  pause
  goto stop
)
goto waittunnel

:gotname
set "HOST=%URL:https://=%"
echo  Адрес получен: %URL%
echo  Жду, пока туннель подключится к серверам Cloudflare...
set /a tries=0
:waitreg
timeout /t 1 /nobreak >nul
findstr /c:"Registered tunnel connection" tunnel.log >nul 2>nul
if not errorlevel 1 goto regok
set /a tries+=1
if %tries% geq 60 (
  echo  [!] Туннель не смог подключиться к Cloudflare за минуту.
  echo      Скорее всего, туннели Cloudflare блокирует провайдер, VPN или антивирус.
  echo      Подробности в файле tunnel.log
  echo.
  echo      Если не помогает отключение/включение VPN - используйте файл
  echo      играть-через-radmin.bat (игра через Radmin VPN, без Cloudflare^).
  pause
  goto stop
)
goto waitreg

:regok
echo  Туннель подключён. Жду, пока адрес появится в DNS (до минуты)...
set /a tries=0
:waitdns
timeout /t 2 /nobreak >nul
curl -s -m 5 -H "accept: application/dns-json" "https://cloudflare-dns.com/dns-query?name=%HOST%&type=A" | findstr /c:"Answer" >nul 2>nul
if not errorlevel 1 goto dnsok
set /a tries+=1
if %tries% geq 30 goto dnsok
goto waitdns

:dnsok
rem сбрасываем запомненный Windows ответ «адрес не найден»
ipconfig /flushdns >nul 2>nul
timeout /t 3 /nobreak >nul
set "LOCALDNS=ok"
powershell -NoProfile -Command "try { [System.Net.Dns]::GetHostAddresses('%HOST%') | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 set "LOCALDNS=bad"

echo %URL%| clip
echo.
echo  ===============================================
echo   ССЫЛКА ДЛЯ ДРУЗЕЙ (уже скопирована):
echo.
echo     %URL%
echo.
echo   Вы сами играете по адресу:  http://localhost:3000
echo  ===============================================
echo.
if "%LOCALDNS%"=="bad" (
  echo  [!] Ваш DNS-сервер пока не находит этот адрес.
  echo      Ссылка у друзей может не открываться с ошибкой DNS_PROBE_FINISHED_NXDOMAIN.
  echo      Если ошибка не пройдёт через 1-2 минуты, включите в браузере безопасный DNS:
  echo        Chrome / Edge / Яндекс: Настройки - Конфиденциальность и безопасность -
  echo        Безопасный DNS - выбрать Cloudflare (1.1.1.1^) или Google (8.8.8.8^)
  echo.
)
echo  Если у друга ошибка DNS_PROBE_FINISHED_NXDOMAIN - пусть подождёт минуту,
echo  обновит страницу, а если не поможет - включит безопасный DNS (см. выше).
echo.
start "" http://localhost:3000
echo  Пока идёт игра, НЕ закрывайте это окно и не выключайте компьютер.
echo.
echo  Чтобы закончить и всё выключить, нажмите любую клавишу в этом окне.
pause >nul

:stop
echo  Останавливаю игру и туннель...
taskkill /fi "WINDOWTITLE eq Insula tunnel*" /t /f >nul 2>nul
taskkill /fi "WINDOWTITLE eq Insula server*" /t /f >nul 2>nul
taskkill /im cloudflared.exe /f >nul 2>nul
exit /b 0
