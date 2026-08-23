# iPad / iOS notes

Spark on iPad has two tracks:

1. **SSH easy path (recommended):** Bridge + OpenClaw run on the **Mac or Linux host** you SSH into from Termius. Use that host's `darwin` / `linux` skill instructions — not iPad-local tools.
2. **Native Spark Bridge App:** Limited on-device tools (Files / Photos / Camera / Clipboard / URL fetch). No full OpenClaw skill runtime, no shell GUI automation, no WeChat workbench on device.

When this skill is loaded on a **host** paired via iPad SSH, follow the host platform section above.

## Native App

不能跑 Cursor Agent。编码任务转发到已配对的 Mac/Linux/Windows 节点。
