# 一键备份 AI 助理配置到 Git 仓库（Windows）
# 用法: powershell -File path/to/ryan_learning/assistant/platforms/win32/backup.ps1
$ErrorActionPreference = "Stop"

$RepoDir = if ($env:ASSISTANT_REPO) { $env:ASSISTANT_REPO } else { (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path }
$ConfigSrc = Join-Path $env:USERPROFILE ".openclaw"
$Ws = Join-Path $ConfigSrc "workspace"
$WorkbenchSrc = Join-Path $env:USERPROFILE "openclaw-workbench"

Set-Location $RepoDir

Write-Host "[1/3] 同步配置..."
New-Item -ItemType Directory -Force -Path "openclaw-config\cursor" | Out-Null
New-Item -ItemType Directory -Force -Path "openclaw-config\workspace" | Out-Null
New-Item -ItemType Directory -Force -Path "openclaw-config\workspace\memory" | Out-Null

Copy-Item (Join-Path $ConfigSrc "openclaw.json") "openclaw-config\" -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ConfigSrc "openclaw.json.bak") "openclaw-config\" -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ConfigSrc "openclaw.json.last-good") "openclaw-config\" -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ConfigSrc "cursor\cursor-run.mjs") "openclaw-config\cursor\" -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $ConfigSrc "cursor\package.json") "openclaw-config\cursor\" -Force -ErrorAction SilentlyContinue

foreach ($f in @("AGENTS.md", "WEIXIN_COMMANDS.md", "HEARTBEAT.md", "IDENTITY.md", "SOUL.md", "TOOLS.md", "USER.md")) {
  Copy-Item (Join-Path $Ws $f) "openclaw-config\workspace\" -Force -ErrorAction SilentlyContinue
}

if (Test-Path (Join-Path $Ws "skills")) {
  Remove-Item "openclaw-config\workspace\skills" -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Ws "skills") "openclaw-config\workspace\skills" -Recurse -Force
}

if (Test-Path (Join-Path $Ws "memory")) {
  Copy-Item (Join-Path $Ws "memory\*") "openclaw-config\workspace\memory\" -Force -ErrorAction SilentlyContinue
}

if (Test-Path $WorkbenchSrc) {
  Remove-Item "openclaw-config\workbench" -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path "openclaw-config\workbench" | Out-Null
  Copy-Item (Join-Path $WorkbenchSrc "*") "openclaw-config\workbench\" -Recurse -Force
  Remove-Item "openclaw-config\workbench\history.json" -ErrorAction SilentlyContinue
  Remove-Item "openclaw-config\workbench\workbench.log" -ErrorAction SilentlyContinue
  Remove-Item "openclaw-config\workbench\sessions.json" -ErrorAction SilentlyContinue
  Remove-Item "openclaw-config\workbench\workbench.pid" -ErrorAction SilentlyContinue
}

Write-Host "[2/3] 提交变更..."
$msg = "backup $(Get-Date -Format 'yyyy-MM-dd_HHmm')"
git add -A
$staged = git diff --cached --quiet; $code = $LASTEXITCODE
if ($code -eq 0) {
  Write-Host "无变更，跳过提交"
} else {
  git commit -m $msg
}

Write-Host "[3/3] 推送到 GitHub（可选）..."
try {
  git push
  Write-Host "备份完成: $(git rev-parse --short HEAD)"
} catch {
  Write-Warning "push 失败（可稍后手动 git push）: $_"
  Write-Host "本地提交已完成（若有变更）"
}
