# Agent Chat Console — 技术方案与接口设计

> **版本**: v0.1.0 | **日期**: 2026-08-04 | **依赖**: [架构设计](./architecture.md)

---

## 1. 技术栈

| 层级 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **前端框架** | Next.js (App Router) | 16.x | 与 Spark 一致；SSR/SSG 可选、API Routes 内置 |
| **UI 样式** | Tailwind CSS | 4.x | 原子化 CSS、暗色主题默认、与 Spark 一致 |
| **Markdown 渲染** | react-markdown + remark-gfm | 10.x | 代码块高亮、Agent 输出友好渲染 |
| **语音输入** | Web Speech API + 服务端 STT 降级 | — | 浏览器原生（低延迟）+ Whisper/SenseVoice（高精度） |
| **AI Agent** | @cursor/sdk | ^1.0.26 | Cursor IDE 官方 SDK、流式输出、工具编排 |
| **HTTP 流式** | SSE (Server-Sent Events) | — | 浏览器原生 EventSource、单向流式、自动重连 |
| **运行时** | Node.js | 22.x | 服务器已有 |
| **测试** | Vitest | 4.x | 与 Spark 共享配置 |
| **代码检查** | ESLint 9 + TypeScript 5 | — | 严格模式 |

---

## 2. 项目结构

```
/root/codes/ryan_learning/
│
├── agent-chat/                      # ★ 新子项目
│   ├── package.json                 # 独立依赖（复用根 node_modules 的 @cursor/sdk）
│   ├── next.config.ts               # 端口 3001 配置
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts           # 暗色主题默认（类 Cursor IDE）
│   ├── docs/                        # 本文档目录
│   │   ├── architecture.md
│   │   ├── tech-design.md           # ← 本文件
│   │   ├── ui-ux.md
│   │   ├── data-design.md
│   │   └── README.md
│   ├── data/                        # 运行时数据
│   │   └── conversations/           # 对话历史 JSON 文件
│   ├── logs/                        # 运行日志
│   │   ├── service.log
│   │   └── agent.log                # Agent 调用审计日志
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── globals.css
│   │   │   └── api/
│   │   │       ├── chat/route.ts
│   │   │       ├── transcribe/route.ts
│   │   │       ├── tts/route.ts
│   │   │       ├── workspace/route.ts
│   │   │       ├── workspace/file/route.ts
│   │   │       └── history/route.ts
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── WorkspaceSidebar.tsx
│   │   │   ├── Composer.tsx
│   │   │   ├── VoiceConfirmModal.tsx
│   │   │   └── FilePreview.tsx
│   │   └── lib/
│   │       ├── agent.ts
│   │       ├── prompts.ts
│   │       ├── workspace.ts
│   │       ├── history-store.ts
│   │       ├── types.ts
│   │       └── stt.ts
│   └── public/                      # 静态资源
│       └── favicon.ico
│
├── src/                             # Spark 项目（不动）
├── scripts/                         # 共享脚本
│   ├── stt_server.py                # ★ 共享 STT 服务
│   └── ...
├── node_modules/                    # 根依赖（含 @cursor/sdk）
└── package.json                     # 根 package.json（Spark）
```

---

## 3. API 接口详细设计

### 3.1 `POST /api/chat` — 流式对话

**请求体** (JSON):

```typescript
interface ChatRequest {
  message: string;                     // 用户消息（文字）
  sessionId?: string;                  // 会话 ID（留空则新建）
  workspacePath?: string;              // 工作目录，默认 /root/codes/ryan_learning
  attachments?: {                      // 附件（暂不支持，预留）
    name: string;
    mimeType: string;
    data: string;                      // base64
  }[];
}
```

**响应** (SSE `text/event-stream`):

```
event: status
data: {"type":"thinking","message":"正在分析你的请求..."}

event: delta
data: {"content":"好的，我来"}

event: delta
data: {"content":"帮你创建后端项目..."}

event: tool_use
data: {"tool":"run_command","input":"mkdir -p agent-chat/src","output":"Created directory"}

event: delta
data: {"content":"\n\n目录已创建成功！"}

event: done
data: {"sessionId":"abc-123","messageCount":4}
```

**SSE 事件类型**:

| Event | 含义 | 数据结构 |
|-------|------|----------|
| `status` | 状态通知（thinking/executing/done） | `{ type: string, message: string }` |
| `delta` | 文本增量输出 | `{ content: string }` |
| `tool_use` | Agent 工具调用记录 | `{ tool: string, input: any, output?: string }` |
| `error` | 错误信息 | `{ code: string, message: string }` |
| `done` | 本次回复结束 | `{ sessionId: string, messageCount: number }` |

