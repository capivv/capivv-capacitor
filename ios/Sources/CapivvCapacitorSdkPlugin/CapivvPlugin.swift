import Foundation
import Capacitor
import StoreKit

/// Capivv Capacitor Plugin
/// Provides in-app purchase and subscription management via StoreKit 2
@objc(CapivvPlugin)
public class CapivvPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CapivvPlugin"
    public let jsName = "Capivv"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "identify", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUserInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isBillingSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getOfferings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPaywall", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProduct", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkEntitlement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "syncPurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise)
    ]

    private var apiKey: String?
    private var apiUrl: String = "https://app.capivv.com"
    private var userId: String?
    private var debug: Bool = false
    private var transactionObserver: Task<Void, Never>?

    deinit {
        transactionObserver?.cancel()
    }

    // MARK: - Configuration

    @objc func configure(_ call: CAPPluginCall) {
        guard let apiKey = call.getString("apiKey") else {
            call.reject("apiKey is required")
            return
        }

        self.apiKey = apiKey

        if let apiUrl = call.getString("apiUrl") {
            self.apiUrl = apiUrl
        }

        self.debug = call.getBool("debug") ?? false

        // Start listening for transactions
        startTransactionObserver()

        log("Configured with API URL: \(self.apiUrl)")
        call.resolve()
    }

    // MARK: - User Management

    @objc func identify(_ call: CAPPluginCall) {
        guard apiKey != nil else {
            call.reject("Not configured. Call configure() first.")
            return
        }

        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }

        self.userId = userId
        // V0.5.21 — hit the canonical SDK endpoint POST /v1/sdk/users
        // with `{ external_id }`. Pre-fix the iOS plugin POSTed to
        // /v1/users/{id}/login (which doesn't exist on the server) and
        // every Capivv.identify() call returned a 404 the JS bridge
        // swallowed silently. Server handler:
        // crates/capivv-api/src/routes/sdk/mod.rs::create_or_get_user.
        Task {
            do {
                let response = try await apiRequest(
                    method: "POST",
                    path: "/v1/sdk/users",
                    body: ["external_id": userId]
                )

                let user = response["user"] as? [String: Any]
                call.resolve([
                    "userId": userId,
                    "entitlements": response["entitlements"] ?? [],
                    "originalPurchaseDate": user?["first_seen_at"] ?? NSNull(),
                    "latestPurchaseDate": user?["last_seen_at"] ?? NSNull()
                ])
            } catch {
                call.reject("Failed to identify user: \(error.localizedDescription)")
            }
        }
    }

    @objc func logout(_ call: CAPPluginCall) {
        userId = nil
        call.resolve()
    }

    @objc func getUserInfo(_ call: CAPPluginCall) {
        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        Task {
            do {
                let response = try await apiRequest(
                    method: "GET",
                    path: "/v1/sdk/users/\(userId)/entitlements"
                )

                call.resolve([
                    "userId": userId,
                    "entitlements": response["entitlements"] ?? []
                ])
            } catch {
                call.reject("Failed to get user info: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Billing

    @objc func isBillingSupported(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            call.resolve(["isSupported": true])
        } else {
            call.resolve(["isSupported": false])
        }
    }

    // MARK: - Products & Offerings

    @objc func getOfferings(_ call: CAPPluginCall) {
        guard apiKey != nil else {
            call.reject("Not configured. Call configure() first.")
            return
        }

        // V0.5.21 — hit /v1/sdk/offerings?user_id=<id>, the canonical
        // SDK surface accepting publishable keys. Pre-fix called
        // /v1/offerings (404) and silently returned an empty paywall
        // — the customer's "Failed to get offerings:" with empty colon
        // came from this 404 with no body. Mirror the web layer:
        // crates/capivv-api/src/routes/sdk/mod.rs::get_offerings.
        let userIdParam: String = userId.flatMap {
            $0.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
                .map { "?user_id=\($0)" }
        } ?? ""

        Task {
            do {
                let response = try await apiRequest(
                    method: "GET",
                    path: "/v1/sdk/offerings\(userIdParam)"
                )

                guard let offerings = response["offerings"] as? [[String: Any]] else {
                    call.resolve(["offerings": []])
                    return
                }

                // V0.5.22 — parse the actual /v1/sdk/offerings response
                // shape. Pre-fix iterated `offering["products"]` and
                // pulled `store_product_id`, but the server returns
                // `offering["packages"]` with `pkg["product"]` nested
                // inside, and the product id field is `external_id`.
                // Customer's symptom on v0.5.21 was a fully-rendered
                // paywall with 0 packages — the guard fell through
                // because `offering["products"]` was nil.
                //
                // Mirror @capivv/capacitor-sdk's `mapOffering` (web.ts)
                // exactly, then optionally enrich each product with
                // StoreKit data when the device can enumerate it. When
                // StoreKit returns nothing (e.g. Apple's "first sub
                // must ship with v1" hold — products READY_TO_SUBMIT
                // but app v1.0 not yet submitted), the API-returned
                // `pkg.price.formatted` survives as `priceString` so
                // the user still sees real prices on device.
                var enrichedOfferings: [[String: Any]] = []

                for offering in offerings {
                    let packages = (offering["packages"] as? [[String: Any]]) ?? []

                    // Build the API-shape product list first. This is
                    // what we return when StoreKit can't enumerate.
                    var apiProducts: [[String: Any]] = []
                    var storeIds: [String] = []
                    var storeIdToIndex: [String: Int] = [:]
                    for pkg in packages {
                        let product = (pkg["product"] as? [String: Any]) ?? [:]
                        let identifier = (product["external_id"] as? String)
                            ?? (pkg["identifier"] as? String)
                            ?? ""
                        let priceObj = pkg["price"] as? [String: Any]
                        let priceFormatted = priceObj?["formatted"] as? String ?? ""
                        let amountCents = priceObj?["amount_cents"] as? Int ?? 0
                        let currency = priceObj?["currency"] as? String ?? "USD"
                        let entry: [String: Any] = [
                            "identifier": identifier,
                            "title": (product["display_name"] as? String) ?? "",
                            "description": (product["description"] as? String) ?? "",
                            "priceString": priceFormatted,
                            "priceAmountMicros": amountCents * 10000,
                            "currencyCode": currency,
                            "productType": (pkg["package_type"] as? String) ?? "subscription"
                        ]
                        if !identifier.isEmpty {
                            storeIdToIndex[identifier] = apiProducts.count
                            storeIds.append(identifier)
                        }
                        apiProducts.append(entry)
                    }

                    // Try StoreKit enrichment. We OVERWRITE the
                    // matching apiProducts entry with the StoreKit one
                    // because StoreKit's localized prices and trial
                    // info are richer; products StoreKit can't find
                    // keep their API-derived shape.
                    if #available(iOS 15.0, *), !storeIds.isEmpty {
                        do {
                            let storeProducts = try await Product.products(for: Set(storeIds))
                            for sk in storeProducts {
                                if let idx = storeIdToIndex[sk.id] {
                                    apiProducts[idx] = mapProduct(sk)
                                }
                            }
                        } catch {
                            log("StoreKit enrichment failed (using API prices): \(error.localizedDescription)")
                        }
                    }

                    var enrichedOffering = offering
                    enrichedOffering["products"] = apiProducts
                    enrichedOfferings.append(enrichedOffering)
                }

                call.resolve(["offerings": enrichedOfferings])
            } catch {
                call.reject("Failed to get offerings: \(error.localizedDescription)")
            }
        }
    }

    /// Fetch a paywall's declarative template from Capivv. Pure HTTP — no
    /// StoreKit involvement. Pairs with `<DynamicPaywall>` in
    /// `@capivv/capacitor-react` for OTA-updateable paywall configs.
    @objc func getPaywall(_ call: CAPPluginCall) {
        guard apiKey != nil else {
            call.reject("Not configured. Call configure() first.")
            return
        }

        guard let identifier = call.getString("identifier") else {
            call.reject("identifier is required")
            return
        }

        let encodedIdentifier = identifier.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) ?? identifier

        Task {
            do {
                let response = try await apiRequest(
                    method: "GET",
                    path: "/v1/paywalls/by-identifier/\(encodedIdentifier)/template"
                )

                let template = response["template"] ?? NSNull()
                let version = response["version"] as? String ?? "1.0.0"
                let updatedAt = response["updated_at"] as? String
                    ?? ISO8601DateFormatter().string(from: Date())
                var result: [String: Any] = [
                    "template": template,
                    "version": version,
                    "updatedAt": updatedAt
                ]
                if let ttl = response["cache_ttl_seconds"] as? Int {
                    result["cacheTtlSeconds"] = ttl
                }
                call.resolve(result)
            } catch let error as NSError where error.code == 404 {
                // Graceful fallback — no template configured for this id.
                call.resolve([
                    "template": NSNull(),
                    "version": "0.0.0",
                    "updatedAt": ISO8601DateFormatter().string(from: Date())
                ])
            } catch {
                call.reject("Failed to fetch paywall: \(error.localizedDescription)")
            }
        }
    }

    @objc func getProduct(_ call: CAPPluginCall) {
        guard let productIdentifier = call.getString("productIdentifier") else {
            call.reject("productIdentifier is required")
            return
        }

        Task {
            if #available(iOS 15.0, *) {
                do {
                    let products = try await Product.products(for: [productIdentifier])

                    guard let product = products.first else {
                        call.reject("Product not found: \(productIdentifier)")
                        return
                    }

                    call.resolve(["product": mapProduct(product)])
                } catch {
                    call.reject("Failed to get product: \(error.localizedDescription)")
                }
            } else {
                call.reject("StoreKit 2 requires iOS 15 or later")
            }
        }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let productIdentifiers = call.getArray("productIdentifiers", String.self) else {
            call.reject("productIdentifiers is required")
            return
        }

        Task {
            if #available(iOS 15.0, *) {
                do {
                    let products = try await Product.products(for: Set(productIdentifiers))
                    let mapped = products.map { mapProduct($0) }
                    call.resolve(["products": mapped])
                } catch {
                    call.reject("Failed to get products: \(error.localizedDescription)")
                }
            } else {
                call.reject("StoreKit 2 requires iOS 15 or later")
            }
        }
    }

    // MARK: - Purchases

    @objc func purchase(_ call: CAPPluginCall) {
        guard apiKey != nil else {
            call.reject("Not configured. Call configure() first.")
            return
        }

        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        guard let productIdentifier = call.getString("productIdentifier") else {
            call.reject("productIdentifier is required")
            return
        }

        Task {
            if #available(iOS 15.0, *) {
                do {
                    let products = try await Product.products(for: [productIdentifier])

                    guard let product = products.first else {
                        call.reject("Product not found: \(productIdentifier)")
                        return
                    }

                    let result = try await product.purchase()

                    switch result {
                    case .success(let verification):
                        switch verification {
                        case .verified(let transaction):
                            // Verify with Capivv backend
                            await verifyTransaction(transaction, userId: userId)
                            await transaction.finish()

                            let transactionData = mapTransaction(transaction)

                            notifyListeners("purchaseCompleted", data: ["transaction": transactionData])

                            call.resolve([
                                "success": true,
                                "transaction": transactionData
                            ])

                        case .unverified(let transaction, let error):
                            log("Transaction verification failed: \(error.localizedDescription)")
                            await transaction.finish()

                            notifyListeners("purchaseFailed", data: [
                                "productIdentifier": productIdentifier,
                                "error": "Transaction verification failed"
                            ])

                            call.resolve([
                                "success": false,
                                "error": "Transaction verification failed: \(error.localizedDescription)"
                            ])
                        }

                    case .userCancelled:
                        call.resolve([
                            "success": false,
                            "error": "User cancelled"
                        ])

                    case .pending:
                        call.resolve([
                            "success": false,
                            "error": "Purchase pending (awaiting approval)"
                        ])

                    @unknown default:
                        call.resolve([
                            "success": false,
                            "error": "Unknown purchase result"
                        ])
                    }
                } catch {
                    notifyListeners("purchaseFailed", data: [
                        "productIdentifier": productIdentifier,
                        "error": error.localizedDescription
                    ])

                    call.resolve([
                        "success": false,
                        "error": error.localizedDescription
                    ])
                }
            } else {
                call.reject("StoreKit 2 requires iOS 15 or later")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        Task {
            if #available(iOS 15.0, *) {
                do {
                    try await AppStore.sync()

                    // Verify all current entitlements with backend
                    for await result in Transaction.currentEntitlements {
                        if case .verified(let transaction) = result {
                            await verifyTransaction(transaction, userId: userId)
                        }
                    }

                    // Fetch updated entitlements
                    let response = try await apiRequest(
                        method: "GET",
                        path: "/v1/sdk/users/\(userId)/entitlements"
                    )

                    let entitlements = response["entitlements"] ?? []

                    notifyListeners("entitlementsUpdated", data: ["entitlements": entitlements])

                    call.resolve(["entitlements": entitlements])
                } catch {
                    call.reject("Failed to restore purchases: \(error.localizedDescription)")
                }
            } else {
                call.reject("StoreKit 2 requires iOS 15 or later")
            }
        }
    }

    // MARK: - Entitlements

    @objc func checkEntitlement(_ call: CAPPluginCall) {
        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        guard let entitlementIdentifier = call.getString("entitlementIdentifier") else {
            call.reject("entitlementIdentifier is required")
            return
        }

        Task {
            do {
                let response = try await apiRequest(
                    method: "GET",
                    path: "/v1/sdk/users/\(userId)/entitlements"
                )

                guard let entitlements = response["entitlements"] as? [[String: Any]] else {
                    call.resolve([
                        "hasAccess": false
                    ])
                    return
                }

                if let entitlement = entitlements.first(where: { ($0["identifier"] as? String) == entitlementIdentifier }) {
                    let isActive = entitlement["is_active"] as? Bool ?? false
                    call.resolve([
                        "hasAccess": isActive,
                        "entitlement": entitlement
                    ])
                } else {
                    call.resolve([
                        "hasAccess": false
                    ])
                }
            } catch {
                call.reject("Failed to check entitlement: \(error.localizedDescription)")
            }
        }
    }

    @objc func getEntitlements(_ call: CAPPluginCall) {
        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        Task {
            do {
                let response = try await apiRequest(
                    method: "GET",
                    path: "/v1/sdk/users/\(userId)/entitlements"
                )

                call.resolve([
                    "entitlements": response["entitlements"] ?? []
                ])
            } catch {
                call.reject("Failed to get entitlements: \(error.localizedDescription)")
            }
        }
    }

    @objc func syncPurchases(_ call: CAPPluginCall) {
        guard let userId = userId else {
            call.reject("Not identified. Call identify() first.")
            return
        }

        Task {
            if #available(iOS 15.0, *) {
                do {
                    // Sync current entitlements with backend
                    for await result in Transaction.currentEntitlements {
                        if case .verified(let transaction) = result {
                            await verifyTransaction(transaction, userId: userId)
                        }
                    }

                    // Fetch updated entitlements
                    let response = try await apiRequest(
                        method: "GET",
                        path: "/v1/sdk/users/\(userId)/entitlements"
                    )

                    let entitlements = response["entitlements"] ?? []

                    notifyListeners("entitlementsUpdated", data: ["entitlements": entitlements])

                    call.resolve(["entitlements": entitlements])
                } catch {
                    call.reject("Failed to sync purchases: \(error.localizedDescription)")
                }
            } else {
                // Fallback for older iOS - just fetch from server
                do {
                    let response = try await apiRequest(
                        method: "GET",
                        path: "/v1/sdk/users/\(userId)/entitlements"
                    )

                    call.resolve(["entitlements": response["entitlements"] ?? []])
                } catch {
                    call.reject("Failed to sync purchases: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            if #available(iOS 15.0, *) {
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                    do {
                        try await AppStore.showManageSubscriptions(in: windowScene)
                        call.resolve()
                    } catch {
                        call.reject("Failed to show subscription management: \(error.localizedDescription)")
                    }
                } else {
                    call.reject("Could not find active window scene")
                }
            } else {
                // Fallback to opening App Store subscription settings
                if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                    await UIApplication.shared.open(url)
                    call.resolve()
                } else {
                    call.reject("Could not open subscription management")
                }
            }
        }
    }

    // MARK: - Private Helpers

    private func startTransactionObserver() {
        if #available(iOS 15.0, *) {
            transactionObserver = Task(priority: .background) {
                for await result in Transaction.updates {
                    if case .verified(let transaction) = result {
                        if let userId = self.userId {
                            await self.verifyTransaction(transaction, userId: userId)
                        }
                        await transaction.finish()
                    }
                }
            }
        }
    }

    @available(iOS 15.0, *)
    private func verifyTransaction(_ transaction: Transaction, userId: String) async {
        do {
            // Get the receipt data
            let receiptUrl = Bundle.main.appStoreReceiptURL
            var receiptData: String?

            if let url = receiptUrl, let data = try? Data(contentsOf: url) {
                receiptData = data.base64EncodedString()
            }

            // V0.5.21 — POST /v1/sdk/receipts with the body shape
            // SubmitReceiptRequest expects (see
            // crates/capivv-api/src/routes/sdk/mod.rs). Pre-fix POSTed
            // to /v1/purchases/apple/verify (server admin route, sk_-only)
            // with the wrong body — every StoreKit transaction failed
            // verification silently, blocking entitlement grants.
            //
            // idempotency_key uses the transaction id so retries / the
            // Transaction.updates observer can re-submit safely.
            _ = try await apiRequest(
                method: "POST",
                path: "/v1/sdk/receipts",
                body: [
                    "user_id": userId,
                    "platform": "ios",
                    "receipt_data": receiptData as Any,
                    "product_id": transaction.productID,
                    "bundle_id": Bundle.main.bundleIdentifier as Any,
                    "idempotency_key": String(transaction.id)
                ]
            )

            log("Transaction verified: \(transaction.id)")
        } catch {
            log("Failed to verify transaction: \(error.localizedDescription)")
        }
    }

    @available(iOS 15.0, *)
    private func mapProduct(_ product: Product) -> [String: Any] {
        var result: [String: Any] = [
            "identifier": product.id,
            "title": product.displayName,
            "description": product.description,
            "priceString": product.displayPrice,
            "priceAmountMicros": Int((product.price as NSDecimalNumber).doubleValue * 1_000_000),
            "currencyCode": product.priceFormatStyle.currencyCode
        ]

        switch product.type {
        case .autoRenewable:
            result["productType"] = "SUBSCRIPTION"
            if let subscription = product.subscription {
                result["subscriptionPeriod"] = formatPeriod(subscription.subscriptionPeriod)
                if let introOffer = subscription.introductoryOffer {
                    result["trialPeriod"] = formatPeriod(introOffer.period)
                }
            }
        case .consumable, .nonConsumable:
            result["productType"] = "INAPP"
        default:
            result["productType"] = "INAPP"
        }

        return result
    }

    @available(iOS 15.0, *)
    private func mapTransaction(_ transaction: Transaction) -> [String: Any] {
        var result: [String: Any] = [
            "transactionId": String(transaction.id),
            "productIdentifier": transaction.productID,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
            "isAcknowledged": true,
            "state": "PURCHASED"
        ]

        if let expirationDate = transaction.expirationDate {
            result["expirationDate"] = ISO8601DateFormatter().string(from: expirationDate)
        }

        return result
    }

    @available(iOS 15.0, *)
    private func formatPeriod(_ period: Product.SubscriptionPeriod) -> String {
        switch period.unit {
        case .day:
            return "\(period.value) day\(period.value == 1 ? "" : "s")"
        case .week:
            return "\(period.value) week\(period.value == 1 ? "" : "s")"
        case .month:
            return "\(period.value) month\(period.value == 1 ? "" : "s")"
        case .year:
            return "\(period.value) year\(period.value == 1 ? "" : "s")"
        @unknown default:
            return "\(period.value) unit\(period.value == 1 ? "" : "s")"
        }
    }

    private func apiRequest(method: String, path: String, body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let apiKey = apiKey else {
            throw NSError(domain: "CapivvPlugin", code: 1, userInfo: [NSLocalizedDescriptionKey: "Not configured"])
        }

        guard let url = URL(string: "\(apiUrl)\(path)") else {
            throw NSError(domain: "CapivvPlugin", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(apiKey, forHTTPHeaderField: "X-Capivv-Api-Key")

        if let body = body, method != "GET" {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "CapivvPlugin", code: 3, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        if httpResponse.statusCode < 200 || httpResponse.statusCode >= 300 {
            // V0.5.21 — surface the server's response body in the error
            // message AND log to NSLog at warn level so the React layer
            // gets something useful instead of "Failed to get offerings:"
            // with an empty colon (customer's reported symptom).
            let body = String(data: data, encoding: .utf8) ?? "<empty>"
            let message = "Capivv API error \(httpResponse.statusCode) on \(method) \(path): \(body)"
            NSLog("[Capivv][warn] %@", message)
            throw NSError(
                domain: "CapivvPlugin",
                code: httpResponse.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message]
            )
        }

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return json
        }

        return [:]
    }

    private func log(_ message: String) {
        if debug {
            print("[Capivv] \(message)")
        }
    }
}
