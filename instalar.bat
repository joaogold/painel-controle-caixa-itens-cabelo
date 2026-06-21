@echo off
chcp 65001 >nul
title Instalação - Painel de Controle de Caixa e Estoque

echo ============================================================
echo   PAINEL DE CONTROLE DE CAIXA, ESTOQUE E VENDAS
echo   Instalação de dependências
echo ============================================================
echo.

:: Verifica se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERRO] Node.js não encontrado!
    echo.
    echo Instalando Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERRO] Falha ao instalar o Node.js.
        echo        Instale manualmente em: https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo.
    echo Node.js instalado! Reinicie este terminal e execute novamente.
    pause
    exit /b 0
)

:: Mostra versões
echo [OK] Node.js encontrado:
node --version
echo [OK] npm:
call npm --version
echo.

:: Instala dependências do projeto
echo Instalando dependências do projeto...
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRO] Falha ao instalar dependências.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   INSTALAÇÃO CONCLUÍDA COM SUCESSO!
echo ============================================================
echo.

:: Verifica se o .env existe
if not exist ".env" (
    echo [AVISO] Arquivo .env não encontrado!
    echo         Criando a partir do .env.example...
    copy .env.example .env >nul
    echo.
    echo         Edite o arquivo .env com suas credenciais do Supabase:
    echo           VITE_SUPABASE_URL=https://seu-projeto.supabase.co
    echo           VITE_SUPABASE_ANON_KEY=sua-anon-key
    echo.
)

echo Para rodar o projeto:
echo   npm run dev
echo.
echo O sistema abrirá em: http://localhost:5173
echo.
pause
