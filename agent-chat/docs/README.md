# Agent Chat Console — 项目总览与开发计划

> **代号**: ACC | **版本**: v0.1.0 | **日期**: 2026-08-04

---

## 概述

**Agent Chat Console** 是一个部署在服务器上的 Web 应用，提供类似 Cursor IDE Agent 窗口的交互体验。用户可以通过**文字或语音**输入命令，让本服务器的 Cursor IDE 执行编码任务（创建文件、编辑代码、运行命令等），并实时流式查看执行结果。

### 核心特性

| 特性 | 描述 |
|------|------|
| **对话式编程** | 像聊天一样给 Cursor Agent 下命令 |
| **语音输入** | 支持中英文语音识别，识别后确认再发送 |
| **流式输出** | Agent 的回复逐字实时显示，类终端体验 |
| **工作区浏览** | 侧边栏显示文件树，点击预览文件内容 |
| **对话历史** | 自动保存所有对话，支持切换和搜索 |
| **暗色主题** | 深色 IDE 风格，适合长时间编码 |

---

## 技术栈

```
前端:   Next.js 16 (App Router) + React 19 + Tailwind CSS 4
语音:   Web Speech API (优先) + Whisper/SenseVoice STT Server (降级)
AI:     @cursor/sdk ^1.0.26 (Cursor Agent)
流式:   Server-Sent Events (SSE)
存储:   文件系统 JSON (零数据库依赖)
测试:   Vitest 4
运行时: Node.js 22
部署:   Port 3001，与 Spark (Port 3000) 并行
```

---

## 项目结构

```
agent-chat/
├── docs/                        # 📖 设计文档
│   ├── README.md                #   本文件 — 总览与计划
│   ├── architecture.md          #   系统架构设计
│   ├── tech-design.md           #   技术方案与接口
│   ├── ui-ux.md                 #   前端交互与 UI
│   └── data-design.md           #   数据与存储设计
│
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 根布局（暗色主题）
│   │   ├── page.tsx             # 主页面
│   │   ├── globals.css          # 全局样式
│   │   └── api/                 # 6 个 API 路由
│   │       ├── chat/route.ts    # POST SSE 流式对话
│   │       ├── transcribe/route.ts
│   │       ├── tts/route.ts
│   │       ├── workspace/route.ts
│   │       ├── workspace/file/route.ts
│   │       └── history/route.ts
│   ├── components/              # 6 个 React 组件
│   │   ├── ChatWindow.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── WorkspaceSidebar.tsx
│   │   ├── Composer.tsx
│   │   ├── VoiceConfirmModal.tsx
│   │   └── FilePreview.tsx
│   └── lib/                     # 核心逻辑库
│       ├── agent.ts             # Cursor SDK 封装
│       ├── prompts.ts           # System Prompt 构建
│       ├── workspace.ts         # 文件树扫描
│       ├── history-store.ts     # 对话存储
│       ├── types.ts             # 类型定义
│       └── stt.ts               # 语音识别封装
│
├── data/                        # 运行时数据
│   └── conversations/           # 对话历史 JSON
├── logs/                        # 运行日志
├── public/                      # 静态资源
├── package.json
├── next.config.ts               # 端口 3001
├── tsconfig.json
├── postcss.config.mjs
├── tailwind.config.ts
└── start.sh                     # 启动脚本
```

---

## 开发计划

### Phase 0 — 项目脚手架（0.5 天）

- [ ] 初始化 `agent-chat/` 目录结构
- [ ] 创建 `package.json`（依赖: next, react, react-dom, @cursor/sdk, react-markdown, tailwindcss）
- [ ] 配置 `next.config.ts`（端口 3001）
- [ ] 配置 `tailwind.config.ts`（Catppuccin Mocha 暗色主题）
- [ ] 创建 `start.sh` 启动脚本
- [ ] 验证 `npm run dev` 可成功启动

### Phase 1 — 核心对话（1.5 天）

