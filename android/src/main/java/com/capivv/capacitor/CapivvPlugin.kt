package com.capivv.capacitor

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.android.billingclient.api.*
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

@CapacitorPlugin(name = "Capivv")
class CapivvPlugin : Plugin() {

    private var apiKey: String? = null
    private var apiUrl: String = "https://app.capivv.com"
    private var userId: String? = null
    private var debug: Boolean = false

    private var billingClient: BillingClient? = null
    private val httpClient = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    private val purchasesUpdatedListener = PurchasesUpdatedListener { billingResult, purchases ->
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                handlePurchase(purchase)
            }
        }
    }

    override fun load() {
        super.load()
        initBillingClient()
    }

    private fun initBillingClient() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases()
            .build()

        billingClient?.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(billingResult: BillingResult) {
                if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    log("Billing client connected")
                } else {
                    log("Billing client setup failed: ${billingResult.debugMessage}")
                }
            }

            override fun onBillingServiceDisconnected() {
                log("Billing client disconnected")
            }
        })
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            scope.launch {
                try {
                    userId?.let { uid ->
                        verifyPurchase(purchase, uid)
                    }

                    // Acknowledge if not already
                    if (!purchase.isAcknowledged) {
                        val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
                            .setPurchaseToken(purchase.purchaseToken)
                            .build()

                        billingClient?.acknowledgePurchase(acknowledgePurchaseParams) { result ->
                            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                                log("Purchase acknowledged")
                            }
                        }
                    }

                    val transactionData = mapPurchaseToTransaction(purchase)
                    notifyListeners("purchaseCompleted", JSObject().apply {
                        put("transaction", transactionData)
                    })
                } catch (e: Exception) {
                    log("Error handling purchase: ${e.message}")
                }
            }
        }
    }

    // MARK: - Configuration

    @PluginMethod
    fun configure(call: PluginCall) {
        val key = call.getString("apiKey")
        if (key == null) {
            call.reject("apiKey is required")
            return
        }

        apiKey = key
        call.getString("apiUrl")?.let { apiUrl = it }
        debug = call.getBoolean("debug") ?: false

        log("Configured with API URL: $apiUrl")
        call.resolve()
    }

    // MARK: - User Management

    @PluginMethod
    fun identify(call: PluginCall) {
        if (apiKey == null) {
            call.reject("Not configured. Call configure() first.")
            return
        }

        val uid = call.getString("userId")
        if (uid == null) {
            call.reject("userId is required")
            return
        }

        userId = uid

        scope.launch {
            try {
                // V0.5.21 — POST /v1/sdk/users with `{ external_id }`,
                // matching the canonical SDK endpoint
                // (crates/capivv-api/src/routes/sdk/mod.rs::create_or_get_user).
                // Pre-fix POSTed to /v1/users/{id}/login (404 on the
                // server). Same family of bug the customer's iOS audit
                // caught for getOfferings.
                val body = JSONObject().apply {
                    put("external_id", uid)
                }

                val response = apiRequest("POST", "/v1/sdk/users", body)
                val user = response.optJSONObject("user")

                call.resolve(JSObject().apply {
                    put("userId", uid)
                    put("entitlements", response.optJSONArray("entitlements") ?: JSONArray())
                    put("originalPurchaseDate", user?.optString("first_seen_at"))
                    put("latestPurchaseDate", user?.optString("last_seen_at"))
                })
            } catch (e: Exception) {
                call.reject("Failed to identify user: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun logout(call: PluginCall) {
        userId = null
        call.resolve()
    }

    @PluginMethod
    fun getUserInfo(call: PluginCall) {
        val uid = userId
        if (uid == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        scope.launch {
            try {
                val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")

                call.resolve(JSObject().apply {
                    put("userId", uid)
                    put("entitlements", response.optJSONArray("entitlements") ?: JSONArray())
                })
            } catch (e: Exception) {
                call.reject("Failed to get user info: ${e.message}")
            }
        }
    }

    // MARK: - Billing

    @PluginMethod
    fun isBillingSupported(call: PluginCall) {
        val isReady = billingClient?.isReady ?: false
        call.resolve(JSObject().apply {
            put("isSupported", isReady)
        })
    }

    // MARK: - Products & Offerings

    @PluginMethod
    fun getOfferings(call: PluginCall) {
        if (apiKey == null) {
            call.reject("Not configured. Call configure() first.")
            return
        }

        // V0.5.21 — /v1/sdk/offerings?user_id=<id>, the canonical SDK
        // endpoint. Pre-fix called /v1/offerings (404 — confirmed by
        // customer's curl on 2026-05-05). Same fix as iOS getOfferings.
        val userIdParam = userId?.let {
            "?user_id=" + java.net.URLEncoder.encode(it, "UTF-8")
        } ?: ""

        scope.launch {
            try {
                val response = apiRequest("GET", "/v1/sdk/offerings$userIdParam")
                val offerings = response.optJSONArray("offerings") ?: JSONArray()

                // V0.5.22 — parse the actual /v1/sdk/offerings response
                // shape: `offering.packages[].product.external_id` (was
                // `offering.products[].store_product_id`). Same fix as
                // iOS Swift's getOfferings rewrite this same release.
                //
                // We always populate the API-derived product first so
                // when Google Play Billing can't enumerate the product
                // (test device without an account, app not yet
                // submitted, etc.) the user still sees real prices
                // from `pkg.price.formatted`.
                val enrichedOfferings = JSONArray()

                for (i in 0 until offerings.length()) {
                    val offering = offerings.getJSONObject(i)
                    val packages = offering.optJSONArray("packages") ?: JSONArray()

                    val apiProducts = JSONArray()
                    val storeIds = mutableListOf<String>()
                    val storeIdToIndex = mutableMapOf<String, Int>()
                    for (j in 0 until packages.length()) {
                        val pkg = packages.getJSONObject(j)
                        val product = pkg.optJSONObject("product") ?: JSONObject()
                        val identifier = product.optString("external_id").ifEmpty {
                            pkg.optString("identifier")
                        }
                        val price = pkg.optJSONObject("price")
                        val entry = JSONObject().apply {
                            put("identifier", identifier)
                            put("title", product.optString("display_name"))
                            put("description", product.optString("description"))
                            put("priceString", price?.optString("formatted") ?: "")
                            put("priceAmountMicros", (price?.optLong("amount_cents") ?: 0L) * 10000L)
                            put("currencyCode", price?.optString("currency") ?: "USD")
                            put("productType", pkg.optString("package_type", "subscription"))
                        }
                        if (identifier.isNotEmpty()) {
                            storeIdToIndex[identifier] = j
                            storeIds.add(identifier)
                        }
                        apiProducts.put(entry)
                    }

                    // Try Play Billing enrichment. queryProducts returns
                    // an array of products it could find; merge by
                    // identifier so unfound products keep their API
                    // shape.
                    if (storeIds.isNotEmpty()) {
                        try {
                            val storeProducts = queryProducts(storeIds)
                            for (k in 0 until storeProducts.length()) {
                                val sk = storeProducts.getJSONObject(k)
                                val skId = sk.optString("identifier")
                                val idx = storeIdToIndex[skId]
                                if (idx != null) {
                                    apiProducts.put(idx, sk)
                                }
                            }
                        } catch (e: Exception) {
                            log("Play Billing enrichment failed (using API prices): ${e.message}")
                        }
                    }

                    val enrichedOffering = JSONObject(offering.toString())
                    enrichedOffering.put("products", apiProducts)
                    enrichedOfferings.put(enrichedOffering)
                }

                call.resolve(JSObject().apply {
                    put("offerings", enrichedOfferings)
                })
            } catch (e: Exception) {
                call.reject("Failed to get offerings: ${e.message}")
            }
        }
    }

    /**
     * Fetch a paywall's declarative template from Capivv. Pure HTTP — no
     * Google Play Billing involvement. Pairs with `<DynamicPaywall>` in
     * `@capivv/capacitor-react` for OTA-updateable paywall configs.
     */
    @PluginMethod
    fun getPaywall(call: PluginCall) {
        if (apiKey == null) {
            call.reject("Not configured. Call configure() first.")
            return
        }

        val identifier = call.getString("identifier")
        if (identifier == null) {
            call.reject("identifier is required")
            return
        }

        val encodedIdentifier = java.net.URLEncoder.encode(identifier, "UTF-8")

        scope.launch {
            try {
                val response = apiRequest(
                    "GET",
                    "/v1/paywalls/by-identifier/$encodedIdentifier/template"
                )
                val result = JSObject()
                if (response.isNull("template")) {
                    result.put("template", JSONObject.NULL)
                } else {
                    result.put("template", response.opt("template"))
                }
                result.put("version", response.optString("version", "1.0.0"))
                result.put(
                    "updatedAt",
                    response.optString("updated_at", java.time.Instant.now().toString())
                )
                if (response.has("cache_ttl_seconds") && !response.isNull("cache_ttl_seconds")) {
                    result.put("cacheTtlSeconds", response.getInt("cache_ttl_seconds"))
                }
                call.resolve(result)
            } catch (e: Exception) {
                // 404 → graceful "no template configured" fallback.
                // 401/403/5xx/network → reject with the real reason so
                // the caller can surface it. v0.5.19 fix — pre-fix used
                // `e.message?.contains("404")` which was both fragile
                // (matched any error containing "404") and silenced
                // 401s as if they were graceful fallbacks.
                if (e is CapivvApiException && e.status == 404) {
                    val fallback = JSObject().apply {
                        put("template", JSONObject.NULL)
                        put("version", "0.0.0")
                        put("updatedAt", java.time.Instant.now().toString())
                    }
                    call.resolve(fallback)
                } else {
                    android.util.Log.w(
                        "Capivv",
                        "getPaywall failed for '$identifier': ${e.message}"
                    )
                    call.reject("Failed to fetch paywall: ${e.message}")
                }
            }
        }
    }

    @PluginMethod
    fun getProduct(call: PluginCall) {
        val productIdentifier = call.getString("productIdentifier")
        if (productIdentifier == null) {
            call.reject("productIdentifier is required")
            return
        }

        scope.launch {
            try {
                val products = queryProducts(listOf(productIdentifier))

                if (products.length() == 0) {
                    call.reject("Product not found: $productIdentifier")
                    return@launch
                }

                call.resolve(JSObject().apply {
                    put("product", products.getJSONObject(0))
                })
            } catch (e: Exception) {
                call.reject("Failed to get product: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val productIdentifiers = call.getArray("productIdentifiers")?.toList<String>()
        if (productIdentifiers == null) {
            call.reject("productIdentifiers is required")
            return
        }

        scope.launch {
            try {
                val products = queryProducts(productIdentifiers)

                call.resolve(JSObject().apply {
                    put("products", products)
                })
            } catch (e: Exception) {
                call.reject("Failed to get products: ${e.message}")
            }
        }
    }

    private suspend fun queryProducts(productIds: List<String>): JSONArray = suspendCoroutine { cont ->
        val client = billingClient
        if (client == null || !client.isReady) {
            cont.resume(JSONArray())
            return@suspendCoroutine
        }

        val productList = productIds.map { productId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(productId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }

        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                val products = JSONArray()
                for (details in productDetailsList) {
                    products.put(mapProductDetails(details))
                }
                cont.resume(products)
            } else {
                cont.resume(JSONArray())
            }
        }
    }

    // MARK: - Purchases

    @PluginMethod
    fun purchase(call: PluginCall) {
        if (apiKey == null) {
            call.reject("Not configured. Call configure() first.")
            return
        }

        if (userId == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        val productIdentifier = call.getString("productIdentifier")
        if (productIdentifier == null) {
            call.reject("productIdentifier is required")
            return
        }

        val client = billingClient
        if (client == null || !client.isReady) {
            call.resolve(JSObject().apply {
                put("success", false)
                put("error", "Billing client not ready")
            })
            return
        }

        scope.launch {
            try {
                val productList = listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productIdentifier)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                )

                val params = QueryProductDetailsParams.newBuilder()
                    .setProductList(productList)
                    .build()

                client.queryProductDetailsAsync(params) { billingResult, productDetailsList ->
                    if (billingResult.responseCode != BillingClient.BillingResponseCode.OK || productDetailsList.isEmpty()) {
                        call.resolve(JSObject().apply {
                            put("success", false)
                            put("error", "Product not found: $productIdentifier")
                        })
                        return@queryProductDetailsAsync
                    }

                    val productDetails = productDetailsList[0]

                    // Get the offer token for subscriptions
                    val offerToken = productDetails.subscriptionOfferDetails?.firstOrNull()?.offerToken

                    val productDetailsParamsList = listOf(
                        BillingFlowParams.ProductDetailsParams.newBuilder()
                            .setProductDetails(productDetails)
                            .apply {
                                offerToken?.let { setOfferToken(it) }
                            }
                            .build()
                    )

                    val billingFlowParams = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(productDetailsParamsList)
                        .build()

                    val launchResult = client.launchBillingFlow(activity, billingFlowParams)

                    if (launchResult.responseCode != BillingClient.BillingResponseCode.OK) {
                        call.resolve(JSObject().apply {
                            put("success", false)
                            put("error", "Failed to launch billing flow: ${launchResult.debugMessage}")
                        })
                    }
                    // Purchase result will be handled by purchasesUpdatedListener
                    // We don't resolve here - the listener will handle it
                }
            } catch (e: Exception) {
                call.resolve(JSObject().apply {
                    put("success", false)
                    put("error", e.message)
                })
            }
        }
    }

    @PluginMethod
    fun restorePurchases(call: PluginCall) {
        val uid = userId
        if (uid == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        val client = billingClient
        if (client == null || !client.isReady) {
            call.reject("Billing client not ready")
            return
        }

        scope.launch {
            try {
                val params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                val purchasesResult = client.queryPurchasesAsync(params)

                if (purchasesResult.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    for (purchase in purchasesResult.purchasesList) {
                        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                            verifyPurchase(purchase, uid)
                        }
                    }
                }

                // Fetch updated entitlements
                val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")
                val entitlements = response.optJSONArray("entitlements") ?: JSONArray()

                notifyListeners("entitlementsUpdated", JSObject().apply {
                    put("entitlements", entitlements)
                })

                call.resolve(JSObject().apply {
                    put("entitlements", entitlements)
                })
            } catch (e: Exception) {
                call.reject("Failed to restore purchases: ${e.message}")
            }
        }
    }

    // MARK: - Entitlements

    @PluginMethod
    fun checkEntitlement(call: PluginCall) {
        val uid = userId
        if (uid == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        val entitlementIdentifier = call.getString("entitlementIdentifier")
        if (entitlementIdentifier == null) {
            call.reject("entitlementIdentifier is required")
            return
        }

        scope.launch {
            try {
                val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")
                val entitlements = response.optJSONArray("entitlements") ?: JSONArray()

                for (i in 0 until entitlements.length()) {
                    val entitlement = entitlements.getJSONObject(i)
                    if (entitlement.optString("identifier") == entitlementIdentifier) {
                        val isActive = entitlement.optBoolean("is_active", false)
                        call.resolve(JSObject().apply {
                            put("hasAccess", isActive)
                            put("entitlement", entitlement.toString())
                        })
                        return@launch
                    }
                }

                call.resolve(JSObject().apply {
                    put("hasAccess", false)
                })
            } catch (e: Exception) {
                call.reject("Failed to check entitlement: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getEntitlements(call: PluginCall) {
        val uid = userId
        if (uid == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        scope.launch {
            try {
                val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")

                call.resolve(JSObject().apply {
                    put("entitlements", response.optJSONArray("entitlements") ?: JSONArray())
                })
            } catch (e: Exception) {
                call.reject("Failed to get entitlements: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun syncPurchases(call: PluginCall) {
        val uid = userId
        if (uid == null) {
            call.reject("Not identified. Call identify() first.")
            return
        }

        val client = billingClient
        if (client == null || !client.isReady) {
            // If billing client is not ready, just fetch from server
            scope.launch {
                try {
                    val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")

                    call.resolve(JSObject().apply {
                        put("entitlements", response.optJSONArray("entitlements") ?: JSONArray())
                    })
                } catch (e: Exception) {
                    call.reject("Failed to sync purchases: ${e.message}")
                }
            }
            return
        }

        scope.launch {
            try {
                val params = QueryPurchasesParams.newBuilder()
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()

                val purchasesResult = client.queryPurchasesAsync(params)

                if (purchasesResult.billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                    for (purchase in purchasesResult.purchasesList) {
                        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                            verifyPurchase(purchase, uid)
                        }
                    }
                }

                // Fetch updated entitlements
                val response = apiRequest("GET", "/v1/sdk/users/$uid/entitlements")
                val entitlements = response.optJSONArray("entitlements") ?: JSONArray()

                notifyListeners("entitlementsUpdated", JSObject().apply {
                    put("entitlements", entitlements)
                })

                call.resolve(JSObject().apply {
                    put("entitlements", entitlements)
                })
            } catch (e: Exception) {
                call.reject("Failed to sync purchases: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun manageSubscriptions(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("https://play.google.com/store/account/subscriptions")
            }
            activity.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open subscription management: ${e.message}")
        }
    }

    // MARK: - Private Helpers

    private suspend fun verifyPurchase(purchase: Purchase, userId: String) {
        try {
            // V0.5.21 — POST /v1/sdk/receipts with the body shape
            // SubmitReceiptRequest expects (see
            // crates/capivv-api/src/routes/sdk/mod.rs). Pre-fix POSTed
            // to /v1/purchases/google/verify (server admin route,
            // sk_-only) so every Google Play transaction failed
            // verification silently. Idempotency key is the order id.
            val productId = purchase.products.firstOrNull()
            val body = JSONObject().apply {
                put("user_id", userId)
                put("platform", "android")
                put("receipt_data", purchase.purchaseToken)
                if (productId != null) put("product_id", productId)
                put("bundle_id", activity?.packageName ?: "")
                put("idempotency_key", purchase.orderId ?: purchase.purchaseToken)
            }

            apiRequest("POST", "/v1/sdk/receipts", body)
            log("Purchase verified: ${purchase.orderId}")
        } catch (e: Exception) {
            log("Failed to verify purchase: ${e.message}")
        }
    }

    private fun mapProductDetails(details: ProductDetails): JSONObject {
        val result = JSONObject().apply {
            put("identifier", details.productId)
            put("title", details.title)
            put("description", details.description)
        }

        details.subscriptionOfferDetails?.firstOrNull()?.let { offer ->
            val pricingPhase = offer.pricingPhases.pricingPhaseList.firstOrNull()
            pricingPhase?.let { phase ->
                result.put("priceString", phase.formattedPrice)
                result.put("priceAmountMicros", phase.priceAmountMicros)
                result.put("currencyCode", phase.priceCurrencyCode)
                result.put("productType", "SUBSCRIPTION")
                result.put("subscriptionPeriod", phase.billingPeriod)
            }

            // Check for free trial
            offer.pricingPhases.pricingPhaseList.find { it.priceAmountMicros == 0L }?.let { trial ->
                result.put("trialPeriod", trial.billingPeriod)
            }
        }

        details.oneTimePurchaseOfferDetails?.let { offer ->
            result.put("priceString", offer.formattedPrice)
            result.put("priceAmountMicros", offer.priceAmountMicros)
            result.put("currencyCode", offer.priceCurrencyCode)
            result.put("productType", "INAPP")
        }

        return result
    }

    private fun mapPurchaseToTransaction(purchase: Purchase): JSObject {
        return JSObject().apply {
            put("transactionId", purchase.orderId ?: "")
            put("productIdentifier", purchase.products.firstOrNull() ?: "")
            put("purchaseDate", java.time.Instant.ofEpochMilli(purchase.purchaseTime).toString())
            put("isAcknowledged", purchase.isAcknowledged)
            put("state", when (purchase.purchaseState) {
                Purchase.PurchaseState.PURCHASED -> "PURCHASED"
                Purchase.PurchaseState.PENDING -> "PENDING"
                else -> "FAILED"
            })
            put("purchaseToken", purchase.purchaseToken)
        }
    }

    private suspend fun apiRequest(method: String, path: String, body: JSONObject? = null): JSONObject =
        suspendCoroutine { cont ->
            val key = apiKey
            if (key == null) {
                cont.resumeWithException(Exception("Not configured"))
                return@suspendCoroutine
            }

            val url = "$apiUrl$path"

            val requestBuilder = Request.Builder()
                .url(url)
                .addHeader("Content-Type", "application/json")
                .addHeader("X-Capivv-Api-Key", key)

            when (method) {
                "GET" -> requestBuilder.get()
                "POST" -> requestBuilder.post(
                    (body?.toString() ?: "{}").toRequestBody("application/json".toMediaType())
                )
                "PUT" -> requestBuilder.put(
                    (body?.toString() ?: "{}").toRequestBody("application/json".toMediaType())
                )
                "DELETE" -> requestBuilder.delete()
            }

            httpClient.newCall(requestBuilder.build()).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    cont.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    val responseBody = response.body?.string() ?: "{}"

                    if (!response.isSuccessful) {
                        // v0.5.19 — typed exception with `status` so callers
                        // (notably getPaywall) can reliably discriminate
                        // 404 (graceful fallback) from 401/5xx (real
                        // failure that should propagate). Pre-fix used a
                        // fragile `e.message?.contains("404")` check.
                        // v0.5.21 — also Log.w so dev-mode tracing is
                        // visible without flipping debug:true.
                        android.util.Log.w(
                            "Capivv",
                            "API error ${response.code} on $method $path: $responseBody"
                        )
                        cont.resumeWithException(
                            CapivvApiException(response.code, responseBody)
                        )
                        return
                    }

                    try {
                        cont.resume(JSONObject(responseBody))
                    } catch (e: Exception) {
                        cont.resume(JSONObject())
                    }
                }
            })
        }

    private fun log(message: String) {
        if (debug) {
            android.util.Log.d("Capivv", message)
        }
    }

    override fun handleOnDestroy() {
        super.handleOnDestroy()
        billingClient?.endConnection()
        scope.cancel()
    }
}

/**
 * Typed exception carrying the HTTP status code so callers can
 * discriminate 404 from 401/5xx. Mirrors the TypeScript
 * `CapivvApiError` in the web layer (v0.5.19).
 */
class CapivvApiException(
    val status: Int,
    val responseBody: String,
) : Exception("Capivv API error ($status): $responseBody")
