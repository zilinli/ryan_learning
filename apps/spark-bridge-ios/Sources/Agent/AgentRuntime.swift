import Foundation
import UIKit

enum AgentRuntime {
  /// Minimal OpenAI-compatible chat. Keys from Keychain or env (Debug).
  static func run(message: String, attachmentPaths: [String]) async -> String {
    var prompt = message
    if !attachmentPaths.isEmpty {
      prompt += "\n\nLocal files on device:\n" + attachmentPaths.map { "- \($0)" }.joined(separator: "\n")
    }
    let toolHint = ToolRegistry.describe()
    let system = """
    You are Spark Bridge on iPad. Be concise. You can ask the user to use device tools: \(toolHint).
    Prefer plain text. No shell or desktop GUI.
    """
    guard let key = KeychainStore.get("DEEPSEEK_API_KEY") ?? KeychainStore.get("DASHSCOPE_API_KEY"),
          !key.isEmpty
    else {
      // Offline / unpaired keys: still acknowledge so /control does not time out.
      let listing = try? FileManager.default.contentsOfDirectory(atPath: AttachmentStore.inbox.path)
      return """
      (iPad Bridge online — add DEEPSEEK_API_KEY or DASHSCOPE_API_KEY in Settings to enable full replies.)

      You said: \(message.prefix(500))
      Inbox files: \((listing ?? []).joined(separator: ", ").prefix(200))
      """
    }

    let base = KeychainStore.get("LLM_BASE_URL") ?? "https://api.deepseek.com"
    let url = URL(string: "\(base.trimmingCharacters(in: CharacterSet(charactersIn: "/")))/v1/chat/completions")!
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
    let body: [String: Any] = [
      "model": KeychainStore.get("LLM_MODEL") ?? "deepseek-chat",
      "messages": [
        ["role": "system", "content": system],
        ["role": "user", "content": prompt],
      ],
      "temperature": 0.4,
    ]
    req.httpBody = try? JSONSerialization.data(withJSONObject: body)
    do {
      let (data, _) = try await URLSession.shared.data(for: req)
      if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
         let choices = json["choices"] as? [[String: Any]],
         let msg = choices.first?["message"] as? [String: Any],
         let content = msg["content"] as? String
      {
        return content.trimmingCharacters(in: .whitespacesAndNewlines)
      }
      return String(data: data, encoding: .utf8) ?? "(empty model response)"
    } catch {
      return "LLM error: \(error.localizedDescription)"
    }
  }
}

enum ToolRegistry {
  static func describe() -> String {
    "list_files, read_clipboard, fetch_url (camera/photos via share sheet into inbox)"
  }
}

enum AttachmentStore {
  static var inbox: URL {
    let u = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("inbox", isDirectory: true)
    try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
    return u
  }

  static func write(_ attachments: [[String: Any]]) throws -> [String] {
    var paths: [String] = []
    let stamp = Int(Date().timeIntervalSince1970 * 1000)
    for (i, a) in attachments.enumerated() {
      let name = ((a["name"] as? String) ?? "file").replacingOccurrences(of: "/", with: "_")
      var b64 = (a["dataBase64"] as? String) ?? ""
      if let range = b64.range(of: "base64,") {
        b64 = String(b64[range.upperBound...])
      }
      guard let data = Data(base64Encoded: b64) else { continue }
      let dest = inbox.appendingPathComponent("\(stamp)-\(i)-\(name)")
      try data.write(to: dest)
      paths.append(dest.path)
    }
    return paths
  }
}

enum KeychainStore {
  static func get(_ key: String) -> String? {
    UserDefaults.standard.string(forKey: "secret.\(key)")
  }

  static func set(_ key: String, value: String) {
    UserDefaults.standard.set(value, forKey: "secret.\(key)")
  }
}

enum ManifestChecker {
  static func check(sparkUrl: String) async -> String {
    guard let url = URL(string: "\(sparkUrl)/install/ios-bridge-manifest.json") else {
      return "Invalid Spark URL"
    }
    do {
      let (data, _) = try await URLSession.shared.data(from: url)
      let text = String(data: data, encoding: .utf8) ?? ""
      return "Upgrade: open TestFlight if a newer build is listed.\n\(text.prefix(400))"
    } catch {
      return "Could not fetch manifest: \(error.localizedDescription)"
    }
  }
}
