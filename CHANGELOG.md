# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-18

### Added

- Initial release of @capivv/capacitor-sdk
- TypeScript plugin definitions with full type safety
- iOS implementation with StoreKit 2 support (iOS 15+)
  - Product fetching from App Store
  - Purchase flow with transaction verification
  - Restore purchases
  - Subscription management
  - Transaction observer for background updates
- Android implementation with Google Play Billing Library 6.x
  - Product fetching from Play Store
  - Purchase flow with acknowledgment
  - Restore purchases
  - Subscription management
- Web implementation with Capivv REST API
  - User identification
  - Entitlement checking
  - Offering/product fetching
  - (Stripe integration coming in future release)
- Event listeners for entitlement updates, purchase completion, and failures
- Comprehensive README with Angular and React examples
