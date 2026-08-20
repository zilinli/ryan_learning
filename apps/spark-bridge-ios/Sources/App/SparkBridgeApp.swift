import UserNotifications
import SwiftUI
import UIKit

@main
struct SparkBridgeApp: App {
  @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
  @StateObject private var bridge = BridgeModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(bridge)
        .onAppear { bridge.bootstrap() }
    }
  }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    application.registerForRemoteNotifications()
    return true
  }

  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    NotificationCenter.default.post(name: .apnsToken, object: hex)
  }

  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    NotificationCenter.default.post(name: .silentWake, object: nil)
    completionHandler(.newData)
  }
}

extension Notification.Name {
  static let apnsToken = Notification.Name("spark.apnsToken")
  static let silentWake = Notification.Name("spark.silentWake")
}
