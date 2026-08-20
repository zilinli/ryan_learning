import Foundation
import Combine

@MainActor
final class BridgeModel: ObservableObject {
  @Published var sparkUrl: String = UserDefaults.standard.string(forKey: "sparkUrl")
    ?? "https://spark-tutor-for-ryan.duckdns.org"
  @Published var pairCode: String = ""
  @Published var status: String = "idle"
  @Published var lastReply: String = ""
  @Published var paired: Bool = false

  private let client = BridgeClient()
  private var pollTask: Task<Void, Never>?
  private var apnsToken: String = ""

  func bootstrap() {
    NotificationCenter.default.addObserver(forName: .apnsToken, object: nil, queue: .main) { [weak self] note in
      Task { @MainActor in
        self?.apnsToken = note.object as? String ?? ""
        await self?.heartbeat()
      }
    }
    NotificationCenter.default.addObserver(forName: .silentWake, object: nil, queue: .main) { [weak self] _ in
      Task { @MainActor in await self?.pollOnce() }
    }
    if client.hasState {
      paired = true
      startPolling()
    }
  }

  func pair() async {
    status = "pairing…"
    do {
      try await client.register(
        sparkUrl: sparkUrl.trimmingCharacters(in: .whitespacesAndNewlines),
        pairCode: pairCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
      )
      UserDefaults.standard.set(sparkUrl, forKey: "sparkUrl")
      paired = true
      status = "paired"
      startPolling()
      await heartbeat()
    } catch {
      status = "pair failed: \(error.localizedDescription)"
    }
  }

  func startPolling() {
    pollTask?.cancel()
    pollTask = Task {
      while !Task.isCancelled {
        await pollOnce()
        try? await Task.sleep(nanoseconds: 1_000_000_000)
      }
    }
  }

  func heartbeat() async {
    do {
      try await client.heartbeat(apnsDeviceToken: apnsToken.isEmpty ? nil : apnsToken)
      status = "online"
    } catch {
      status = "heartbeat: \(error.localizedDescription)"
    }
  }

  func pollOnce() async {
    do {
      guard let cmd = try await client.poll() else {
        await heartbeat()
        return
      }
      if cmd.type == "chat" {
        status = "running…"
        lastReply = "Running on iPad…"
        try await client.replyChunk(requestId: cmd.requestId, text: "Running on iPad…\n")
        let text = await AgentRuntime.run(message: cmd.message, attachmentPaths: cmd.attachmentPaths)
        try await client.replyDone(requestId: cmd.requestId, text: text)
        lastReply = text
        status = "idle"
      } else if cmd.type == "upgrade" {
        let note = await ManifestChecker.check(sparkUrl: client.sparkUrl)
        try await client.replyDone(requestId: cmd.requestId, text: note)
      }
    } catch {
      status = "poll: \(error.localizedDescription)"
    }
  }
}
