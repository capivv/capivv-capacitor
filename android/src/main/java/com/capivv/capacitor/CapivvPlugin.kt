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
    private var apiUrl: String = "https://api.capivv.com"
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
        val attributes = call.getObject("attributes") ?: JSObject()

        scope.launch {
            try {
                val body = JSONObject().apply {
                    put("attributes", attributes)
                }

                val response = apiRequest("POST", "/v1/users/$uid/login", body)

                call.resolve(JSObject().apply {
                    put("userId", uid)
                    put("entitlements", response.optJSONArray("entitlements") ?: JSONArray())
                    put("originalPurchaseDate", response.optString("original_purchase_date", null))
                    put("latestPurchaseDate", response.optString("latest_purchase_date", null))
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
                val response = apiRequest("GET", "/v1/users/$uid/entitlements")

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

        scope.launch {
            try {
                val response = apiRequest("GET", "/v1/offerings")
                val offerings = response.optJSONArray("offerings") ?: JSONArray()

                val enrichedOfferings = JSONArray()

                for (i in 0 until offerings.length()) {
                    val offering = offerings.getJSONObject(i)
                    val products = offering.optJSONArray("products") ?: JSONArray()

                    val productIds = mutableListOf<String>()
                    for (j in 0 until products.length()) {
                        val product = products.getJSONObject(j)
                        product.optString("store_product_id")?.let { productIds.add(it) }
                    }

                    val enrichedProducts = queryProducts(productIds)

                    val enrichedOffering = JSONObject(offering.toString())
                    enrichedOffering.put("products", enrichedProducts)
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
                val response = apiRequest("GET", "/v1/users/$uid/entitlements")
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
                val response = apiRequest("GET", "/v1/users/$uid/entitlements")
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
                val response = apiRequest("GET", "/v1/users/$uid/entitlements")

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
                    val response = apiRequest("GET", "/v1/users/$uid/entitlements")

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
                val response = apiRequest("GET", "/v1/users/$uid/entitlements")
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
            val body = JSONObject().apply {
                put("user_id", userId)
                put("purchase_token", purchase.purchaseToken)
                put("product_ids", JSONArray(purchase.products))
                put("order_id", purchase.orderId)
            }

            apiRequest("POST", "/v1/purchases/google/verify", body)
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
                        cont.resumeWithException(Exception("API error (${response.code}): $responseBody"))
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