- [ ] 实现根布局 `layout.tsx`（暗色主题 + 字体）
- [ ] 实现主页面 `page.tsx`（两栏布局骨架）
- [ ] 实现 `ChatWindow.tsx`（消息列表 + 自动滚动）
- [ ] 实现 `MessageBubble.tsx`（用户/Agent 气泡 + Markdown 渲染）
- [ ] 实现 `Composer.tsx`（文字输入 + 发送按钮 + Enter 快捷键）
- [ ] 实现 `lib/prompts.ts`（System Prompt 模板）
- [ ] 实现 `lib/agent.ts`（Cursor SDK Agent 封装）
- [ ] 实现 `api/chat/route.ts`（SSE 流式对话）
- [ ] 端到端测试：发送文字 → 流式返回 → 显示

### Phase 2 — 语音输入（1 天）

- [ ] 实现 `lib/stt.ts`（Web Speech API 封装）
- [ ] 实现 `api/transcribe/route.ts`（STT Server 转发）
- [ ] 实现 `VoiceConfirmModal.tsx`（语音识别 + 确认/修改/重录）
- [ ] 集成到 `Composer.tsx`（语音按钮 → 录音 → 确认 → 发送）
- [ ] 中英文语音测试

### Phase 3 — 工作区浏览（1 天）

- [ ] 实现 `lib/workspace.ts`（文件树扫描 + 过滤 + 安全校验）
- [ ] 实现 `api/workspace/route.ts`（GET 文件树）
- [ ] 实现 `api/workspace/file/route.ts`（GET 文件内容）
- [ ] 实现 `WorkspaceSidebar.tsx`（文件树组件）
- [ ] 实现 `FilePreview.tsx`（文件预览面板）
- [ ] 侧栏折叠/展开动画

### Phase 4 — 对话历史（0.5 天）

- [ ] 实现 `lib/history-store.ts`（JSON 文件读写）
- [ ] 实现 `api/history/route.ts`（CRUD）
- [ ] 会话自动保存（每次消息后）
- [ ] 会话列表（侧栏或弹窗，选择/删除/新建）

### Phase 5 — 优化与收尾（0.5 天）

- [ ] 移动端响应式适配
- [ ] 加载状态、空状态、错误状态处理
- [ ] 流式输出光标动画
- [ ] 快捷键支持
- [ ] API Key 未配置时的 Setup 面板
- [ ] 审计日志
- [ ] README 用户文档

---

## 启动方式

```bash
# 1. 进入项目目录
cd /root/codes/ryan_learning/agent-chat

# 2. 安装依赖（首次）
npm install

# 3. 确保 STT Server 在运行（如需语音功能）
cd /root/codes/ryan_learning
python3 scripts/stt_server.py &

# 4. 启动 ACC
bash start.sh

# 访问 http://<server-ip>:3001
```

---

## 与 Spark 项目的关系总结

| 维度 | Spark（AI Tutor） | ACC（Agent Console） |
|------|-------------------|----------------------|
| **代码目录** | 根目录 `src/` ... | `agent-chat/` 子目录 |
| **端口** | 3000 | 3001 |
| **用户** | Ryan（小学生） | 开发者 |
| **角色** | Socratic 教师 | Cursor IDE 编码助理 |
| **System Prompt** | 教育提示词（Hint Ladder） | 编码提示词（工作区上下文） |
| **共享资源** | — | Cursor SDK、STT Server、部分工具脚本 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [architecture.md](./architecture.md) | 系统架构总览、技术决策、模块分解 |
| [tech-design.md](./tech-design.md) | 技术栈、API 接口定义、System Prompt、错误处理 |
| [ui-ux.md](./ui-ux.md) | 页面布局、组件设计、视觉规范、交互细节 |
| [data-design.md](./data-design.md) | 数据模型、文件存储、日志格式、生命周期 |
| **本文件** | 项目总览、开发计划、快速启动 |
