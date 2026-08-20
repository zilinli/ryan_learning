import Foundation

/// Lightweight clipboard / documents helpers used by AgentRuntime prompts.
enum DeviceTools {
  static func clipboardText() -> String {
    #if canImport(UIKit)
    return "" // filled from UIPasteboard in UIKit targets
    #else
    return ""
    #endif
  }

  static func listDocuments() -> [String] {
    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    return (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
  }
}
