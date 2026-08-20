---
name: memory-rag
description: "记忆检索与整理：回答涉及历史结论、之前任务、用户偏好、以前做过什么的问题前，先用 openclaw memory search 检索记忆/任务目录（~/.openclaw/workspace/memory + ~/tasks），并定期整理 memory 到 MEMORY.md。当用户问'之前/上次/以前/我让你做过'或需要回忆起跨会话上下文时使用。"
---

# Memory RAG（记忆检索与整理）

把文件式记忆升级为**可检索记忆**：会话开始与回答问题前主动检索，靠 DashScope `text-embedding-v4` 做向量嵌入 + FTS 混合检索。

## 检索时机

- 用户问题涉及"之前 / 上次 / 以前 / 我记得 / 你做过"等跨会话上下文时。
- 用户问项目相关的技术决策、偏好、人物信息时。
- 接新任务前，检索该任务主题是否已有历史产物（`~/tasks` 已纳入索引）。

## 检索方法

```bash
# 关键词/语义混合搜索（结果含来源路径）
openclaw memory search "<查询词>" --max-results 6 --agent main

# 需要 JSON 时
openclaw memory search "<查询词>" --json --max-results 6 --agent main
```

- 优先用自然语言短句作为查询词（如"WorkBuddy 对比结论"、"Ryan 学习助手"）。
- 命中后引用 `Source: <路径#行号>` 说明出处。
- 检索不到不要硬编：如实说"没有相关历史记录"，并建议用户确认。

## 索引维护

```bash
# 查看索引健康
openclaw memory status --agent main

# 强制重建（改配置后需要）
openclaw memory index --force --agent main
```

- 索引变更会自动触发重建；向量索引与 provider 不匹配时搜索会暂停，此时按提示重建。
- 本机 embedding 走百炼 `text-embedding-v4`（`DASHSCOPE_API_KEY`），零额外成本。
- 若 DashScope 不可用，向量搜索会失败闭合（fail closed），此时可临时将 `agents.defaults.memorySearch.provider` 改为 `none` 退化为纯 FTS 关键词检索。

## 记忆整理（定期）

- 每 2-3 天把 `memory/YYYY-MM-DD.md` 中有长期价值的结论折叠进 `MEMORY.md`。
- 可用 `openclaw memory promote` 查看短时记忆候选，选择性地把高价值条目提升到 `MEMORY.md`。

## 数据源范围

- 默认：`MEMORY.md` + `memory/*.md`（workspace）
- 额外：`~/tasks/**/*.md`（任务产物，交付物可被检索）
- 会话记录（sessions）默认不索引，避免成本与隐私扩散；需要时再开 `agents.defaults.memorySearch.experimental.sessionMemory`。
