# Arranca o Keycloak local em modo de desenvolvimento, com o realm da Matriz (DT04, DT15).
#
# Requisitos: Keycloak 26 extraído fora do repositório e JDK 21.
#
# O realm versionado (keycloak/realm-matriz.json) não tem palavras-passe (SEC08, AGENTS.md §7).
# Depois de o Keycloak arrancar, este script define a palavra-passe das contas fictícias através
# da API de administração. Os valores vêm do ambiente ou, em falta, do .env local na raiz do
# repositório (fora do Git); nunca são escritos em ficheiros versionados, na linha de comandos nem no output.
#
#   KEYCLOAK_HOME            pasta do Keycloak (p. ex. C:\...\keycloak-26.8.1)
#   KEYCLOAK_JAVA_HOME       pasta do JDK 21
#   KEYCLOAK_ADMIN_USER      administrador do realm master; criado no primeiro arranque
#   KEYCLOAK_ADMIN_PASSWORD  palavra-passe desse administrador
#   MATRIZ_DEMO_PASSWORD     palavra-passe das contas fictícias do realm matriz
#
# Uso:
#   ./scripts/keycloak-dev.ps1 [-Port 8080]
#
# O JAVA_HOME e as variáveis de arranque do Keycloak são definidos só durante a execução
# e repostos no fim; a configuração do sistema não é alterada. Para parar: Ctrl+C.

param(
  [string]$KeycloakHome,
  [string]$JavaHome,
  [int]$Port = 8080,
  [int]$StartTimeoutSeconds = 180
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent

# Valores do .env local (KEY=VALUE; ignora comentários e linhas vazias).
$dotEnv = @{}
$dotEnvPath = Join-Path $repoRoot '.env'
if (Test-Path $dotEnvPath) {
  foreach ($line in Get-Content $dotEnvPath -Encoding UTF8) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
      $dotEnv[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
    }
  }
}

function Get-Setting([string]$Name, [string]$Explicit) {
  if ($Explicit) { return $Explicit }
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ($value) { return $value }
  if ($dotEnv.ContainsKey($Name) -and $dotEnv[$Name]) { return $dotEnv[$Name] }
  throw "Falta ${Name}: defina-o no ambiente ou no .env local (ver .env.example)."
}

$KeycloakHome = Get-Setting 'KEYCLOAK_HOME' $KeycloakHome
$JavaHome = Get-Setting 'KEYCLOAK_JAVA_HOME' $JavaHome
$adminUser = Get-Setting 'KEYCLOAK_ADMIN_USER' $null
$adminPassword = Get-Setting 'KEYCLOAK_ADMIN_PASSWORD' $null
$demoPassword = Get-Setting 'MATRIZ_DEMO_PASSWORD' $null

if (-not (Test-Path (Join-Path $KeycloakHome 'bin\kc.bat'))) {
  throw "KEYCLOAK_HOME não aponta para uma pasta do Keycloak: $KeycloakHome"
}
if (-not (Test-Path (Join-Path $JavaHome 'bin\java.exe'))) {
  throw "KEYCLOAK_JAVA_HOME não aponta para um JDK: $JavaHome"
}

$realmFile = Join-Path $repoRoot 'keycloak\realm-matriz.json'
$realm = Get-Content $realmFile -Raw -Encoding UTF8 | ConvertFrom-Json
$import = Join-Path $KeycloakHome 'data\import'
New-Item -ItemType Directory -Force $import | Out-Null
Copy-Item $realmFile $import -Force

$saved = @{
  JAVA_HOME                   = $env:JAVA_HOME
  KC_BOOTSTRAP_ADMIN_USERNAME = $env:KC_BOOTSTRAP_ADMIN_USERNAME
  KC_BOOTSTRAP_ADMIN_PASSWORD = $env:KC_BOOTSTRAP_ADMIN_PASSWORD
}
$keycloak = $null
try {
  $env:JAVA_HOME = $JavaHome
  # Só têm efeito no primeiro arranque, quando o realm master ainda não tem administrador.
  $env:KC_BOOTSTRAP_ADMIN_USERNAME = $adminUser
  $env:KC_BOOTSTRAP_ADMIN_PASSWORD = $adminPassword

  $keycloak = Start-Process -FilePath (Join-Path $KeycloakHome 'bin\kc.bat') `
    -ArgumentList 'start-dev', '--http-port', $Port, '--import-realm' `
    -NoNewWindow -PassThru

  # Espera que o realm matriz responda.
  $base = "http://localhost:$Port"
  $deadline = (Get-Date).AddSeconds($StartTimeoutSeconds)
  $ready = $false
  while (-not $ready) {
    if ($keycloak.HasExited) { throw 'O Keycloak terminou durante o arranque; ver o output acima.' }
    if ((Get-Date) -gt $deadline) { throw "O Keycloak não respondeu em $StartTimeoutSeconds s." }
    try {
      Invoke-RestMethod "$base/realms/matriz/.well-known/openid-configuration" -TimeoutSec 5 | Out-Null
      $ready = $true
    } catch {
      Start-Sleep -Seconds 3
    }
  }

  # Token de administração (pedido no corpo HTTP, não na linha de comandos).
  $token = (Invoke-RestMethod -Method Post "$base/realms/master/protocol/openid-connect/token" -Body @{
      grant_type = 'password'
      client_id  = 'admin-cli'
      username   = $adminUser
      password   = $adminPassword
    }).access_token
  $headers = @{ Authorization = "Bearer $token" }
  $body = @{ type = 'password'; value = $demoPassword; temporary = $false } | ConvertTo-Json

  foreach ($user in $realm.users) {
    $found = Invoke-RestMethod -Headers $headers `
      "$base/admin/realms/matriz/users?username=$([uri]::EscapeDataString($user.username))&exact=true"
    if (-not $found) { throw "Conta $($user.username) não encontrada no realm matriz." }
    Invoke-RestMethod -Method Put -Headers $headers -ContentType 'application/json' -Body $body `
      "$base/admin/realms/matriz/users/$($found[0].id)/reset-password" | Out-Null
  }
  $token = $null; $headers = $null; $body = $null

  Write-Host ''
  Write-Host "Keycloak pronto em $base (realm matriz). Palavra-passe definida para: $(($realm.users | ForEach-Object username) -join ', ')."
  Write-Host 'Ctrl+C para parar.'
  Wait-Process -Id $keycloak.Id
} finally {
  foreach ($name in $saved.Keys) {
    [Environment]::SetEnvironmentVariable($name, $saved[$name], 'Process')
  }
  if ($keycloak -and -not $keycloak.HasExited) {
    # kc.bat corre num cmd; termina também o java filho.
    & taskkill.exe /PID $keycloak.Id /T /F 2>$null | Out-Null
  }
}
