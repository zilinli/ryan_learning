# Spark one-click OpenClaw install + pair back to spark-tutor (Windows).
# Installs full unified assistant (skills, workbench, WeChat) from assistant/ module.
#
# Usage:
#   $env:SPARK_PAIR_CODE='XXXXXXXX'
#   $env:SPARK_URL='https://spark-tutor-for-ryan.duckdns.org'
#   iwr -useb $env:SPARK_URL/install/windows.ps1 | iex
$ErrorActionPreference = "Stop"
$SparkUrl = ($env:SPARK_URL -replace '/$', '')
if (-not $SparkUrl) { $SparkUrl = "https://spark-tutor-for-ryan.duckdns.org" }
$PairCode = $env:SPARK_PAIR_CODE
if (-not $PairCode) { throw "Set SPARK_PAIR_CODE first (from https://spark-tutor-for-ryan.duckdns.org/deploy )" }

Write-Host "Spark URL: $SparkUrl"
Write-Host "Pair code: $PairCode"

$ticket = Invoke-RestMethod -Method Post -Uri "$SparkUrl/api/nodes/install-ticket" -ContentType "application/json" -Body (@{ pairCode = $PairCode } | ConvertTo-Json)
$keys = $ticket.keys
if (-not $keys) { throw "install ticket returned no keys" }

$HomeDir = $env:USERPROFILE
$ConfigDst = Join-Path $HomeDir ".openclaw"
$BridgeDir = Join-Path $ConfigDst "bridge"
New-Item -ItemType Directory -Force -Path $ConfigDst, (Join-Path $ConfigDst "workspace"), (Join-Path $ConfigDst "cursor"), $BridgeDir | Out-Null

$envFile = Join-Path $ConfigDst ".env"
@"
DEEPSEEK_API_KEY='$($keys.DEEPSEEK_API_KEY)'
DASHSCOPE_API_KEY='$($keys.DASHSCOPE_API_KEY)'
CURSOR_API_KEY='$($keys.CURSOR_API_KEY)'
DEAPI_API_KEY='$($keys.DEAPI_API_KEY)'
"@ | Set-Content -Path $envFile -Encoding UTF8
Write-Host "Wrote $envFile"

[System.Environment]::SetEnvironmentVariable("DEEPSEEK_API_KEY", $keys.DEEPSEEK_API_KEY, "User")
[System.Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", $keys.DASHSCOPE_API_KEY, "User")
[System.Environment]::SetEnvironmentVariable("CURSOR_API_KEY", $keys.CURSOR_API_KEY, "User")
[System.Environment]::SetEnvironmentVariable("DEAPI_API_KEY", $keys.DEAPI_API_KEY, "User")
$env:DEEPSEEK_API_KEY = $keys.DEEPSEEK_API_KEY
$env:DASHSCOPE_API_KEY = $keys.DASHSCOPE_API_KEY
$env:CURSOR_API_KEY = $keys.CURSOR_API_KEY
$env:DEAPI_API_KEY = $keys.DEAPI_API_KEY

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { throw "Node.js/npm not found. Install Node 22+ from https://nodejs.org then re-run." }

Write-Host "Installing OpenClaw CLI..."
npm install -g openclaw@latest

Write-Host "Installing full OpenClaw assistant workspace..."
$assistTar = Join-Path $env:TEMP "spark-assistant.tar.gz"
$assistTmp = Join-Path $env:TEMP "spark-assistant"
Invoke-WebRequest -UseBasicParsing -Uri "$SparkUrl/install/assistant.tar.gz" -OutFile $assistTar
if (Test-Path $assistTmp) { Remove-Item $assistTmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $assistTmp | Out-Null
tar xzf $assistTar -C $assistTmp
node (Join-Path $assistTmp "assistant/install.mjs")
Remove-Item $assistTar -Force -ErrorAction SilentlyContinue
Remove-Item $assistTmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Downloading Spark Bridge..."
Invoke-WebRequest -UseBasicParsing -Uri "$SparkUrl/install/spark-bridge.mjs" -OutFile (Join-Path $BridgeDir "index.mjs")
$startCmd = Join-Path $BridgeDir "start.cmd"
@"
@echo off
set SPARK_URL=$SparkUrl
set SPARK_PAIR_CODE=$PairCode
cd /d $BridgeDir
node index.mjs
"@ | Set-Content $startCmd -Encoding ASCII

$taskName = "SparkBridge"
schtasks /Delete /TN $taskName /F 2>$null | Out-Null
schtasks /Create /TN $taskName /SC ONLOGON /RL LIMITED /TR "`"$startCmd`"" /F | Out-Null
Start-Process -FilePath "cmd.exe" -ArgumentList "/c `"$startCmd`"" -WindowStyle Hidden

Write-Host "Installing Spark Bridge watchdog..."
$watchPs1 = Join-Path $BridgeDir "watchdog.ps1"
Invoke-WebRequest -UseBasicParsing -Uri "$SparkUrl/install/spark-bridge-watchdog.ps1" -OutFile $watchPs1
$watchTask = "SparkBridgeWatchdog"
$watchTr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$watchPs1`""
schtasks /Delete /TN $watchTask /F 2>$null | Out-Null
schtasks /Create /TN $watchTask /SC MINUTE /MO 1 /RL LIMITED /TR $watchTr /F | Out-Null
schtasks /Run /TN $watchTask 2>$null | Out-Null

Write-Host "Spark Bridge started (ONLOGON task + 1-min watchdog). Open $SparkUrl/deploy — node should go online."
Write-Host "Then chat at $SparkUrl/control"
Write-Host "Keep Windows user session available at logon; watchdog restarts Bridge if it dies."
