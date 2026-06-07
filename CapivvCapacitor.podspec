require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name = 'CapivvCapacitor'
  s.version = package['version']
  s.summary = package['description']
  s.license = package['license']
  s.homepage = package['repository']['url'].gsub(/^git\+/, '').gsub(/\.git$/, '')
  s.author = package['author']
  s.source = { :git => package['repository']['url'].gsub(/^git\+/, ''), :tag => s.version.to_s }
  # Sources live in the SPM-convention layout (ios/Sources/...) —
  # CocoaPods picks them up just as well. Updated in v0.5.18 alongside
  # the Package.swift restructure; the legacy ios/Plugin/ layout no
  # longer exists.
  s.source_files = 'ios/Sources/CapivvCapacitorSdkPlugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'

  # Required frameworks for StoreKit 2
  s.frameworks = 'StoreKit'

  # V0.5.23 — Apple's PrivacyInfo.xcprivacy required for iOS 17+ SDKs.
  # Bundled into the framework so CocoaPods consumers get the same
  # privacy manifest as SPM consumers. See ios/Sources/.../PrivacyInfo.xcprivacy
  # for the documented data-collection categories.
  s.resource_bundles = {
    'CapivvCapacitor' => ['ios/Sources/CapivvCapacitorSdkPlugin/PrivacyInfo.xcprivacy']
  }
end
