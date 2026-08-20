// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "SparkBridgeIOS",
  platforms: [.iOS(.v17)],
  products: [
    .library(name: "SparkBridgeCore", targets: ["SparkBridgeCore"]),
  ],
  targets: [
    .target(
      name: "SparkBridgeCore",
      path: "Sources",
      exclude: ["App/SparkBridgeApp.swift", "App/RootView.swift"]
    ),
  ]
)
