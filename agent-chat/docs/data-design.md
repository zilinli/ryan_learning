# Agent Chat Console — 数据与存储设计

> **版本**: v0.1.0 | **日期**: 2026-08-04

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **零数据库依赖** | 不使用 MySQL/PostgreSQL/SQLite，降低运维成本 |
| **文件系统存储** | JSON 文件持久化，与 Spark 项目的存储策略一致 |
| **单用户场景** | 本地部署、单用户使用，无需用户认证/多租户 |
| **可审计** | 所有 Agent 操作记录到日志文件，方便回溯 |
| **易迁移** | JSON 格式可读可迁移，必要时可导入数据库 |

---

## 2. 存储架构

```
/root/codes/ryan_learning/agent-chat/
│
├── data/
│   ├── conversations/                    # 对话历史
│   │   ├── session-a1b2c3d4.json         # 每个会话一个 JSON 文件
│   │   ├── session-e5f6g7h8.json
│   │   └── ...
│   ├── session-registry.json             # 会话索引（快速查询）
│   └── .gitkeep
│
├── logs/
│   ├── service.log                       # HTTP 服务运行日志
│   └── agent.log                         # Agent 操作审计日志
│
└── src/lib/
    ├── history-store.ts                  # 对话历史读写封装
    └── session-registry.ts               # 会话索引管理
```

---

## 3. 数据模型

### 3.1 会话索引 `session-registry.json`

```typescript
interface SessionRegistry {
  sessions: SessionMeta[];
  lastUpdated: string;                    // ISO 8601
}

interface SessionMeta {
  sessionId: string;                      // UUID v4
  agentId: string;                        // Cursor Agent ID（用于恢复会话）
  title: string;                          // 首条用户消息截取（前 50 字符）
  messageCount: number;
  createdAt: string;                      // ISO 8601
  updatedAt: string;                      // ISO 8601
  workspacePath: string;                  // 工作目录
}
```

**示例**:

```json
{
  "sessions": [
    {
      "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "agentId": "agent_xyz789",
      "title": "帮我在 agent-chat 下创建一个 Express 后端项目",
      "messageCount": 6,
      "createdAt": "2026-08-04T00:15:00.000Z",
      "updatedAt": "2026-08-04T00:18:30.000Z",
      "workspacePath": "/root/codes/ryan_learning"
    }
  ],
  "lastUpdated": "2026-08-04T00:18:30.000Z"
}
```

### 3.2 会话文件 `session-{id}.json`

```typescript
interface ConversationRecord {
  sessionId: string;
  agentId: string;
  title: string;
  workspacePath: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface Message {
  id: string;                             // UUID v4
  role: "user" | "assistant";
  content: string;                        // Markdown 格式
  toolCalls?: ToolCall[];                 // Agent 工具调用记录
  timestamp: string;                      // ISO 8601
}

interface ToolCall {
  tool: string;                           // 工具名（如 run_shell, read_file）
  input: any;                             // 工具参数
  output?: string;                        // 工具输出
  status: "running" | "success" | "error";
  timestamp: string;
}
```

**文件命名规则**: `session-{sessionId前8位}.json`  
**示例文件名**: `session-a1b2c3d4.json`

**完整示例**:

```json
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "agentId": "agent_xyz789",
  "title": "帮我在 agent-chat 下创建一个 Express 后端项目",
  "workspacePath": "/root/codes/ryan_learning",
  "createdAt": "2026-08-04T00:15:00.000Z",
  "updatedAt": "2026-08-04T00:18:30.000Z",
  "messages": [
    {
      "id": "msg-001",
      "role": "user",
      "content": "帮我在 agent-chat 下创建一个 Express 后端项目，包含基础的 API 路由和中间件",
      "timestamp": "2026-08-04T00:15:00.000Z"
    },
    {
      "id": "msg-002",
      "role": "assistant",
      "content": "好的，我来帮你创建 Express 后端项目。\n\n首先创建项目目录结构...",
      "toolCalls": [
        {
          "tool": "run_shell",
          "input": { "command": "mkdir -p agent-chat/server/src" },
          "output": "success",
          "status": "success",
          "timestamp": "2026-08-04T00:15:05.000Z"
        },
        {
          "tool": "write_file",
          "input": { "path": "agent-chat/server/package.json", "content": "..." },
          "output": "wrote 245 bytes",
          "status": "success",
          "timestamp": "2026-08-04T00:15:10.000Z"
        }
      ],
      "timestamp": "2026-08-04T00:15:15.000Z"
    }
  ]
}
```

