# Memory RAG（macOS）

- 记忆根：`$HOME/.openclaw/workspace/memory/`
- 任务补充：`$HOME/tasks/**`（若 `openclaw.json` memorySearch.extraPaths 已含）
- 写入日记：`memory/YYYY-MM-DD.md`；重要结论同步到 `MEMORY.md`（若工作区有）。
- 检索优先走 OpenClaw memorySearch；失败再 `rg`/`grep` 本地文件。
