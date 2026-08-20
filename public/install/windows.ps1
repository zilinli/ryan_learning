# Spark one-click OpenClaw install + pair back to spark-tutor.
#
# Reference only (not integrated): zilinli/ai_assistant_win was read for paths
# (~/.openclaw, .env, gateway, Windows scheduled task). This script does NOT
# git clone that repo, does NOT run install.ps1, and does NOT copy
# openclaw-config / skills / workbench. Pairing + Spark Bridge only.
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

# Persist user env so gateway/bridge inherit keys
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

$cfg = Join-Path $ConfigDst "openclaw.json"
$ws = (Join-Path $ConfigDst "workspace") -replace '\\', '/'
$tasks = (Join-Path $HomeDir "tasks") -replace '\\', '/'
New-Item -ItemType Directory -Force -Path (Join-Path $HomeDir "tasks") | Out-Null
if (-not (Test-Path $cfg)) {
  $openclawJson = @{
    agents = @{
      defaults = @{
        workspace = $ws
        model     = @{ primary = "deepseek/deepseek-v4-flash"; fallbacks = @("qwen/qwen3.5-plus") }
      }
      list = @(@{ id = "main" })
    }
    gateway = @{ mode = "local"; port = 18789; bind = "loopback"; auth = @{ mode = "token"; token = [guid]::NewGuid().ToString("N") } }
    plugins = @{
      entries = @{
        deepseek          = @{ enabled = $true }
        qwen              = @{ enabled = $true }
        "openclaw-weixin" = @{ enabled = $false }
      }
      allow = @("deepseek", "qwen")
    }
    models  = @{
      mode      = "merge"
      providers = @{
        deepseek = @{ baseUrl = "https://api.deepseek.com"; api = "openai-completions"; models = @(@{ id = "deepseek-v4-flash"; name = "DeepSeek V4 Flash" }) }
        qwen     = @{ baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1"; api = "openai-completions"; apiKey = '${DASHSCOPE_API_KEY}'; models = @(@{ id = "qwen3.5-plus"; name = "Qwen3.5 Plus" }) }
      }
    }
  }
  ($openclawJson | ConvertTo-Json -Depth 20) | Set-Content $cfg -Encoding UTF8
}

Write-Host "Installing model plugins (no WeChat)..."
try { openclaw plugins install @openclaw/deepseek-provider } catch { Write-Warning $_ }
try { openclaw plugins install @openclaw/qwen-provider } catch { Write-Warning $_ }

Write-Host "Gateway install..."
try { openclaw gateway install } catch { }
try { openclaw gateway restart } catch { try { openclaw gateway start } catch { } }

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
Write-Host "Spark Bridge started. Open $SparkUrl/deploy — node should go online."
Write-Host "Then chat at $SparkUrl/control"