---

## 4. 客户端存储（浏览器）

| 存储 | 键 | 用途 |
|------|-----|------|
| `localStorage` | `acc_current_session` | 当前会话 ID |
| `localStorage` | `acc_sidebar_collapsed` | 侧栏折叠状态 |
| `localStorage` | `acc_voice_language` | 语音语言偏好 |
| `sessionStorage` | `acc_workspace_tree_cache` | 文件树缓存（当次会话有效） |

---

## 5. 日志格式

### 5.1 服务日志 `service.log`

标准 JSONL（每行一条 JSON 记录）：

```json
{"level":"info","timestamp":"2026-08-04T00:12:00.000Z","message":"Server started","port":3001}
{"level":"info","timestamp":"2026-08-04T00:15:00.000Z","message":"POST /api/chat","sessionId":"a1b2c3d4"}
{"level":"error","timestamp":"2026-08-04T00:20:00.000Z","message":"Agent timeout","sessionId":"a1b2c3d4","duration":120000}
```

### 5.2 Agent 审计日志 `agent.log`

```json
{
  "timestamp": "2026-08-04T00:15:00.000Z",
  "sessionId": "a1b2c3d4",
  "agentId": "agent_xyz789",
  "userMessage": "帮我在 agent-chat 下创建一个 Express 后端项目",
  "messageLength": 42,
  "toolCalls": [
    { "tool": "run_shell", "input": "mkdir -p agent-chat/server/src", "output": "success" },
    { "tool": "write_file", "input": "agent-chat/server/package.json", "output": "wrote 245 bytes" }
  ],
  "filesModified": [
    "agent-chat/server/package.json",
    "agent-chat/server/src/index.ts"
  ],
  "tokenUsage": { "input": 1240, "output": 560 },
  "duration": 3200,
  "status": "success"
}
```

---

## 6. 数据生命周期

### 6.1 会话创建

```
用户发送第一条消息
  → 生成 UUID v4 sessionId
  → 创建 Cursor Agent → 获得 agentId
  → 写入 session-registry.json（追加一条 SessionMeta）
  → 创建 session-{id}.json（含用户消息）
```

### 6.2 会话追加消息

```
用户发送后续消息（相同 sessionId）
  → 恢复 Cursor Agent（agentId）
  → 流式获取回复
  → 更新 session-{id}.json（追加 messages）
  → 更新 session-registry.json（更新 updatedAt 和 messageCount）
```

### 6.3 会话删除

```
用户点击删除
  → 从 session-registry.json 移除
  → 删除 session-{id}.json 文件
```

### 6.4 会话清理策略

| 规则 | 操作 |
|------|------|
| 超过 30 天的会话 | 自动归档（移到 `data/archive/`） |
| 超过 90 天的归档 | 自动删除 |
| 单会话消息数 > 100 | 保留前 20 + 后 20 条，中间截断 |

---

## 7. 数据安全

| 措施 | 详情 |
|------|------|
| **文件权限** | `data/` 目录 700，文件 600（仅 owner 可读写） |
| **敏感信息过滤** | 对话历史不存储 API Key、密码等；Agent 日志中的 Input 过滤敏感参数 |
| **路径校验** | 文件读写操作通过路径验证函数，防止路径穿越 |
| **内容大小限制** | 单条消息最大 10KB，单会话文件最大 5MB |

---

> **下一步**: 参见 [总体 README 与开发计划](./README.md)
