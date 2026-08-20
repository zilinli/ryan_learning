# Platform extras for Windows after assistant/install.mjs syncs config.
$ErrorActionPreference = "Stop"

$ConfigDst = Join-Path $env:USERPROFILE ".openclaw"
$CursorDst = Join-Path $ConfigDst "cursor"

Write-Host "[win32] Python venv + deps..."
$venvDir = Join-Path $ConfigDst "venv"
$venvPy = Join-Path $venvDir "Scripts\python.exe"
$pyCmd = $null
foreach ($c in @("python", "py")) {
  try {
    $null = & $c --version 2>&1
    if ($LASTEXITCODE -eq 0) { $pyCmd = $c; break }
  } catch {}
}
if (-not $pyCmd) {
  Write-Warning "Python not found; skip venv."
} else {
  if (-not (Test-Path $venvPy)) {
    if ($pyCmd -eq "py") { & py -3 -m venv $venvDir } else { & python -m venv $venvDir }
  }
  & $venvPy -m pip install --upgrade pip -q
  & $venvPy -m pip install -q pandas matplotlib python-pptx pypandoc-binary pyautogui pillow
}

Write-Host "[win32] Cursor npm deps..."
$npm = Get-Command npm -ErrorAction SilentlyContinue
if ($null -ne $npm -and (Test-Path $CursorDst)) {
  Push-Location $CursorDst
  try { npm install --silent 2>$null; if ($LASTEXITCODE -ne 0) { npm install } } finally { Pop-Location }
  try { npm install -g @modelcontextprotocol/server-filesystem } catch {
    Write-Warning "Global MCP install failed; npx fallback OK."
  }
}

Write-Host "[win32] OpenClaw plugins..."
$oc = Get-Command openclaw -ErrorAction SilentlyContinue
if ($null -ne $oc) {
  openclaw plugins install @openclaw/deepseek-provider 2>$null
  openclaw plugins install @openclaw/qwen-provider 2>$null
  openclaw plugins install @openclaw/openclaw-weixin 2>$null
  openclaw gateway install 2>$null
  try { openclaw gateway restart 2>&1 | Out-Host } catch {
    try { openclaw gateway start 2>&1 | Out-Host } catch { Write-Warning $_ }
  }
}

Write-Host "[win32] extras done."
