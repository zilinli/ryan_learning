# Agent Chat Console — 系统架构设计文档

> **版本**: v0.1.0  
> **日期**: 2026-08-04  
> **作者**: SE / Architect  
> **状态**: 设计阶段

---

## 1. 产品定位

**Agent Chat Console**（以下简称 ACC）是一个部署在服务器上的 Web 应用，提供类似 Cursor IDE 中 Agent 窗口的交互体验。用户通过**对话式命令**（支持语音输入）操控本服务器的 Cursor IDE 完成编码任务。

### 1.1 与 Spark 项目的关系

| 维度 | Spark（AI Tutor） | ACC（Agent Console） |
|------|-------------------|----------------------|
| **目标用户** | Ryan（小学四年级学生） | 开发者 / 运维人员 |
| **核心功能** | Socratic 教学辅导 | 命令 Cursor 写代码 |
| **AI Agent** | 教育领域 Agent（BKT 记忆） | 编码领域 Agent（文件系统操作） |
| **工作目录** | 无特定目录 | 默认 `/root/codes/ryan_learning` |
| **端口** | 3000 | **3001（独立端口）** |
| **代码目录** | `src/` | `agent-chat/` |
| **共享能力** | — | 复用 STT/TTS 服务、Cursor SDK、部分库 |

### 1.2 核心用例

1. **语音/文字输入命令** → 在对话框确认 → 发送给 Cursor Agent → 流式返回执行结果
2. **代码生成**: "帮我在 agent-chat/src 下创建一个 Express 后端"
3. **文件操作**: "读取 /root/codes/ryan_learning/package.json 并分析依赖"
4. **调试协助**: "检查 agent-chat 目录下有没有 TypeScript 错误"
5. **工作区浏览**: 显示当前工作目录的文件树，支持点选文件查看内容

---

## 2. 系统架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                      User's Browser                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  AgentChat UI (React / Next.js App Router)             │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐     │  │
│  │  │VoiceInput│  │ ChatThread│  │ WorkspaceBrowser │     │  │
│  │  │(Web API) │  │(Markdown) │  │(FileTree + View) │     │  │
│  │  └─────────┘  └──────────┘  └──────────────────┘     │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │ SSE / POST                        │
└──────────────────────────┼──────────────────────────────────┘
                           │  port 3001
┌──────────────────────────┼──────────────────────────────────┐
│               Server (Node.js / Next.js)                     │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │  API Layer                                             │  │
│  │  POST /api/chat        ← 流式对话（SSE）               │  │
│  │  POST /api/transcribe  ← 语音识别（转发 STT Server）   │  │
│  │  POST /api/tts         ← 语音合成（转发 TTS Server）   │  │
│  │  GET  /api/workspace   ← 工作区文件树                  │  │
│  │  GET  /api/workspace/file?path=  ← 读取文件内容        │  │
│  │  GET  /api/history     ← 对话历史                      │  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │  Agent Orchestrator（核心）                             │  │
│  │  - 接收用户指令                                        │  │
│  │  - 构建 System Prompt（编码上下文 + 工作目录信息）     │  │
│  │  - 调用 @cursor/sdk 创建 Agent                         │  │
│  │  - 流式转发 Agent 输出到 SSE                           │  │
│  │  - 文件操作审计日志                                    │  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┼───────────────────────────────┐  │
│  │  External Services                                     │  │
│  │  ┌──────────────┐  ┌──────────────────┐               │  │
│  │  │ Cursor SDK   │  │ STT Server :8765 │               │  │
│  │  │ (Agent API)  │  │ (Whisper/Sense)  │               │  │
│  │  └──────────────┘  └──────────────────┘               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 关键技术决策

### 3.1 为何复用 Next.js（而非新建项目）

| 考虑因素 | 决策 |
|----------|------|
| Cursor SDK 依赖 | Spark 已安装并配置 `@cursor/sdk`，无需重复安装 |
| 语音服务 | Spark 的 STT Server (port 8765) 可直接复用 |
| 部署简化 | 同一服务器，只需多开一个端口 |
| 代码隔离 | 放在 `agent-chat/` 子目录，通过 monorepo 方式管理 |

ACC 是一个**独立的 Next.js App**（有自己的 `package.json`、`next.config.ts`），与 Spark 共享 `node_modules` 的 `@cursor/sdk` 和服务器上的 STT 服务。

### 3.2 通信协议：SSE vs WebSocket

选择 **SSE（Server-Sent Events）**：

