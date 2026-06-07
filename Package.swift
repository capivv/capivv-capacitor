// swift-tools-version: 5.9
import PackageDescription

// SPM manifest for @capivv/capacitor-sdk. Required so Capacitor 6+'s
// `npx cap sync ios` (which now defaults to the SPM iOS layout
// `ios/App/CapApp-SPM/Package.swift` in newly-generated projects) can
// auto-register the Capivv plugin.
//
// Sources live at `ios/Sources/CapivvCapacitorSdkPlugin/` (the SPM
// convention used by every modern first-party Capacitor plugin —
// @capacitor/app, @capacitor/haptics, etc.) NOT `ios/Plugin/` (the
// legacy CocoaPods convention). The path matters: SPM compiles
// whatever's at `path:` and silently drops anything outside.
//
// Pure Swift — no .m, no CAP_PLUGIN macro. The `CAPBridgedPlugin`
// protocol implementation in CapivvPlugin.swift (with its
// `pluginMethods` array) is what the Capacitor 6+ runtime uses for
// plugin discovery. v0.5.16's Package.swift kept the old `.m` file
// alongside, but SPM doesn't cross-compile mixed Swift+Objective-C
// in a single target without explicit cSettings, so the .m was
// silently dropped from the build product → every method came back
// as UNIMPLEMENTED on device.
//
// iOS 15 deployment target — StoreKit 2 (Apple's modern in-app
// purchase API) requires iOS 15+.
let package = Package(
    name: "CapivvCapacitorSdk",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapivvCapacitorSdk",
            targets: ["CapivvCapacitorSdkPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "CapivvCapacitorSdkPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/CapivvCapacitorSdkPlugin",
            // V0.5.23 — bundle PrivacyInfo.xcprivacy with the framework
            // so iOS 17+ apps consuming this SDK pass App Store review.
            // Apple cross-checks each SDK's privacy manifest against
            // the host app's nutrition label; missing manifest = soft
            // rejection. Documented data points:
            //   - NSPrivacyCollectedDataTypeUserID (linked, app
            //     functionality)
            //   - NSPrivacyCollectedDataTypePurchaseHistory (linked,
            //     app functionality)
            // No Required Reason API access; no tracking.
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ]
        )
    ]
)
