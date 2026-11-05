@echo off
chcp 65001 >nul
title Insula Deserta - игра через Radmin VPN
cd /d "%~dp0"

echo.
echo  ===============================================
echo     INSULA DESERTA - игра через Radmin VPN
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

rem ---------- 3. Разрешение в брандмауэре Windows (один раз) ----------
netsh advfirewall firewall show rule name=InsulaDeserta >nul 2>nul
if errorlevel 1 (
  echo  Нужно один раз разрешить игру в брандмауэре Windows.
  echo  Сейчас появится запрос Windows - нажмите "Да".
  powershell -NoProfile -Command "Start-Process netsh -ArgumentList 'advfirewall firewall add rule name=InsulaDeserta dir=in action=allow protocol=TCP localport=3000' -Verb RunAs -Wait"
  netsh advfirewall firewall show rule name=InsulaDeserta >nul 2>nul
  if errorlevel 1 (
    echo  [!] Разрешение не добавлено. Друзья могут не подключиться.
    echo      Запустите этот файл ещё раз и нажмите "Да" в запросе Windows.
    echo.
  ) else (
    echo  Готово, игра разрешена в брандмауэре.
  )
)

rem ---------- 4. Адрес в Radmin VPN ----------
set "RIP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like '26.*' } | Select-Object -First 1).IPAddress"') do set "RIP=%%i"
if not defined RIP (
  echo.
  echo  [!] Не найден адрес Radmin VPN.
  echo      1. Установите Radmin VPN: https://www.radmin-vpn.com/ru/
  echo      2. Запустите его, нажмите "Включить" (кнопка питания^).
  echo      3. Создайте сеть: "Сеть" - "Создать сеть", придумайте имя и пароль.
  echo      4. Запустите этот файл снова.
  echo.
  start "" https://www.radmin-vpn.com/ru/
  pause
  exit /b 1
)

rem ---------- 5. Режим ----------
echo.
echo  Выберите режим:
echo    1 - обычная игра (3-8 игроков)
echo    2 - тестовый режим (от 1 игрока, выбор роли, команды /give и т.п.)
choice /c 12 /n /m "  Ваш выбор [1/2]: "
set "MODE="
if errorlevel 2 set "MODE=--dev"

rem ---------- 6. Сервер игры ----------
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
set "URL=http://%RIP%:3000"
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
echo  Что должны сделать друзья:
echo    1. Установить и включить Radmin VPN.
echo    2. "Сеть" - "Присоединиться к сети" - ввести имя и пароль вашей сети.
echo    3. Открыть ссылку выше в браузере.
echo.
start "" http://localhost:3000
echo  Пока идёт игра, НЕ закрывайте это окно и не выключайте компьютер.
echo.
echo  Чтобы закончить и всё выключить, нажмите любую клавишу в этом окне.
pause >nul

:stop
echo  Останавливаю игру...
taskkill /fi "WINDOWTITLE eq Insula server*" /t /f >nul 2>nul
exit /b 0
