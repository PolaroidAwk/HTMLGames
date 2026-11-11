
@echo off
title HTMLGames - Git Backup
cd /d "%~dp0"

echo ================================
echo       HTMLGAMES - BACKUP
echo ================================
echo.

set /p mensagem=Digite a mensagem do commit: 

if "%mensagem%"=="" (
    echo.
    echo ERRO: A mensagem nao pode ficar vazia!
    pause
    exit /b 1
)

echo.
echo Preparando arquivos...
git add .

echo.
echo Criando commit...
git commit -m "%mensagem%"

if errorlevel 1 (
    echo.
    echo Commit nao realizado. Verifique se existem alteracoes.
    pause
    exit /b 1
)

echo.
echo Enviando para o GitHub...
git push

if errorlevel 1 (
    echo.
    echo ERRO AO ENVIAR PARA O GITHUB!
    pause
    exit /b 1
)

echo.
echo ================================
echo       BACKUP CONCLUIDO!
echo ================================
pause
