# iOS / iPad

Spark does **not** run Node `spark-bridge.mjs` inside iSH or a-Shell.

## Easy path (recommended): SSH from iPad

1. Install **Termius** or **Blink** on the iPad.
2. Open Spark **Deploy** → tab **iPad / SSH**.
3. Generate a pair code and copy the Mac or Linux paste block.
4. SSH into an always-on Mac or Linux VPS and run the script.

The Spark node is the **host** (`darwin` / `linux`). The iPad is only the keyboard.

See [docs/subsystems/assistant-ipad.md](../../../docs/subsystems/assistant-ipad.md).

## Native path: Spark Bridge iOS App

Source: [`apps/spark-bridge-ios/`](../../../apps/spark-bridge-ios/). Registers as `platform: ios` with a Swift agent loop + optional APNs wake.

Requires Apple Developer / TestFlight. Not the same as the official OpenClaw App Store node (which pairs to a desktop Gateway).

## Rejected

- Installing OpenClaw / Node Bridge inside iSH or a-Shell on the iPad.
