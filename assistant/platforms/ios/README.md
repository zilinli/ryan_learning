# iOS / iPad

Spark does **not** run Node `spark-bridge.mjs` inside iSH or a-Shell.

## Easy path (recommended): SSH from iPad

1. Install **Termius** or **Blink** on the iPad.
2. Open Spark **Deploy** → tab **iPad / SSH**.
3. Generate a pair code and open the one-tap installer (Mac or Linux host).
4. SSH into an always-on Mac or Linux VPS and run the script.

The Spark node is the **host** (`darwin` / `linux`). The iPad is only the keyboard.

### Background / daemon (Termius can quit)

Installers register Bridge as a **daemon + watchdog**:

| Host | Daemon | Watchdog |
|------|--------|----------|
| macOS | LaunchAgent `org.spark.bridge` (`KeepAlive`, `gui/<uid>`) | `org.spark.bridge.watchdog` every 60s |
| Linux | `systemd --user` `spark-bridge.service` + **linger** | `spark-bridge-watchdog.timer` every 1m |

After install prints “Safe to close Termius / SSH”, you can disconnect — Bridge keeps polling Spark.

Linux note: if linger failed, run once: `sudo loginctl enable-linger $USER`.

See [docs/subsystems/assistant-ipad.md](../../../docs/subsystems/assistant-ipad.md).

## Skills on iPad SSH hosts

OpenClaw skills ship with `darwin.md` / `win32.md` / `linux.md` / `ios.md` overlays. On a Linux VPS installed from iPad, `linux.md` is merged (CLI-first; no GUI computer-use).

## Native path: Spark Bridge iOS App

Source: [`apps/spark-bridge-ios/`](../../../apps/spark-bridge-ios/). Registers as `platform: ios` with a Swift agent loop + optional APNs wake.

Requires Apple Developer / TestFlight. Not the same as the official OpenClaw App Store node (which pairs to a desktop Gateway).

## Rejected

- Installing OpenClaw / Node Bridge inside iSH or a-Shell on the iPad.
