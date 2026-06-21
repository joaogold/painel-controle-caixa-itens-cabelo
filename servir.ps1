# ============================================================
#   Servidor local para o Painel (HTML/CSS/JavaScript)
#   Necessário pois o navegador exige HTTP (não file://) para
#   carregar módulos ES e autenticar no Supabase.
# ============================================================

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location $PSScriptRoot

$port = 5173

# Garante que existe um config.js (copia do exemplo se faltar)
if (-not (Test-Path 'config.js')) {
    Write-Host "[!] config.js não encontrado. Criando a partir de config.example.js..." -ForegroundColor Yellow
    Copy-Item 'config.example.js' 'config.js'
    Write-Host "    Edite o config.js com sua SUPABASE_URL e SUPABASE_ANON_KEY." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "  Servindo o painel em: http://localhost:$port" -ForegroundColor Green
Write-Host "  Pressione Ctrl+C para parar." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Magenta

# Tenta abrir o navegador
Start-Process "http://localhost:$port"

# Usa o 'serve' do Node (já instalado). O npx baixa na primeira execução.
npx --yes serve@latest -l $port .
