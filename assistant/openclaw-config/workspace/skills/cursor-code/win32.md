# Cursor Code（Windows）

## 前置

- 脚本: `%USERPROFILE%\.openclaw\cursor\cursor-run.mjs`
- 依赖: `@cursor/sdk` 已安装在 `%USERPROFILE%\.openclaw\cursor\node_modules`
- 密钥: `CURSOR_API_KEY`（`%USERPROFILE%\.openclaw\.env`）

自检：

```powershell
node -e "import('file:///C:/Users/Ryan/.openclaw/cursor/node_modules/@cursor/sdk/dist/index.js').then(()=>console.log('OK')).catch(e=>console.error(e))"
# 或
cd $env:USERPROFILE\.openclaw\cursor; node -e "require('@cursor/sdk'); console.log('OK')"
```

## 工作流

1. 解析用户请求，确定目标项目目录（未指定时默认 `D:\codes` 下按项目名推断，或最近项目）。
2. 按 `task-deliver` 建任务目录（可选），把完整 prompt 写入临时文件。
3. 加载环境变量并运行：

```powershell
$envFile = "$env:USERPROFILE\.openclaw\.env"
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k,$v = $_.Split('=',2)
  $v = $v.Trim().Trim("'").Trim('"')
  Set-Item -Path "Env:$($k.Trim())" -Value $v
}
$TASK = Join-Path $env:TEMP ("cursor-prompt-{0}.txt" -f [guid]::NewGuid())
Set-Content -Path $TASK -Value $prompt -Encoding UTF8
node "$env:USERPROFILE\.openclaw\cursor\cursor-run.mjs" --cwd "<目标项目目录>" --prompt-file $TASK
```

4. 解析输出中的 `[CURSOR_RESULT]`，汇总改动文件与结果回传用户。

## 规则

- 破坏性操作前确认。
- 若 `CURSOR_API_KEY` 缺失，检查 `.env` 与 `cursor` 目录。
