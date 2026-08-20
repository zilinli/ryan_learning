import Foundation
import UIKit

final class BridgeClient {
  private(set) var sparkUrl: String = ""
  private var token: String = ""
  private var nodeId: String = ""

  private let stateURL: URL = {
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return dir.appendingPathComponent("spark-bridge-state.json")
  }()

  var hasState: Bool {
    FileManager.default.fileExists(atPath: stateURL.path)
  }

  init() {
    loadState()
  }

  func register(sparkUrl: String, pairCode: String) async throws {
    self.sparkUrl = sparkUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    let url = URL(string: "\(self.sparkUrl)/api/nodes/register")!
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let body: [String: Any] = [
      "pairCode": pairCode,
      "hostname": UIDevice.current.name,
      "platform": "ios",
      "openclawVersion": "swift-agent",
      "bridgeVersion": "2026.8.20-ios-1",
    ]
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else {
      throw NSError(domain: "spark", code: 1, userInfo: [NSLocalizedDescriptionKey: String(data: data, encoding: .utf8) ?? "register failed"])
    }
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    token = json["token"] as? String ?? ""
    nodeId = json["nodeId"] as? String ?? ""
    try saveState()
  }

  func heartbeat(apnsDeviceToken: String?) async throws {
    try requireAuth()
    var body: [String: Any] = [
      "token": token,
      "hostname": UIDevice.current.name,
      "openclawVersion": "swift-agent",
      "bridgeVersion": "2026.8.20-ios-1",
    ]
    if let apnsDeviceToken, !apnsDeviceToken.isEmpty {
      body["apnsDeviceToken"] = apnsDeviceToken
      #if DEBUG
      body["pushEnvironment"] = "sandbox"
      #else
      body["pushEnvironment"] = "production"
      #endif
    }
    try await postJSON(path: "/api/nodes/heartbeat", body: body)
  }

  func poll() async throws -> PollCommand? {
    try requireAuth()
    var comps = URLComponents(string: "\(sparkUrl)/api/nodes/poll")!
    comps.queryItems = [URLQueryItem(name: "token", value: token)]
    var req = URLRequest(url: comps.url!)
    req.timeoutInterval = 45
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, http.statusCode == 200 else { return nil }
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
    guard let cmd = json["command"] as? [String: Any],
          let requestId = cmd["requestId"] as? String,
          let type = cmd["type"] as? String
    else { return nil }
    let message = cmd["message"] as? String ?? ""
    var paths: [String] = []
    if let attachments = cmd["attachments"] as? [[String: Any]] {
      paths = try AttachmentStore.write(attachments)
    }
    return PollCommand(requestId: requestId, type: type, message: message, attachmentPaths: paths)
  }

  func replyChunk(requestId: String, text: String) async throws {
    try await reply(requestId: requestId, type: "chunk", text: text, error: nil)
  }

  func replyDone(requestId: String, text: String) async throws {
    try await reply(requestId: requestId, type: "done", text: text, error: nil)
  }

  private func reply(requestId: String, type: String, text: String?, error: String?) async throws {
    try requireAuth()
    var body: [String: Any] = ["token": token, "requestId": requestId, "type": type]
    if let text { body["text"] = text }
    if let error { body["error"] = error }
    try await postJSON(path: "/api/nodes/reply", body: body)
  }

  private func postJSON(path: String, body: [String: Any]) async throws {
    let url = URL(string: "\(sparkUrl)\(path)")!
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = try JSONSerialization.data(withJSONObject: body)
    let (_, resp) = try await URLSession.shared.data(for: req)
    guard let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw NSError(domain: "spark", code: 2, userInfo: [NSLocalizedDescriptionKey: "HTTP error \(path)"])
    }
  }

  private func requireAuth() throws {
    if token.isEmpty || sparkUrl.isEmpty {
      throw NSError(domain: "spark", code: 3, userInfo: [NSLocalizedDescriptionKey: "not paired"])
    }
  }

  private func saveState() throws {
    let obj: [String: String] = ["token": token, "nodeId": nodeId, "sparkUrl": sparkUrl]
    try JSONSerialization.data(withJSONObject: obj).write(to: stateURL, options: .atomic)
  }

  private func loadState() {
    guard let data = try? Data(contentsOf: stateURL),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: String]
    else { return }
    token = obj["token"] ?? ""
    nodeId = obj["nodeId"] ?? ""
    sparkUrl = obj["sparkUrl"] ?? sparkUrl
  }
}