| 维度 | SSE | WebSocket |
|------|-----|-----------|
| 实现复杂度 | ✅ 低（HTTP 原生支持） | ❌ 中（需 ws 库） |
| Cursor SDK 兼容 | ✅ SDK 原生基于 stream | 需适配层 |
| 断线重连 | ✅ 浏览器原生 EventSource | 需手写 |
| 单向/双向 | 单向（服务器→客户端）满足需求 | 双向（过度设计） |
| 与 Spark 一致 | ✅ 相同模式，降低维护成本 | — |

### 3.3 Voice 方案：Web Speech API vs 复用 STT Server

采用**双路径**：优先 Web Speech API，降级到 STT Server。

| 方案 | 优点 | 缺点 |
|------|------|------|
| Web Speech API | 零服务端依赖、低延迟 | 仅 Chrome 支持好、中文识别弱 |
| STT Server (Whisper) | 中英文识别强、与 Spark 共享 | 需服务端转发、有延迟 |

工作流：
```
浏览器录音 → 
  ├─ [优先] Web Speech API → 直接返回文本
  └─ [降级] 发送音频到 POST /api/transcribe → STT Server → 返回文本
→ 在对话框展示识别文本 → 用户确认/修改 → 发送
```

### 3.4 安全边界

| 威胁 | 防护措施 |
|------|----------|
| 用户可通过 Agent 执行任意命令 | Agent 在 Cursor SDK 的 sandbox 内运行，受限工具集 |
| 路径穿越攻击 | `GET /api/workspace/file?path=` 校验路径必须在 `/root/codes/ryan_learning` 内 |
| System Prompt 注入 | 用户输入与 System Prompt 严格分离，不拼接 |
| 敏感文件泄露 | 文件树 API 过滤 `.env`、`secret.bin`、`node_modules` 等 |
| 对话历史泄露 | 无认证的本地服务，仅内网 / localhost 可访问 |

### 3.5 端口规划

| 服务 | 端口 | 用途 |
|------|------|------|
| Spark AI Tutor | 3000 | Ryan 的教育应用 |
| **ACC** | **3001** | 开发者 Cursor Agent 控制台 |
| STT Server | 8765 | 语音识别服务（共享） |

---

## 4. 模块分解

### 4.1 前端模块（`agent-chat/src/`）

```
src/
├── app/
│   ├── layout.tsx              # 根布局（暗色主题，类 Cursor IDE 风格）
│   ├── page.tsx                # 主页面（ChatWindow + Sidebar）
│   └── api/
│       ├── chat/route.ts       # POST SSE 流式对话
│       ├── transcribe/route.ts # POST 语音识别
│       ├── tts/route.ts        # POST 语音合成
│       ├── workspace/route.ts  # GET 工作区文件树
│       ├── workspace/
│       │   └── file/route.ts   # GET 读取文件内容
│       └── history/route.ts    # GET/PUT/DEL 对话历史
├── components/
│   ├── ChatWindow.tsx          # 对话窗口主组件（消息列表 + 流式输出）
│   ├── MessageBubble.tsx       # 消息气泡（用户 / Agent，Markdown 渲染）
│   ├── WorkspaceSidebar.tsx    # 工作区侧边栏（文件树 + 点击预览）
│   ├── Composer.tsx            # 输入框组件（文字 + 语音按钮）
│   ├── VoiceConfirmModal.tsx   # 语音识别确认弹窗
│   └── FilePreview.tsx         # 文件内容预览面板
└── lib/
    ├── agent.ts                # Cursor SDK Agent 封装（创建、流式、工具管理）
    ├── prompts.ts              # System Prompt 构建（编码上下文）
    ├── workspace.ts            # 工作区文件树扫描与过滤
    ├── history-store.ts        # 对话历史文件存储
    ├── types.ts                # TypeScript 类型定义
    └── stt.ts                  # STT 客户端封装（Web Speech + 服务端降级）
```

### 4.2 后端模块

| 模块 | 文件 | 职责 |
|------|------|------|
| Agent Orchestrator | `agent.ts` | 创建 Cursor Agent，管理 session，流式转发 |
| Prompt Builder | `prompts.ts` | 构建包含工作区上下文、编码规范的 System Prompt |
| Workspace Scanner | `workspace.ts` | 扫描文件树，过滤敏感文件，读取文件内容 |
| History Manager | `history-store.ts` | 对话历史的 CRUD，文件系统持久化 |
| Transcribe Proxy | `transcribe/route.ts` | 音频→STT Server→文本 |

---

## 5. 数据流

### 5.1 核心对话流程

