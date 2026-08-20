# Cost Tracker（费用记账 · Windows）

## 记录方法

```powershell
$dir = "$env:USERPROFILE\openclaw-costs"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$csv = Join-Path $dir ("{0}.csv" -f (Get-Date -Format yyyy-MM))
if (-not (Test-Path $csv)) {
  "日期,时间,任务,模型,输入tokens,输出tokens,预估费用(元)" | Set-Content $csv -Encoding UTF8
}
$line = "{0},{1},<任务名>,<模型id>,<in>,<out>,<费用>" -f (Get-Date -Format yyyy-MM-dd), (Get-Date -Format HH:mm)
Add-Content $csv $line -Encoding UTF8
```

## 费率参考

| 模型 | 输入 | 输出 | 缓存读 |
|---|---|---|---|
| deepseek-v4-flash | 0.14 | 0.28 | 0.028 |
| deepseek-v4-pro | 1.74 | 3.48 | 0.145 |
| qwen3.5-plus | 见百炼控制台 | 同左 | - |

费用：`输入/1e6 * 输入单价 + 输出/1e6 * 输出单价`。无法精确时估算并标注。

## 规则

- 只在大任务或用户要求时记账。
- 可把费用文件放 `%USERPROFILE%\tasks\costs\` 便于 memory-rag 检索。
