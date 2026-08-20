# iPad support — SSH easy deploy + native Bridge

> Updated 2026-08-20

Spark can be driven from an iPad in two tracks. **Do not confuse them.**

| Track | What you install on iPad | Where Bridge / agent runs | Deploy difficulty | Appears as Spark node |
|-------|--------------------------|---------------------------|-------------------|------------------------|
| **P0 SSH** | Termius / Blink / Prompt | Always-on **Mac or Linux VPS** | Low (paste one script) | `darwin` / `linux` |
| **P1 Native** | Spark Bridge iOS App | **On the iPad** (Swift AgentRuntime) | High (TestFlight / Apple Developer) | `platform: ios` |
| ~~iSH / a-Shell local Node~~ | Local Alpine / JSC shell | Would be iPad | Broken | **Rejected** |

```mermaid
flowchart TB
  subgraph p0 [P0_SSH]
    Termius["iPad Termius"] -->|SSH| Host["Mac or VPS"]
    Host --> Bridge["spark-bridge.mjs"]
    Bridge --> Spark["Spark /control"]
  end
  subgraph p1 [P1_Native]
    App["Spark Bridge iOS"] -->|poll reply APNs| Spark2["Spark /control"]
    App --> Agent["Swift AgentRuntime"]
  end
```

---

## Why not iSH / a-Shell on-device?

- **iSH:** modern Node often exits with `Illegal instruction` (emulator gaps).
- **a-Shell:** JavaScriptCore only — no real `node` / `npm`.
- **Background:** iOS suspends the app; long-poll dies; `tmux` does not keep the process running.
- Product decision: **no** “curl spark-bridge inside iSH” path.

---

## P0 — SSH easy deploy (shipped)

### User flow (Termius install + one-tap)

1. Keep a Mac (default) or Linux VPS online.
2. On iPad open `/deploy` → **iPad / SSH** → generate pair code (host toggle defaults to **Mac (SSH)**).
3. Tap **Install Termius (App Store)** if you do not have it (Apple does **not** allow silent install of App Store apps — this is a one-tap Store link).
4. Open Termius → add your Mac host once.
5. Tap **Open one-tap installer** → **Copy install command** → paste in that Termius session.
6. Optional: Shortcuts / Blink on the same installer page.
7. Chat at `/control`.

Deploy UI currently hides the Native App tab; scaffold remains under `apps/spark-bridge-ios/`.

| Asset | Purpose |
|-------|---------|
| [Termius on App Store](https://apps.apple.com/app/id549039908) | Step 1 for most iPads |
| `termius://` | Open Termius after install |
| `/install/spark-deploy-ipad.html?code=&target=mac\|linux` | One-tap installer (default **mac**) |
| same + `&download=1` | Download `Spark-Deploy-<CODE>.html` |
| Shortcut `Spark Deploy` / Blink URL actions | Optional power-user paths |

### Installers

| Host | Script |
|------|--------|
| macOS | [`public/install/macos.sh`](../../public/install/macos.sh) |
| Linux | [`public/install/linux.sh`](../../public/install/linux.sh) — systemd user unit `spark-bridge.service` |

Bridge `restartSelf()` supports `systemctl --user restart spark-bridge` on Linux.
---

## P1 — Native Spark Bridge iOS App

Path: [`apps/spark-bridge-ios/`](../../apps/spark-bridge-ios/)

| Piece | Role |
|-------|------|
| `BridgeClient` | `register` / `heartbeat` / `poll` / `reply` (HTTP, 45s poll abort) |
| `AgentRuntime` | OpenAI-compatible tool loop (DeepSeek / DashScope keys from Keychain or install-ticket) |
| Tools | Files (Documents), Photos, Camera, Clipboard, URL fetch |
| Push | Silent APNs (`content-available: 1`) when server enqueues chat for `platform: ios` |

### Server fields

`NodeRecord` may include:

- `apnsDeviceToken`
- `pushEnvironment` (`sandbox` | `production`)

`POST /api/nodes/heartbeat` accepts those fields. Enqueue chat for an iOS node triggers [`scripts/apns-push.mjs`](../../scripts/apns-push.mjs) when `APNS_*` env is set.

### Upgrade on iOS

Not tar + `install.mjs`. App reads `/install/ios-bridge-manifest.json` and prompts TestFlight / App Store update; may refresh remote prompt pack.

### Background (App Store compliant)

- Use **remote-notification** silent push — **not** PushKit/VoIP.
- Document latency: first command after long sleep may take 10–30s; open the app if push is dropped.

### Capability gap vs Mac/Win

| | Mac/Win | iPad native |
|--|---------|-------------|
| Spark `/control` node | Yes | Yes |
| OpenClaw skills / WeChat / workbench | Yes | No |
| Shell / desktop GUI | Yes | No |
| Camera / Photos / Files | Partial | First-class |

---

## Related docs

- [remote-openclaw-control.md](remote-openclaw-control.md)
- [assistant-ipad.md](assistant-ipad.md)
- [assistant/platforms/ios/README.md](../../assistant/platforms/ios/README.md)
- [apps/spark-bridge-ios/README.md](../../apps/spark-bridge-ios/README.md)
