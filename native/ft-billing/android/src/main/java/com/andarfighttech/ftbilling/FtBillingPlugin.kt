package com.andarfighttech.ftbilling

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.android.billingclient.api.*
import com.getcapacitor.*
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityServiceException
import com.google.android.play.core.integrity.IntegrityTokenRequest
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

@CapacitorPlugin(name = "FtBilling")
class FtBillingPlugin : Plugin() {
    private data class PendingOperation(val run: () -> Unit, val fail: (String) -> Unit)
    private lateinit var billingClient: BillingClient
    private val cachedProducts = ConcurrentHashMap<String, ProductDetails>()
    private val connectionLock = Any()
    private val pendingOperations = mutableListOf<PendingOperation>()
    private var connecting = false

    private val purchasesUpdatedListener = PurchasesUpdatedListener { result, purchases ->
        notifyListeners(
            "purchasesUpdated",
            purchasesResult(responseCodeName(result.responseCode), purchases ?: emptyList())
        )
    }

    override fun load() {
        billingClient = BillingClient.newBuilder(context)
            .setListener(purchasesUpdatedListener)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build()
    }

    @PluginMethod
    fun deviceInfo(call: PluginCall) {
        val id = Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) ?: ""
        call.resolve(JSObject().put("androidId", id))
    }

    @PluginMethod
    fun getProducts(call: PluginCall) {
        val value = call.getArray("productIds") ?: return call.reject("productIds is required")
        val ids = try {
            (0 until value.length()).map {
                value.get(it) as? String ?: throw IllegalArgumentException()
            }
        } catch (_: Exception) {
            return call.reject("productIds must be a string array")
        }
        if (ids.isEmpty()) return call.resolve(productQueryResult("DEVELOPER_ERROR"))
        ids.forEach { cachedProducts.remove(it) }
        withBillingConnection(
            run = {
                try {
                    val products = ids.map {
                        QueryProductDetailsParams.Product.newBuilder().setProductId(it)
                            .setProductType(BillingClient.ProductType.SUBS).build()
                    }
                    val params = QueryProductDetailsParams.newBuilder().setProductList(products).build()
                    billingClient.queryProductDetailsAsync(params) { result, queryResult ->
                        try {
                            val details = queryResult.getProductDetailsList()
                            details.forEach { cachedProducts[it.getProductId()] = it }
                            call.resolve(productQueryResult(
                                responseCodeName(result.responseCode), details,
                                queryResult.getUnfetchedProductList()
                            ))
                        } catch (_: Exception) {
                            call.resolve(productQueryResult("ERROR"))
                        }
                    }
                } catch (_: Exception) {
                    call.resolve(productQueryResult("ERROR"))
                }
            },
            fail = { call.resolve(productQueryResult(it)) }
        )
    }

    @PluginMethod
    fun purchase(call: PluginCall) {
        val productId = call.getString("productId") ?: return call.reject("productId is required")
        val offerToken = call.getString("offerToken") ?: return call.reject("offerToken is required")
        val product = cachedProducts[productId]
            ?: return call.resolve(response("ITEM_UNAVAILABLE"))
        withBillingConnection(
            run = {
                val host = activity ?: return@withBillingConnection call.resolve(response("ERROR"))
                try {
                    val productParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(product).setOfferToken(offerToken).build()
                    val params = BillingFlowParams.newBuilder()
                        .setProductDetailsParamsList(listOf(productParams)).build()
                    host.runOnUiThread {
                        try {
                            val result = billingClient.launchBillingFlow(host, params)
                            call.resolve(response(responseCodeName(result.responseCode)))
                        } catch (_: Exception) {
                            call.resolve(response("ERROR"))
                        }
                    }
                } catch (_: Exception) {
                    call.resolve(response("ERROR"))
                }
            },
            fail = { call.resolve(response(it)) }
        )
    }

    @PluginMethod
    fun queryPurchases(call: PluginCall) {
        withBillingConnection(
            run = {
                try {
                    val params = QueryPurchasesParams.newBuilder()
                        .setProductType(BillingClient.ProductType.SUBS).build()
                    billingClient.queryPurchasesAsync(params) { result, purchases ->
                        call.resolve(purchasesResult(responseCodeName(result.responseCode), purchases))
                    }
                } catch (_: Exception) {
                    call.resolve(purchasesResult("ERROR"))
                }
            },
            fail = { call.resolve(purchasesResult(it)) }
        )
    }

    @PluginMethod
    fun integrityToken(call: PluginCall) {
        val nonce = call.getString("nonce") ?: return call.reject("nonce is required")
        val project = call.getString("cloudProjectNumber")
            ?: return call.reject("cloudProjectNumber is required")
        val projectNumber = project.trim().toLongOrNull()
        if (projectNumber == null || projectNumber <= 0) {
            return call.resolve(JSObject().put("error", "no_project"))
        }
        try {
            val request = IntegrityTokenRequest.builder().setNonce(nonce)
                .setCloudProjectNumber(projectNumber).build()
            IntegrityManagerFactory.create(context).requestIntegrityToken(request)
                .addOnSuccessListener { call.resolve(JSObject().put("token", it.token())) }
                .addOnFailureListener { call.resolve(JSObject().put("error", integrityError(it))) }
        } catch (e: Exception) {
            call.resolve(JSObject().put("error", integrityError(e)))
        }
    }

    @PluginMethod
    fun manageSubscriptions(call: PluginCall) {
        val uri = Uri.parse("https://play.google.com/store/account/subscriptions").buildUpon()
            .appendQueryParameter("package", context.packageName)
        call.getString("productId")?.takeIf { it.isNotEmpty() }
            ?.let { uri.appendQueryParameter("sku", it) }
        try {
            val intent = Intent(Intent.ACTION_VIEW, uri.build()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve(JSObject())
        } catch (_: Exception) {
            call.resolve(response("ERROR"))
        }
    }

    private fun withBillingConnection(run: () -> Unit, fail: (String) -> Unit) {
        val state = synchronized(connectionLock) {
            when {
                billingClient.isReady -> 1
                !connecting -> {
                    pendingOperations.add(PendingOperation(run, fail)); connecting = true; 2
                }
                else -> {
                    pendingOperations.add(PendingOperation(run, fail)); 0
                }
            }
        }
        if (state == 1) return run()
        if (state != 2) return
        try {
            billingClient.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    finishConnection(result.responseCode)
                }
                override fun onBillingServiceDisconnected() {
                    synchronized(connectionLock) { connecting = false }
                }
            })
        } catch (_: Exception) {
            finishConnection(BillingClient.BillingResponseCode.ERROR)
        }
    }

    private fun finishConnection(@BillingClient.BillingResponseCode code: Int) {
        val queued = synchronized(connectionLock) {
            connecting = false
            pendingOperations.toList().also { pendingOperations.clear() }
        }
        if (code == BillingClient.BillingResponseCode.OK) queued.forEach { it.run() }
        else queued.forEach { it.fail(responseCodeName(code)) }
    }

    private fun productQueryResult(
        code: String,
        products: List<ProductDetails> = emptyList(),
        unfetched: List<UnfetchedProduct> = emptyList()
    ) = JSObject().put("responseCode", code).put("products", productsJson(products))
        .put("unfetched", JSArray().also { out ->
            unfetched.forEach {
                out.put(JSObject().put("productId", it.getProductId())
                    .put("statusCode", it.getStatusCode()))
            }
        })

    private fun productsJson(products: List<ProductDetails>) = JSArray().also { out ->
        products.forEach { product ->
            val offers = JSArray()
            product.subscriptionOfferDetails.orEmpty().forEach { offer ->
                val phases = JSArray()
                offer.pricingPhases.pricingPhaseList.forEach { phase ->
                    phases.put(JSObject()
                        .put("formattedPrice", phase.formattedPrice)
                        .put("priceAmountMicros", phase.priceAmountMicros)
                        .put("priceCurrencyCode", phase.priceCurrencyCode)
                        .put("billingPeriod", phase.billingPeriod)
                        .put("billingCycleCount", phase.billingCycleCount)
                        .put("recurrenceMode", phase.recurrenceMode))
                }
                offers.put(JSObject()
                    .put("offerToken", offer.offerToken)
                    .put("basePlanId", offer.basePlanId)
                    .put("offerId", offer.offerId ?: JSONObject.NULL)
                    .put("phases", phases))
            }
            out.put(JSObject().put("productId", product.productId).put("title", product.title)
                .put("name", product.name).put("offers", offers))
        }
    }

    private fun purchasesResult(code: String, purchases: List<Purchase> = emptyList()) =
        JSObject().put("responseCode", code).put("purchases", purchasesJson(purchases))

    private fun purchasesJson(purchases: List<Purchase>) = JSArray().also { out ->
        purchases.forEach { purchase ->
            val ids = JSArray().also { array -> purchase.products.forEach { array.put(it) } }
            out.put(JSObject()
                .put("productIds", ids)
                .put("productId", purchase.products.firstOrNull() ?: "")
                .put("purchaseToken", purchase.purchaseToken)
                .put("purchaseState", purchaseStateName(purchase.purchaseState))
                .put("acknowledged", purchase.isAcknowledged)
                .put("autoRenewing", purchase.isAutoRenewing)
                .put("orderId", purchase.orderId ?: JSONObject.NULL)
                .put("purchaseTime", purchase.purchaseTime))
        }
    }

    private fun purchaseStateName(state: Int) = when (state) {
        Purchase.PurchaseState.PURCHASED -> "PURCHASED"
        Purchase.PurchaseState.PENDING -> "PENDING"
        else -> "UNSPECIFIED"
    }

    private fun response(code: String) = JSObject().put("responseCode", code)
    private fun responseCodeName(@BillingClient.BillingResponseCode code: Int) = when (code) {
        BillingClient.BillingResponseCode.OK -> "OK"
        BillingClient.BillingResponseCode.USER_CANCELED -> "USER_CANCELED"
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE -> "SERVICE_UNAVAILABLE"
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "BILLING_UNAVAILABLE"
        BillingClient.BillingResponseCode.ITEM_UNAVAILABLE -> "ITEM_UNAVAILABLE"
        BillingClient.BillingResponseCode.DEVELOPER_ERROR -> "DEVELOPER_ERROR"
        BillingClient.BillingResponseCode.ERROR -> "ERROR"
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "ITEM_ALREADY_OWNED"
        BillingClient.BillingResponseCode.ITEM_NOT_OWNED -> "ITEM_NOT_OWNED"
        BillingClient.BillingResponseCode.NETWORK_ERROR -> "NETWORK_ERROR"
        BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> "SERVICE_DISCONNECTED"
        BillingClient.BillingResponseCode.FEATURE_NOT_SUPPORTED -> "FEATURE_NOT_SUPPORTED"
        else -> "ERROR"
    }

    private fun integrityError(error: Exception) = if (error is IntegrityServiceException) {
        "${error.javaClass.simpleName}:${error.errorCode}"
    } else error.javaClass.simpleName

    override fun handleOnDestroy() {
        if (::billingClient.isInitialized) billingClient.endConnection()
        super.handleOnDestroy()
    }
}
