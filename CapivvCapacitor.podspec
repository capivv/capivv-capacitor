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
  s.source_files = 'ios/Plugin/**/*.{swift,h,m,c,cc,mm,cpp}'
  s.ios.deployment_target = '15.0'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'

  # Required frameworks for StoreKit 2
  s.frameworks = 'StoreKit'
end
