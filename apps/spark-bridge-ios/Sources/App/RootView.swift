import SwiftUI

struct RootView: View {
  @EnvironmentObject var bridge: BridgeModel
  @State private var showSettings = false

  var body: some View {
    NavigationStack {
      VStack(alignment: .leading, spacing: 16) {
        if bridge.paired {
          Text("Status: \(bridge.status)")
            .font(.footnote)
            .foregroundStyle(.secondary)
          ScrollView {
            Text(bridge.lastReply.isEmpty ? "Waiting for /control commands…" : bridge.lastReply)
              .frame(maxWidth: .infinity, alignment: .leading)
              .padding()
              .background(Color(.secondarySystemBackground))
              .clipShape(RoundedRectangle(cornerRadius: 12))
          }
          Button("Heartbeat now") {
            Task { await bridge.heartbeat() }
          }
          .buttonStyle(.bordered)
        } else {
          Text("Pair with Spark")
            .font(.title2.bold())
          Text("Use Deploy → Native App. The iPad becomes a Spark node; commands run here via Swift AgentRuntime.")
            .font(.footnote)
            .foregroundStyle(.secondary)
          TextField("Spark URL", text: $bridge.sparkUrl)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .textFieldStyle(.roundedBorder)
          TextField("Pair code", text: $bridge.pairCode)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .textFieldStyle(.roundedBorder)
          Button("Pair") {
            Task { await bridge.pair() }
          }
          .buttonStyle(.borderedProminent)
          Text(bridge.status)
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        Spacer()
      }
      .padding()
      .navigationTitle("Spark Bridge")
      .toolbar {
        Button("Settings") { showSettings = true }
      }
      .sheet(isPresented: $showSettings) {
        SettingsView()
      }
    }
  }
}

struct SettingsView: View {
  @Environment(\.dismiss) private var dismiss
  @State private var deepseek = KeychainStore.get("DEEPSEEK_API_KEY") ?? ""
  @State private var dashscope = KeychainStore.get("DASHSCOPE_API_KEY") ?? ""
  @State private var model = KeychainStore.get("LLM_MODEL") ?? "deepseek-chat"

  var body: some View {
    NavigationStack {
      Form {
        Section("LLM keys (stored on device)") {
          SecureField("DEEPSEEK_API_KEY", text: $deepseek)
          SecureField("DASHSCOPE_API_KEY", text: $dashscope)
          TextField("Model", text: $model)
        }
        Section {
          Button("Save") {
            KeychainStore.set("DEEPSEEK_API_KEY", value: deepseek)
            KeychainStore.set("DASHSCOPE_API_KEY", value: dashscope)
            KeychainStore.set("LLM_MODEL", value: model)
            dismiss()
          }
        }
      }
      .navigationTitle("Settings")
      .toolbar {
        Button("Close") { dismiss() }
      }
    }
  }
}
