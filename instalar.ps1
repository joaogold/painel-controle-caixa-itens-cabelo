# ============================================================
#   PAINEL DE CONTROLE DE CAIXA, ESTOQUE E VENDAS
#   Instalação de dependências
# ============================================================

$Host.UI.RawUI.WindowTitle = "Instalação - Painel de Controle"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  PAINEL DE CONTROLE DE CAIXA, ESTOQUE E VENDAS" -ForegroundColor Magenta
Write-Host "  Instalação de dependências" -ForegroundColor Magenta
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host ""

# Verifica se o Node.js está instalado
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
    Write-Host "[!] Node.js não encontrado." -ForegroundColor Yellow
    Write-Host "    Instalando Node.js LTS via winget..." -ForegroundColor Cyan
    Write-Host ""

    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "[ERRO] Falha ao instalar o Node.js." -ForegroundColor Red
        Write-Host "       Instale manualmente em: https://nodejs.org" -ForegroundColor Red
        Write-Host ""
        Read-Host "Pressione Enter para sair"
        exit 1
    }

    # Atualiza o PATH na sessão atual
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host ""
        Write-Host "[AVISO] Node instalado, mas o PATH não atualizou nesta sessão." -ForegroundColor Yellow
        Write-Host "        Feche e reabra o terminal, depois execute este script novamente." -ForegroundColor Yellow
        Write-Host ""
        Read-Host "Pressione Enter para sair"
        exit 0
    }
}

Write-Host "[OK] Node.js: $(node --version)" -ForegroundColor Green
Write-Host "[OK] npm:     $(npm --version)" -ForegroundColor Green
Write-Host ""

# Navega para o diretório do script
Set-Location $PSScriptRoot

# Instala dependências
Write-Host "Instalando dependências do projeto..." -ForegroundColor Cyan
Write-Host ""

npm install --no-fund --no-audit

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[ERRO] Falha ao instalar dependências." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit 1
}

Write-Host ""

# Verifica/cria .env
if (-not (Test-Path ".env")) {
    Write-Host "[AVISO] Arquivo .env não encontrado. Criando a partir do .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "  Edite o arquivo .env com suas credenciais do Supabase:" -ForegroundColor Yellow
    Write-Host "    VITE_SUPABASE_URL=https://seu-projeto.supabase.co" -ForegroundColor Gray
    Write-Host "    VITE_SUPABASE_ANON_KEY=sua-anon-key" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "[OK] Arquivo .env já existe." -ForegroundColor Green
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Para rodar o projeto:" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "  O sistema abrirá em: http://localhost:5173" -ForegroundColor White
Write-Host ""
Read-Host "Pressione Enter para sair"
