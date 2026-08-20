# Spark Bridge iOS

Native Spark node for iPad / iPhone (`platform: ios`). Pairs with Spark `/deploy`, long-polls `/api/nodes/poll`, runs a Swift `AgentRuntime` (no OpenClaw CLI).

## Requirements

- Xcode 16+ / iPadOS 18+
- Apple Developer account (TestFlight + APNs)
- Pair code from https://spark-tutor-for-ryan.duckdns.org/deploy → **Native App**

## Open in Xcode

1. Create a new **App** target `SparkBridge` (SwiftUI, bundle id `org.spark.bridge`).
2. Add the files under `Sources/` to the target (or open this folder as an SPM package and embed).
3. Capabilities: **Push Notifications**, Background Modes → **Remote notifications**.
4. Set `SPARK_URL` default in Settings or Pair screen.

## Pair flow

1. Generate pair code on `/deploy`.
2. In app: paste Spark URL + pair code → `POST /api/nodes/register` with `platform: "ios"`.
3. Register for APNs; heartbeat sends `apnsDeviceToken`.
4. Foreground: poll every ~25–45s. Background: silent push wakes poll.

## Server env (VPS)

```bash
APNS_KEY_ID=...
APNS_TEAM_ID=...
APNS_BUNDLE_ID=org.spark.bridge
APNS_P8_PATH=/path/to/AuthKey_XXX.p8
# APNS_PRODUCTION=1  # after App Store / production push cert
```

## Manifest

`/install/ios-bridge-manifest.json` — min version + TestFlight URL.

## Docs

[docs/subsystems/assistant-ipad.md](../../docs/subsystems/assistant-ipad.md)