**实现要点**:

```typescript
// agent-chat/src/app/api/chat/route.ts

export async function POST(req: Request) {
  const { message, sessionId, workspacePath } = await req.json();

  // 1. 构建 System Prompt
  const systemPrompt = buildSystemPrompt({
    workspacePath: workspacePath || DEFAULT_WORKSPACE,
    osInfo: getSystemInfo(),
  });

  // 2. 创建或恢复 Cursor Agent
  const agent = sessionId
    ? await Agent.resume(sessionId)
    : await Agent.create({
        model: "claude-sonnet-4-20250514",
        systemPrompt,
        workspacePath,
      });

  // 3. SSE 流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of agent.stream(message)) {
          if (event.type === "text") {
            controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ content: event.content })}\n\n`));
          } else if (event.type === "tool_use") {
            controller.enqueue(encoder.encode(`event: tool_use\ndata: ${JSON.stringify(event)}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`event: done\ndata: ${JSON.stringify({ sessionId: agent.id })}\n\n`));
      } catch (err) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### 3.2 `POST /api/transcribe` — 语音识别

**请求体**: `multipart/form-data`
- `audio`: WAV 音频文件（16kHz, mono, 16-bit PCM）
- `language`: `"zh"` | `"en"` | `"auto"`（默认 auto）

**响应** (JSON):

```typescript
interface TranscribeResponse {
  text: string;                        // 识别文本
  language: string;                    // 检测到的语言
  confidence: number;                  // 置信度 0-1
}
```

**实现**: 转发到 STT Server (`http://localhost:8765/transcribe`)，超时 10s，失败返回 502。

### 3.3 `POST /api/tts` — 语音合成

**请求体** (JSON):

```typescript
interface TTSRequest {
  text: string;                        // 要朗读的文本
  voice?: string;                      // 语音角色名，默认 "auto"
}
```

**响应**: `audio/mpeg` 二进制流。

### 3.4 `GET /api/workspace` — 工作区文件树

**查询参数**:
- `path` (string, 可选): 子目录路径，默认 `/root/codes/ryan_learning`

**响应** (JSON):

```typescript
interface WorkspaceTree {
  path: string;
  name: string;
  type: "directory" | "file";
  size?: number;                       // 文件大小 (bytes)
  children?: WorkspaceTree[];          // 目录子节点
}

// 示例
{
  "path": "/root/codes/ryan_learning",
  "name": "ryan_learning",
  "type": "directory",
  "children": [
    { "path": ".../agent-chat", "name": "agent-chat", "type": "directory", "children": [...] },
    { "path": ".../package.json", "name": "package.json", "type": "file", "size": 1817 },
    { "path": ".../src", "name": "src", "type": "directory", "children": [...] }
  ]
}
```

**过滤规则**:
- 忽略 `node_modules`、`.next`、`.git`、`__pycache__`
- 忽略以 `.` 开头的隐藏文件（`.env.local`、`.DS_Store` 等）
- 忽略 `config/secret.bin`
- 单层最多返回 200 个子节点（超出截断）

### 3.5 `GET /api/workspace/file` — 读取文件内容

**查询参数**:
- `path` (string, 必填): 文件的绝对路径
- `encoding` (string, 可选): `"utf8"` (默认) | `"base64"`

**响应** (JSON):

```typescript
interface FileContent {
  path: string;
  size: number;
  mimeType: string;
  content: string;                     // utf8 文本或 base64 编码
  lines: number;                       // 行数（仅文本文件）
  language: string;                    // 代码语言标识（ts/js/py/json 等）
}
```

**安全校验**:
1. 路径必须在 `/root/codes/ryan_learning` 目录内
2. 拒绝读取 `node_modules`、`.git`、`.env`、`secret.bin` 下的文件
3. 文件最大 1MB 才返回内容（超大文件返回 `{ error: "FILE_TOO_LARGE" }`）
4. 二进制文件（通过魔数检测）自动用 base64 编码

### 3.6 `GET/PUT/DELETE /api/history` — 对话历史

与 Spark 项目 `api/history` 接口保持一致：

**GET**: 列出/搜索会话  
**PUT**: 创建/更新会话  
**DELETE**: 删除会话（`?sessionId=xxx`）

**会话数据结构**:

```typescript
interface Conversation {
  sessionId: string;
  agentId: string;                     // Cursor Agent ID
  title: string;                       // 自动生成标题（用户首条消息截取）
  createdAt: string;                   // ISO 8601
  updatedAt: string;
  messages: Message[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;                     // Markdown 格式
  toolCalls?: {                        // Agent 工具调用记录
    tool: string;
    input: any;
    output?: string;
  }[];
  timestamp: string;
}
```

---

## 4. System Prompt 设计

### 4.1 设计原则

1. **编码优先**: Agent 的默认角色是编程助手，不是通用对话机器人
2. **上下文感知**: 自动注入工作区状态（文件树、操作系统信息）
3. **安全边界**: 禁止执行危险操作（rm -rf、fork bomb 等）

### 4.2 Prompt 模板

```markdown
You are Cursor, an AI coding assistant running on a Linux server.

## Environment
- OS: {{osInfo}}
- Workspace: {{workspacePath}}
- Default working directory: {{workspacePath}}

## Workspace Context
The current workspace structure:
```
{{fileTreeSummary}}
```

## Rules
1. You can read, write, and modify files in the workspace
2. You have access to shell commands (npm, git, python3, node, ls, etc.)
3. NEVER execute destructive commands without explicit user confirmation
4. When creating new files, ensure parent directories exist
5. All code should follow the project's existing conventions (TypeScript, ESLint, etc.)
6. Explain your changes clearly, but don't be overly verbose
7. If a user asks for something outside your capabilities, explain honestly

## Current Request
User says: {{userMessage}}

Respond in the same language as the user's message (Chinese for Chinese, English for English).
```

### 4.3 工具集

Cursor Agent 默认具备以下工具（由 `@cursor/sdk` 提供）：

| 工具 | 说明 | 权限 |
|------|------|------|
| `read_file` | 读取文件内容 | 允许 |
| `write_file` | 写入/创建文件 | 允许 |
| `edit_file` | 编辑文件（搜索替换） | 允许 |
| `list_directory` | 列出目录内容 | 允许 |
| `search_code` | 搜索代码（grep/ripgrep） | 允许 |
| `run_shell` | 执行 Shell 命令 | 允许（有限制） |
| `web_search` | 网络搜索 | 允许 |
| `web_fetch` | 抓取网页 | 允许 |

---

## 5. 启动脚本

### 5.1 `start.sh`

```bash
#!/bin/bash
# Agent Chat Console — 启动脚本
cd "$(dirname "$0")"

PORT=${ACC_PORT:-3001}

echo "🚀 Starting Agent Chat Console on port $PORT..."
echo "Workspace: /root/codes/ryan_learning"

# 确保 .env.local 有 API KEY（复用 Spark 的 ensure-env）
node ../scripts/ensure-env.mjs

# 启动开发服务器
npx next dev -p $PORT -H 0.0.0.0
```

### 5.2 环境变量

```bash
# .env.local
CURSOR_API_KEY=crsr_...               # 复用 Spark 的 KEY
ACC_PORT=3001                          # 可选，默认 3001
ACC_WORKSPACE=/root/codes/ryan_learning # 默认工作目录
```

---

## 6. 错误处理

| 错误场景 | HTTP 状态码 | 前端处理 |
|----------|-------------|----------|
| API Key 未配置 | 401 | 显示 SetupPanel |
| Agent 创建失败 | 500 | 显示错误提示 + 重试按钮 |
| Agent 超时（120s 无响应） | 504 | 自动重试一次 |
| SSE 连接断开 | — | EventSource 自动重连 |
| 文件不存在 | 404 | 显示 "文件不存在" |
| 路径穿越尝试 | 403 | 拒绝访问 |
| 文件过大（>1MB） | 413 | 显示 "文件过大，无法预览" |
| STT Server 不可用 | 502 | 前端降级到 Web Speech API |
| 工作区不可访问 | 500 | 显示 "无法访问工作区" |

---

## 7. 审计日志

所有 Agent 的命令执行记录到 `agent-chat/logs/agent.log`：

```json
{
  "timestamp": "2026-08-04T00:12:00.000Z",
  "sessionId": "abc-123",
  "userMessage": "帮我在 agent-chat 下创建 src 目录",
  "toolCalls": [
    { "tool": "run_shell", "input": "mkdir -p agent-chat/src", "output": "success" }
  ],
  "filesModified": [],
  "duration": 3200
}
```

---

> **下一步**: 参见 [前端交互与 UI 设计](./ui-ux.md)