```
User                Frontend             Backend              Cursor SDK
 │                     │                    │                     │
 │  输入/语音识别       │                    │                     │
 │─────────────────────►                    │                     │
 │                     │  POST /api/chat    │                     │
 │                     │───────────────────►│                     │
 │                     │                    │  创建 Agent         │
 │                     │                    │────────────────────►│
 │                     │                    │                     │
 │                     │    SSE stream      │   Agent 流式回复     │
 │                     │◄───────────────────│◄────────────────────│
 │                     │                    │                     │
 │  逐字流式显示        │                    │                     │
 │◄────────────────────│                    │                     │
 │                     │                    │                     │
 │  新消息到达指令      │  done event        │                     │
 │◄────────────────────│◄───────────────────│                     │
```

### 5.2 语音识别流程

```
User               Frontend                Backend           STT Server
 │                   │                       │                   │
 │  按住录音按钮      │                       │                   │
 │──────────────────►│                       │                   │
 │                   │  MediaRecorder 录音    │                   │
 │                   │──────┐                │                   │
 │                   │      │ 本地 Web       │                   │
 │                   │      │ Speech API     │                   │
 │                   │◄─────┘               │                   │
 │                   │                       │                   │
 │  显示识别文本      │                       │                   │
 │◄──────────────────│                       │                   │
 │                   │                       │                   │
 │  [降级路径]        │  POST /api/transcribe │                   │
 │                   │──────────────────────►│                   │
 │                   │                       │  POST audio/wav   │
 │                   │                       │──────────────────►│
 │                   │                       │    转录文本        │
 │                   │                       │◄──────────────────│
 │                   │  返回转录文本          │                   │
 │                   │◄──────────────────────│                   │
 │                   │                       │                   │
 │  在对话框确认/修改 │                       │                   │
 │◄──────────────────│                       │                   │
```

---

## 6. 非功能需求

### 6.1 性能

| 指标 | 目标 |
|------|------|
| 首屏加载 (LCP) | < 1.5s |
| 语音识别延迟（Web Speech API） | < 500ms |
| 语音识别延迟（STT Server） | < 3s |
| SSE 首字节时间 (TTFB) | < 2s（Agent 创建 + 首次回复） |
| 文件树扫描（百万级文件） | < 100ms（缓存 + 忽略 node_modules） |

### 6.2 可维护性

- 全部 TypeScript，严格模式
- 单元测试覆盖核心逻辑（`agent.ts`、`prompts.ts`、`workspace.ts`）
- 与 Spark 项目共享 ESLint、TypeScript、Vitest 配置

### 6.3 可靠性

- SSE 连接断开后自动重连（EventSource 原生支持）
- Cursor Agent 超时 120s 无响应则自动重试
- STT Server 不可用时自动降级到 Web Speech API

---

## 7. 与 Spark 的复用清单

| 共享资源 | 复用方式 |
|----------|----------|
| `@cursor/sdk` | 同版本依赖，`node_modules` 提升到根 |
| STT Server (port 8765) | 直接 HTTP 调用，不启动第二个实例 |
| `scripts/stt_server.py` | 共享，不复制 |
| Tailwind CSS / PostCSS 配置 | 独立配置但风格一致 |
| ESLint / TypeScript 配置 | 独立配置（ACC 可能有不同规则） |
| `docs/` 文档体系 | ACC 文档放在 `agent-chat/docs/` |

---

## 8. 待决策项

| 议题 | 选项 A | 选项 B | 建议 |
|------|--------|--------|------|
| 前端框架 | 复用 Next.js App Router | 纯 HTML + Vite React | **A**（与 Spark 一致，降低认知负担） |
| 文件树实现 | 服务端扫描 + API | 客户端通过 Agent 命令扫描 | **A**（性能好，可过滤敏感文件） |
| 历史对话存储 | 文件 JSON（与 Spark 一致） | SQLite | **A**（无额外依赖，与 Spark 模式统一） |
| Agent 工具集 | 全量代码工具（读/写/执行/搜索） | 只读模式（仅分析，不修改） | **A**（用户需要写代码能力） |

---

## 9. 版本路线图

| 版本 | 内容 | 预计 |
|------|------|------|
| **v0.1.0** | MVP：文字对话 + SSE 流式输出 + 基础 UI | — |
| **v0.2.0** | 语音输入（Web Speech API + STT Server 降级） | — |
| **v0.3.0** | 工作区文件树 + 文件预览 | — |
| **v0.4.0** | 对话历史持久化 + 多会话管理 | — |
| **v0.5.0** | TTS 语音播报 Agent 回复 | — |
| **v1.0.0** | 稳定版：完整的 Cursor Agent 控制台体验 | — |

---

> **下一步**: 参见 [技术方案与接口设计](./tech-design.md)
