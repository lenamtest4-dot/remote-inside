package com.remoteinside.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import org.json.JSONTokener
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.Charset
import java.util.ArrayDeque
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var consoleWebView: WebView
    private lateinit var ssoWebView: WebView
    private lateinit var portalOverlay: LinearLayout
    private lateinit var portalWebView: WebView
    private lateinit var portalProgress: ProgressBar
    private lateinit var tvPortalTitle: TextView
    private lateinit var tvPortalUrl: TextView
    private lateinit var btnPortalBack: TextView
    private lateinit var btnPortalReload: TextView
    private lateinit var btnPortalDone: TextView

    private val httpExecutor: ExecutorService = Executors.newCachedThreadPool()
    private val pendingResponses = ConcurrentHashMap<String, String>()
    private val mainHandler = Handler(Looper.getMainLooper())

    private data class SsoWarmupTask(
        val reqId: String,
        val url: String,
        val targetHost: String,
        val timeoutMs: Int
    )

    private val ssoQueue = ArrayDeque<SsoWarmupTask>()
    private var activeSsoTask: SsoWarmupTask? = null
    private var activeSsoSawAuth: Boolean = false
    private var activeSsoLastUrl: String = ""
    private var ssoSettleRunnable: Runnable? = null
    private var ssoTimeoutRunnable: Runnable? = null

    private var portalLoginActive: Boolean = false
    private var portalLoginTargetHost: String = ""
    private var portalLoginSawAuthHost: Boolean = false
    private var portalAutoCloseRunnable: Runnable? = null

    private var activePortalBgTask: SsoWarmupTask? = null
    private var activePortalBgSawAuth: Boolean = false
    private var activePortalBgLastUrl: String = ""
    private var portalBgSettleRunnable: Runnable? = null
    private var portalBgTimeoutRunnable: Runnable? = null

    @Volatile
    private var webViewUserAgent: String = ""

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        consoleWebView = findViewById(R.id.consoleWebView)
        ssoWebView = findViewById(R.id.ssoWebView)
        portalOverlay = findViewById(R.id.portalOverlay)
        portalWebView = findViewById(R.id.portalWebView)
        portalProgress = findViewById(R.id.portalProgress)
        tvPortalTitle = findViewById(R.id.tvPortalTitle)
        tvPortalUrl = findViewById(R.id.tvPortalUrl)
        btnPortalBack = findViewById(R.id.btnPortalBack)
        btnPortalReload = findViewById(R.id.btnPortalReload)
        btnPortalDone = findViewById(R.id.btnPortalDone)

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(consoleWebView, true)
        cookieManager.setAcceptThirdPartyCookies(ssoWebView, true)
        cookieManager.setAcceptThirdPartyCookies(portalWebView, true)

        setupConsoleWebView()
        setupSsoWebView()
        setupPortalWebView()
        setupOverlayButtons()
        setupBackHandler()

        consoleWebView.loadUrl(APP_CONSOLE_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupConsoleWebView() {
        val settings = consoleWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        webViewUserAgent = settings.userAgentString.orEmpty()

        consoleWebView.addJavascriptInterface(NativeBridge(), "RemoteInsideNative")

        consoleWebView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                return if (APP_ASSETS_HOST.equals(uri.host, ignoreCase = true)) {
                    assetLoader.shouldInterceptRequest(uri)
                } else {
                    null
                }
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val uri = request?.url ?: return false
                if (!request.isForMainFrame) {
                    return false
                }
                if (APP_ASSETS_HOST.equals(uri.host, ignoreCase = true)) {
                    return false
                }
                val scheme = uri.scheme?.lowercase(Locale.US).orEmpty()
                if (scheme == "http" || scheme == "https") {
                    openPortalOverlay(uri.toString(), "portal", "")
                }
                return true
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                handler?.cancel()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupPortalWebView() {
        val settings = portalWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.builtInZoomControls = true
        settings.displayZoomControls = false
        settings.setSupportMultipleWindows(true)
        settings.javaScriptCanOpenWindowsAutomatically = true

        portalWebView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress in 1..99) {
                    portalProgress.visibility = View.VISIBLE
                    portalProgress.progress = newProgress
                } else {
                    portalProgress.visibility = View.GONE
                }
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                val trimmed = title?.trim().orEmpty()
                if (trimmed.isNotEmpty()) {
                    tvPortalTitle.text = trimmed
                }
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?
            ): Boolean {
                val extra = view?.hitTestResult?.extra
                if (!extra.isNullOrBlank() &&
                    (extra.startsWith("http://", ignoreCase = true) ||
                        extra.startsWith("https://", ignoreCase = true))
                ) {
                    portalWebView.loadUrl(extra)
                    return false
                }
                val transport = resultMsg?.obj as? WebView.WebViewTransport ?: return false
                val tempWebView = WebView(this@MainActivity).apply {
                    settings.javaScriptEnabled = true
                }
                var forwarded = false
                fun forwardAndDestroy(target: String?) {
                    if (forwarded) return
                    forwarded = true
                    if (!target.isNullOrBlank() &&
                        (target.startsWith("http://", ignoreCase = true) ||
                            target.startsWith("https://", ignoreCase = true))
                    ) {
                        portalWebView.loadUrl(target)
                    }
                    runCatching { tempWebView.destroy() }
                }
                tempWebView.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        subView: WebView?,
                        subReq: WebResourceRequest?
                    ): Boolean {
                        forwardAndDestroy(subReq?.url?.toString())
                        return true
                    }

                    override fun onPageStarted(
                        subView: WebView?,
                        url: String?,
                        favicon: Bitmap?
                    ) {
                        forwardAndDestroy(url)
                    }
                }
                transport.webView = tempWebView
                resultMsg.sendToTarget()
                return true
            }
        }

        portalWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val scheme = request?.url?.scheme?.lowercase(Locale.US).orEmpty()
                return scheme != "http" && scheme != "https"
            }

            override fun onPageStarted(
                view: WebView?,
                url: String?,
                favicon: Bitmap?
            ) {
                tvPortalUrl.text = url.orEmpty()
                portalAutoCloseRunnable?.let { mainHandler.removeCallbacks(it) }
                portalAutoCloseRunnable = null
                if (isAuthUrl(url)) {
                    portalLoginSawAuthHost = true
                }
                if (!url.isNullOrBlank() && url != "about:blank" && activePortalBgTask != null) {
                    portalBgSettleRunnable?.let { mainHandler.removeCallbacks(it) }
                    portalBgSettleRunnable = null
                    activePortalBgLastUrl = url
                    if (isAuthUrl(url)) {
                        activePortalBgSawAuth = true
                    }
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                tvPortalUrl.text = url.orEmpty()
                val title = view?.title?.trim().orEmpty()
                if (title.isNotEmpty()) {
                    tvPortalTitle.text = title
                }
                CookieManager.getInstance().flush()
                if (portalLoginActive &&
                    portalLoginSawAuthHost &&
                    portalOverlay.visibility == View.VISIBLE &&
                    isTargetPortalUrl(url, portalLoginTargetHost)
                ) {
                    portalAutoCloseRunnable?.let { mainHandler.removeCallbacks(it) }
                    val targetHost = portalLoginTargetHost
                    val autoClose = Runnable {
                        portalAutoCloseRunnable = null
                        if (!isDestroyed && !isFinishing && portalOverlay.visibility == View.VISIBLE) {
                            CookieManager.getInstance().flush()
                            Toast.makeText(
                                this@MainActivity,
                                "Đã đăng nhập IAM — đang đồng bộ tất cả cổng…",
                                Toast.LENGTH_SHORT
                            ).show()
                            closePortalOverlay(completedHost = targetHost, loginCompleted = true)
                        }
                    }
                    portalAutoCloseRunnable = autoClose
                    mainHandler.postDelayed(autoClose, 900L)
                }

                val bgTask = activePortalBgTask
                if (bgTask != null && !url.isNullOrBlank() && url != "about:blank") {
                    activePortalBgLastUrl = url
                    portalBgSettleRunnable?.let { mainHandler.removeCallbacks(it) }
                    portalBgSettleRunnable = null
                    val bgReqId = bgTask.reqId
                    if (isAuthUrl(url)) {
                        activePortalBgSawAuth = true
                        val runnable = Runnable {
                            val current = activePortalBgTask ?: return@Runnable
                            if (current.reqId != bgReqId) return@Runnable
                            finishPortalBgTask(
                                ok = false,
                                status = "needs_login",
                                finalUrl = activePortalBgLastUrl.ifBlank { current.url }
                            )
                        }
                        portalBgSettleRunnable = runnable
                        mainHandler.postDelayed(runnable, 2200L)
                    } else if (isTargetPortalUrl(url, bgTask.targetHost)) {
                        val runnable = Runnable {
                            val current = activePortalBgTask ?: return@Runnable
                            if (current.reqId != bgReqId) return@Runnable
                            val checkJs = """
                                (function() {
                                  var pwd = !!document.querySelector('input[type="password"]');
                                  var title = String(document.title || '');
                                  var hasFrameset = !!document.querySelector('frameset');
                                  return JSON.stringify({
                                    href: String(location.href || ''),
                                    hasPwd: pwd,
                                    title: title,
                                    hasFrameset: hasFrameset
                                  });
                                })();
                            """.trimIndent()
                            portalWebView.evaluateJavascript(checkJs) { jsResult ->
                                val stillCurrent = activePortalBgTask ?: return@evaluateJavascript
                                if (stillCurrent.reqId != bgReqId) return@evaluateJavascript
                                val rawStr = runCatching {
                                    JSONTokener(jsResult ?: "null").nextValue() as? String
                                }.getOrNull()
                                val meta = runCatching {
                                    if (!rawStr.isNullOrBlank()) JSONObject(rawStr) else null
                                }.getOrNull()
                                val domHref = meta?.optString("href", "").orEmpty()
                                val effectiveUrl = domHref.ifBlank { activePortalBgLastUrl.ifBlank { url } }
                                val hasPwd = meta?.optBoolean("hasPwd", false) ?: false
                                val pageTitle = meta?.optString("title", "").orEmpty()
                                val hasFrameset = meta?.optBoolean("hasFrameset", false) ?: false
                                val hasLoginTitle =
                                    !hasFrameset && SSO_LOGIN_TITLE_RE.containsMatchIn(pageTitle)

                                if (!hasPwd &&
                                    !hasLoginTitle &&
                                    isTargetPortalUrl(effectiveUrl, stillCurrent.targetHost)
                                ) {
                                    finishPortalBgTask(
                                        ok = true,
                                        status = "ok",
                                        finalUrl = effectiveUrl
                                    )
                                } else {
                                    finishPortalBgTask(
                                        ok = false,
                                        status = "needs_login",
                                        finalUrl = effectiveUrl
                                    )
                                }
                            }
                        }
                        portalBgSettleRunnable = runnable
                        mainHandler.postDelayed(runnable, 700L)
                    }
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                handler?.cancel()
                if (activePortalBgTask != null) {
                    finishPortalBgTask(
                        ok = false,
                        status = "ssl_error",
                        finalUrl = activePortalBgLastUrl
                    )
                }
                if (portalOverlay.visibility == View.VISIBLE) {
                    Toast.makeText(
                        this@MainActivity,
                        "Cảnh báo: Chứng chỉ SSL trang không hợp lệ.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true && activePortalBgTask != null) {
                    finishPortalBgTask(
                        ok = false,
                        status = "network_error",
                        finalUrl = activePortalBgLastUrl
                    )
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupSsoWebView() {
        val settings = ssoWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.blockNetworkImage = true
        settings.mediaPlaybackRequiresUserGesture = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false

        ssoWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val scheme = request?.url?.scheme?.lowercase(Locale.US).orEmpty()
                return scheme != "http" && scheme != "https"
            }

            override fun onPageStarted(
                view: WebView?,
                url: String?,
                favicon: Bitmap?
            ) {
                if (url.isNullOrBlank() || url == "about:blank") return
                if (activeSsoTask == null) return
                ssoSettleRunnable?.let { mainHandler.removeCallbacks(it) }
                ssoSettleRunnable = null
                activeSsoLastUrl = url
                if (isAuthUrl(url)) {
                    activeSsoSawAuth = true
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                if (url.isNullOrBlank() || url == "about:blank") return
                val task = activeSsoTask ?: return
                activeSsoLastUrl = url
                CookieManager.getInstance().flush()
                ssoSettleRunnable?.let { mainHandler.removeCallbacks(it) }
                ssoSettleRunnable = null

                val taskReqId = task.reqId
                if (isAuthUrl(url)) {
                    activeSsoSawAuth = true
                    val runnable = Runnable {
                        val current = activeSsoTask ?: return@Runnable
                        if (current.reqId != taskReqId) return@Runnable
                        finishActiveSsoTask(
                            ok = false,
                            status = "needs_login",
                            finalUrl = activeSsoLastUrl.ifBlank { current.url }
                        )
                    }
                    ssoSettleRunnable = runnable
                    mainHandler.postDelayed(runnable, 2200L)
                    return
                }

                if (isTargetPortalUrl(url, task.targetHost)) {
                    val delayMs = if (activeSsoSawAuth) 1200L else 1800L
                    val runnable = Runnable {
                        val current = activeSsoTask ?: return@Runnable
                        if (current.reqId != taskReqId) return@Runnable
                        val checkJs = """
                            (function() {
                              var pwd = !!document.querySelector('input[type="password"]');
                              var title = String(document.title || '');
                              var hasFrameset = !!document.querySelector('frameset');
                              return JSON.stringify({
                                href: String(location.href || ''),
                                hasPwd: pwd,
                                title: title,
                                hasFrameset: hasFrameset
                              });
                            })();
                        """.trimIndent()
                        ssoWebView.evaluateJavascript(checkJs) { jsResult ->
                            val stillCurrent = activeSsoTask ?: return@evaluateJavascript
                            if (stillCurrent.reqId != taskReqId) return@evaluateJavascript
                            val rawStr = runCatching {
                                JSONTokener(jsResult ?: "null").nextValue() as? String
                            }.getOrNull()
                            val meta = runCatching {
                                if (!rawStr.isNullOrBlank()) JSONObject(rawStr) else null
                            }.getOrNull()
                            val domHref = meta?.optString("href", "").orEmpty()
                            val effectiveUrl = domHref.ifBlank { activeSsoLastUrl.ifBlank { url } }
                            val hasPwd = meta?.optBoolean("hasPwd", false) ?: false
                            val title = meta?.optString("title", "").orEmpty()
                            val hasFrameset = meta?.optBoolean("hasFrameset", false) ?: false
                            val hasLoginTitle =
                                !hasFrameset && SSO_LOGIN_TITLE_RE.containsMatchIn(title)
                            val requiresRadiusToken =
                                stillCurrent.targetHost.equals("radius-portal.fpt.net", ignoreCase = true)
                            if (requiresRadiusToken) {
                                runCatching { CookieManager.getInstance().flush() }
                            }
                            val hasRadiusToken = !requiresRadiusToken ||
                                extractRadiusAccessToken(CookieManager.getInstance()).isNotBlank()

                            if (!hasPwd &&
                                !hasLoginTitle &&
                                hasRadiusToken &&
                                isTargetPortalUrl(effectiveUrl, stillCurrent.targetHost)
                            ) {
                                finishActiveSsoTask(
                                    ok = true,
                                    status = "ok",
                                    finalUrl = effectiveUrl
                                )
                            } else {
                                finishActiveSsoTask(
                                    ok = false,
                                    status = "needs_login",
                                    finalUrl = effectiveUrl
                                )
                            }
                        }
                    }
                    ssoSettleRunnable = runnable
                    mainHandler.postDelayed(runnable, delayMs)
                }
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                handler?.cancel()
                if (activeSsoTask != null) {
                    finishActiveSsoTask(
                        ok = false,
                        status = "ssl_error",
                        finalUrl = activeSsoLastUrl
                    )
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                if (request?.isForMainFrame == true && activeSsoTask != null) {
                    finishActiveSsoTask(
                        ok = false,
                        status = "network_error",
                        finalUrl = activeSsoLastUrl
                    )
                }
            }
        }
    }

    private fun startNextSsoTask() {
        if (activeSsoTask != null || isDestroyed || isFinishing) {
            return
        }
        val next = ssoQueue.poll() ?: return
        activeSsoTask = next
        activeSsoSawAuth = false
        activeSsoLastUrl = next.url
        ssoSettleRunnable?.let { mainHandler.removeCallbacks(it) }
        ssoSettleRunnable = null
        ssoTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }

        val timeoutTask = Runnable {
            val current = activeSsoTask ?: return@Runnable
            if (current.reqId != next.reqId) return@Runnable
            val fallbackStatus = if (activeSsoSawAuth || isAuthUrl(activeSsoLastUrl)) {
                "needs_login"
            } else {
                "timeout"
            }
            finishActiveSsoTask(
                ok = false,
                status = fallbackStatus,
                finalUrl = activeSsoLastUrl.ifBlank { current.url }
            )
        }
        ssoTimeoutRunnable = timeoutTask
        mainHandler.postDelayed(timeoutTask, next.timeoutMs.toLong())
        ssoWebView.loadUrl(next.url)
    }

    private fun finishActiveSsoTask(ok: Boolean, status: String, finalUrl: String) {
        val task = activeSsoTask ?: return
        activeSsoTask = null
        ssoSettleRunnable?.let { mainHandler.removeCallbacks(it) }
        ssoSettleRunnable = null
        ssoTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        ssoTimeoutRunnable = null
        runCatching { CookieManager.getInstance().flush() }
        runCatching { ssoWebView.stopLoading() }
        if (ssoQueue.isEmpty() && !isDestroyed && !isFinishing) {
            runCatching { ssoWebView.loadUrl("about:blank") }
        }
        deliverBridgeResponse(
            task.reqId,
            JSONObject().apply {
                put("ok", ok)
                put("status", status)
                put("finalUrl", finalUrl.ifBlank { task.url })
                put("sawAuth", activeSsoSawAuth)
            }
        )
        startNextSsoTask()
    }

    private fun finishPortalBgTask(
        ok: Boolean,
        status: String,
        finalUrl: String,
        reused: Boolean = false
    ) {
        val task = activePortalBgTask ?: return
        activePortalBgTask = null
        portalBgSettleRunnable?.let { mainHandler.removeCallbacks(it) }
        portalBgSettleRunnable = null
        portalBgTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }
        portalBgTimeoutRunnable = null
        runCatching { CookieManager.getInstance().flush() }
        deliverBridgeResponse(
            task.reqId,
            JSONObject().apply {
                put("ok", ok)
                put("status", status)
                put("finalUrl", finalUrl.ifBlank { task.url })
                put("sawAuth", activePortalBgSawAuth)
                put("reused", reused)
            }
        )
    }

    private fun setupOverlayButtons() {
        btnPortalBack.setOnClickListener {
            val curUrl = portalWebView.url.orEmpty()
            val curHost = runCatching { Uri.parse(curUrl).host }.getOrNull().orEmpty()
            val loggedIn =
                portalLoginActive &&
                    portalLoginSawAuthHost &&
                    isAllowedPortalHost(curHost) &&
                    !isAuthUrl(curUrl)
            closePortalOverlay(completedHost = curHost, loginCompleted = loggedIn)
        }
        btnPortalDone.setOnClickListener {
            val curUrl = portalWebView.url.orEmpty()
            val curHost = runCatching { Uri.parse(curUrl).host }.getOrNull().orEmpty()
            val loggedIn =
                (portalLoginActive || portalLoginSawAuthHost) &&
                    isAllowedPortalHost(curHost) &&
                    !isAuthUrl(curUrl)
            closePortalOverlay(completedHost = curHost, loginCompleted = loggedIn)
        }
        btnPortalReload.setOnClickListener {
            portalWebView.reload()
        }
    }

    private fun setupBackHandler() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (portalOverlay.visibility == View.VISIBLE) {
                        if (portalWebView.canGoBack()) {
                            portalWebView.goBack()
                        } else {
                            val curUrl = portalWebView.url.orEmpty()
                            val curHost = runCatching { Uri.parse(curUrl).host }.getOrNull().orEmpty()
                            val loggedIn =
                                portalLoginActive &&
                                    portalLoginSawAuthHost &&
                                    isAllowedPortalHost(curHost) &&
                                    !isAuthUrl(curUrl)
                            closePortalOverlay(completedHost = curHost, loginCompleted = loggedIn)
                        }
                        return
                    }
                    consoleWebView.evaluateJavascript(
                        "Boolean(window.__riHandleBack && window.__riHandleBack())"
                    ) { value ->
                        if (value != "true") {
                            finish()
                        }
                    }
                }
            }
        )
    }

    private fun openPortalOverlay(url: String, mode: String, title: String) {
        val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return
        val scheme = parsed.scheme?.lowercase(Locale.US).orEmpty()
        if (scheme != "http" && scheme != "https") {
            return
        }
        val fallbackTitle = if (mode == "login") {
            "Đăng nhập cổng nội bộ FPT"
        } else {
            "Trang nội bộ FPT"
        }
        runOnUiThread {
            if (isDestroyed || isFinishing) {
                return@runOnUiThread
            }
            if (activePortalBgTask != null) {
                finishPortalBgTask(ok = false, status = "superseded", finalUrl = url)
            }
            portalAutoCloseRunnable?.let { mainHandler.removeCallbacks(it) }
            portalAutoCloseRunnable = null
            portalLoginActive = (mode == "login")
            portalLoginTargetHost = parsed.host.orEmpty()
            portalLoginSawAuthHost = false
            tvPortalTitle.text = if (title.isNotBlank()) title else fallbackTitle
            tvPortalUrl.text = url
            portalProgress.visibility = View.VISIBLE
            portalProgress.progress = 15
            portalOverlay.visibility = View.VISIBLE
            portalWebView.loadUrl(url)
        }
    }

    private fun showPortalOverlayInternal(title: String) {
        runOnUiThread {
            if (isDestroyed || isFinishing) {
                return@runOnUiThread
            }
            portalAutoCloseRunnable?.let { mainHandler.removeCallbacks(it) }
            portalAutoCloseRunnable = null
            portalLoginActive = false
            portalLoginSawAuthHost = false
            val currentTitle = portalWebView.title?.trim().orEmpty()
            tvPortalTitle.text = when {
                title.isNotBlank() -> title
                currentTitle.isNotEmpty() -> currentTitle
                else -> "Trang nội bộ FPT"
            }
            tvPortalUrl.text = portalWebView.url.orEmpty()
            portalProgress.visibility = View.GONE
            portalOverlay.visibility = View.VISIBLE
        }
    }

    private fun closePortalOverlay(completedHost: String = "", loginCompleted: Boolean = false) {
        portalAutoCloseRunnable?.let { mainHandler.removeCallbacks(it) }
        portalAutoCloseRunnable = null
        portalLoginActive = false
        portalLoginTargetHost = ""
        portalLoginSawAuthHost = false
        if (portalOverlay.visibility != View.VISIBLE) {
            return
        }
        portalOverlay.visibility = View.INVISIBLE
        CookieManager.getInstance().flush()
        consoleWebView.evaluateJavascript(
            "window.__riOnPortalBrowserClosed && window.__riOnPortalBrowserClosed(${JSONObject.quote(completedHost)}, ${if (loginCompleted) "true" else "false"});",
            null
        )
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        ssoQueue.clear()
        activeSsoTask = null
        activePortalBgTask = null
        httpExecutor.shutdownNow()
        pendingResponses.clear()
        runCatching {
            consoleWebView.removeJavascriptInterface("RemoteInsideNative")
            (consoleWebView.parent as? ViewGroup)?.removeView(consoleWebView)
            consoleWebView.destroy()
        }
        runCatching {
            (ssoWebView.parent as? ViewGroup)?.removeView(ssoWebView)
            ssoWebView.destroy()
        }
        runCatching {
            (portalWebView.parent as? ViewGroup)?.removeView(portalWebView)
            portalWebView.destroy()
        }
        super.onDestroy()
    }

    private fun isAllowedPortalHost(rawHost: String?): Boolean {
        val host = rawHost?.trim()?.lowercase(Locale.US).orEmpty()
        if (host.isEmpty()) return false
        return host == "fpt.net" ||
            host.endsWith(".fpt.net") ||
            host == "fcam.vn" ||
            host.endsWith(".fcam.vn")
    }

    private fun isAuthHost(rawHost: String?): Boolean {
        val host = rawHost?.trim()?.lowercase(Locale.US).orEmpty()
        if (host.isEmpty()) return false
        if (host == "iam.fpt.net" ||
            host.endsWith(".iam.fpt.net") ||
            host == "login.microsoftonline.com" ||
            host == "login.microsoft.com" ||
            host == "login.live.com" ||
            host.endsWith(".microsoftonline.com")
        ) {
            return true
        }
        return AUTH_HOST_PREFIX_RE.containsMatchIn(host)
    }

    private fun isLoginPath(rawPath: String?): Boolean {
        val path = rawPath.orEmpty()
        return LOGIN_PATH_RE.containsMatchIn(path)
    }

    private fun isAuthUrl(rawUrl: String?): Boolean {
        if (rawUrl.isNullOrBlank()) return false
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return false
        return isAuthHost(uri.host) || isLoginPath(uri.path)
    }

    private fun isTargetPortalUrl(rawUrl: String?, targetHost: String): Boolean {
        if (rawUrl.isNullOrBlank() || targetHost.isBlank()) return false
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return false
        val host = uri.host?.trim()?.lowercase(Locale.US).orEmpty()
        val expected = targetHost.trim().lowercase(Locale.US)
        val hostMatches = host == expected || host.endsWith(".$expected")
        return hostMatches && !isAuthHost(host) && !isLoginPath(uri.path)
    }

    private fun extractRadiusAccessToken(cookieManager: CookieManager): String {
        val rawCookies = listOf(
            "http://radius-portal.fpt.net/",
            "https://radius-portal.fpt.net/"
        ).mapNotNull { cookieManager.getCookie(it) }
            .joinToString("; ")
        if (rawCookies.isBlank()) return ""
        for (part in rawCookies.split(";")) {
            val idx = part.indexOf('=')
            if (idx <= 0) continue
            val name = part.substring(0, idx).trim()
            if (name == "accesstoken_iam_radius") {
                val rawVal = part.substring(idx + 1).trim().trim('"')
                if (rawVal.isNotEmpty()) {
                    return runCatching { Uri.decode(rawVal) }.getOrDefault(rawVal).trim()
                }
            }
        }
        return ""
    }

    private fun deliverBridgeResponse(reqId: String, resultJson: JSONObject) {
        pendingResponses[reqId] = resultJson.toString()
        runOnUiThread {
            if (!isDestroyed && !isFinishing) {
                consoleWebView.evaluateJavascript(
                    "window.__riNativeResolve && window.__riNativeResolve(${JSONObject.quote(reqId)});",
                    null
                )
            }
        }
    }

    private fun parseCharset(contentType: String?): Charset {
        if (!contentType.isNullOrBlank()) {
            val match = Regex("""charset\s*=\s*["']?([A-Za-z0-9._-]+)""", RegexOption.IGNORE_CASE)
                .find(contentType)
            if (match != null) {
                val charsetName = match.groupValues[1]
                runCatching { return Charset.forName(charsetName) }
            }
        }
        return Charsets.UTF_8
    }

    private fun readStreamText(stream: InputStream?, contentType: String?): String {
        if (stream == null) return ""
        val charset = parseCharset(contentType)
        val buffer = ByteArray(8192)
        val out = ByteArrayOutputStream()
        var total = 0
        stream.use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                val allowed = minOf(read, MAX_RESPONSE_BYTES - total)
                if (allowed > 0) {
                    out.write(buffer, 0, allowed)
                    total += allowed
                }
                if (total >= MAX_RESPONSE_BYTES) break
            }
        }
        return out.toString(charset.name())
    }

    private fun executeHttpRequest(reqId: String, payload: JSONObject) {
        val initialUrl = payload.optString("url", "")
        var currentUrl = initialUrl
        var currentMethod = payload.optString("method", "GET")
            .trim()
            .uppercase(Locale.US)
            .ifEmpty { "GET" }
        val rawData = if (payload.isNull("data")) null else payload.optString("data", "")
        var currentBody: String? = rawData
        val timeoutMs = payload.optInt("timeout", 15000).coerceIn(1000, 60000)
        val headerObj = payload.optJSONObject("headers")
        val useRadiusBearer = payload.optBoolean("useRadiusBearer", false)

        val initialUri = runCatching { Uri.parse(initialUrl) }.getOrNull()
        val initialScheme = initialUri?.scheme?.lowercase(Locale.US).orEmpty()
        if (initialUri == null ||
            (initialScheme != "http" && initialScheme != "https") ||
            !isAllowedPortalHost(initialUri.host)
        ) {
            deliverBridgeResponse(
                reqId,
                JSONObject().apply {
                    put("ok", false)
                    put("status", 0)
                    put("finalUrl", initialUrl)
                    put("responseText", "")
                    put("responseHeaders", "")
                    put("error", "INVALID_OR_DISALLOWED_URL")
                }
            )
            return
        }

        val cookieManager = CookieManager.getInstance()
        var cookiesUpdated = false

        try {
            var hop = 0
            while (hop <= MAX_REDIRECTS) {
                val hopUri = Uri.parse(currentUrl)
                val hopScheme = hopUri.scheme?.lowercase(Locale.US).orEmpty()
                if (hopScheme != "http" && hopScheme != "https") {
                    throw IllegalStateException("UNSUPPORTED_REDIRECT_SCHEME")
                }

                val conn = (URL(currentUrl).openConnection() as HttpURLConnection).apply {
                    instanceFollowRedirects = false
                    connectTimeout = timeoutMs
                    readTimeout = timeoutMs
                    requestMethod = currentMethod
                    doInput = true
                }

                try {
                    var hasUserAgent = false
                    if (headerObj != null) {
                        val keys = headerObj.keys()
                        while (keys.hasNext()) {
                            val key = keys.next()
                            val value = headerObj.optString(key, "")
                            if (key.equals("cookie", ignoreCase = true) ||
                                key.equals("content-length", ignoreCase = true) ||
                                key.equals("host", ignoreCase = true)
                            ) {
                                continue
                            }
                            if (key.equals("user-agent", ignoreCase = true)) {
                                hasUserAgent = true
                            }
                            conn.setRequestProperty(key, value)
                        }
                    }

                    if (!hasUserAgent && webViewUserAgent.isNotEmpty()) {
                        conn.setRequestProperty("User-Agent", webViewUserAgent)
                    }

                    val cookies = cookieManager.getCookie(currentUrl)
                    if (!cookies.isNullOrEmpty()) {
                        conn.setRequestProperty("Cookie", cookies)
                    }

                    if (useRadiusBearer && hopUri.host.equals("radius-apigateway.fpt.net", ignoreCase = true)) {
                        val radiusToken = extractRadiusAccessToken(cookieManager)
                        if (radiusToken.isBlank()) {
                            deliverBridgeResponse(
                                reqId,
                                JSONObject().apply {
                                    put("ok", false)
                                    put("status", 401)
                                    put("finalUrl", currentUrl)
                                    put("responseText", "")
                                    put("responseHeaders", "")
                                    put("error", "RADIUS_TOKEN_MISSING")
                                }
                            )
                            return
                        }
                        conn.setRequestProperty("Authorization", "Bearer $radiusToken")
                    }

                    val sendsBody = currentMethod == "POST" ||
                        currentMethod == "PUT" ||
                        currentMethod == "PATCH"
                    val bodyToSend = currentBody
                    if (sendsBody && bodyToSend != null) {
                        val bodyBytes = bodyToSend.toByteArray(Charsets.UTF_8)
                        conn.doOutput = true
                        conn.setFixedLengthStreamingMode(bodyBytes.size)
                        conn.outputStream.use { os ->
                            os.write(bodyBytes)
                        }
                    } else if (sendsBody) {
                        conn.doOutput = true
                        conn.setFixedLengthStreamingMode(0)
                    }

                    val statusCode = conn.responseCode
                    val headerMap = conn.headerFields
                    for ((key, values) in headerMap) {
                        if (key != null &&
                            (key.equals("set-cookie", ignoreCase = true) ||
                                key.equals("set-cookie2", ignoreCase = true)) &&
                            values != null
                        ) {
                            for (cookieVal in values) {
                                if (!cookieVal.isNullOrBlank()) {
                                    cookieManager.setCookie(currentUrl, cookieVal)
                                    cookiesUpdated = true
                                }
                            }
                        }
                    }

                    if (statusCode in REDIRECT_STATUS_CODES) {
                        val location = conn.getHeaderField("Location")
                        if (!location.isNullOrBlank() && hop < MAX_REDIRECTS) {
                            currentUrl = URL(URL(currentUrl), location).toString()
                            if ((statusCode == 301 || statusCode == 302 || statusCode == 303) &&
                                currentMethod != "GET" &&
                                currentMethod != "HEAD"
                            ) {
                                currentMethod = "GET"
                                currentBody = null
                            }
                            hop++
                            continue
                        }
                    }

                    if (cookiesUpdated) {
                        cookieManager.flush()
                    }

                    val rawHeaders = StringBuilder()
                    for ((key, values) in headerMap) {
                        if (key == null || values == null) continue
                        for (v in values) {
                            rawHeaders.append(key).append(": ").append(v).append("\r\n")
                        }
                    }

                    val stream = if (statusCode >= 400) {
                        conn.errorStream ?: runCatching { conn.inputStream }.getOrNull()
                    } else {
                        runCatching { conn.inputStream }.getOrNull()
                    }
                    val bodyText = readStreamText(stream, conn.contentType)

                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", statusCode in 200..399)
                            put("status", statusCode)
                            put("finalUrl", conn.url?.toString() ?: currentUrl)
                            put("responseText", bodyText)
                            put("responseHeaders", rawHeaders.toString())
                        }
                    )
                    return
                } finally {
                    conn.disconnect()
                }
            }

            deliverBridgeResponse(
                reqId,
                JSONObject().apply {
                    put("ok", false)
                    put("status", 0)
                    put("finalUrl", currentUrl)
                    put("responseText", "")
                    put("responseHeaders", "")
                    put("error", "TOO_MANY_REDIRECTS")
                }
            )
        } catch (err: Exception) {
            if (cookiesUpdated) {
                runCatching { cookieManager.flush() }
            }
            val errType = if (err is java.net.SocketTimeoutException) "TIMEOUT" else "NETWORK_ERROR"
            deliverBridgeResponse(
                reqId,
                JSONObject().apply {
                    put("ok", false)
                    put("status", 0)
                    put("finalUrl", currentUrl)
                    put("responseText", "")
                    put("responseHeaders", "")
                    put("error", errType)
                }
            )
        }
    }

    inner class NativeBridge {

        @JavascriptInterface
        fun httpRequest(payloadJson: String) {
            val payload = runCatching { JSONObject(payloadJson) }.getOrNull() ?: return
            val reqId = payload.optString("reqId", "")
            if (reqId.isBlank()) return
            httpExecutor.execute {
                executeHttpRequest(reqId, payload)
            }
        }

        @JavascriptInterface
        fun consumeResponse(reqId: String): String {
            return pendingResponses.remove(reqId) ?: ""
        }

        @JavascriptInterface
        fun openPortal(url: String, mode: String, title: String) {
            openPortalOverlay(url, mode, title)
        }

        @JavascriptInterface
        fun showPortalOverlay(title: String) {
            showPortalOverlayInternal(title)
        }

        @JavascriptInterface
        fun loadPortalBackground(payloadJson: String) {
            val payload = runCatching { JSONObject(payloadJson) }.getOrNull() ?: return
            val reqId = payload.optString("reqId", "")
            val url = payload.optString("url", "")
            val reusePrefix = payload.optString("reusePrefix", "").trim()
            val timeoutMs = payload.optInt("timeout", 18000).coerceIn(3000, 30000)
            if (reqId.isBlank()) return

            val uri = runCatching { Uri.parse(url) }.getOrNull()
            val scheme = uri?.scheme?.lowercase(Locale.US).orEmpty()
            val host = uri?.host?.trim()?.lowercase(Locale.US).orEmpty()
            if (uri == null ||
                (scheme != "http" && scheme != "https") ||
                !isAllowedPortalHost(host) ||
                isAuthHost(host)
            ) {
                deliverBridgeResponse(
                    reqId,
                    JSONObject().apply {
                        put("ok", false)
                        put("status", "invalid_url")
                        put("finalUrl", url)
                    }
                )
                return
            }

            runOnUiThread {
                if (isDestroyed || isFinishing) {
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", false)
                            put("status", "destroyed")
                            put("finalUrl", url)
                        }
                    )
                    return@runOnUiThread
                }

                val curUrl = portalWebView.url.orEmpty()
                if (reusePrefix.isNotEmpty() &&
                    activePortalBgTask == null &&
                    curUrl.startsWith(reusePrefix, ignoreCase = true) &&
                    !isAuthUrl(curUrl)
                ) {
                    runCatching { CookieManager.getInstance().flush() }
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", true)
                            put("status", "ok")
                            put("finalUrl", curUrl)
                            put("sawAuth", false)
                            put("reused", true)
                        }
                    )
                    return@runOnUiThread
                }

                if (activePortalBgTask != null) {
                    finishPortalBgTask(ok = false, status = "superseded", finalUrl = curUrl)
                }

                if (portalOverlay.visibility != View.VISIBLE) {
                    portalOverlay.visibility = View.INVISIBLE
                }

                val task = SsoWarmupTask(reqId, url, host, timeoutMs)
                activePortalBgTask = task
                activePortalBgSawAuth = false
                activePortalBgLastUrl = url
                portalBgSettleRunnable?.let { mainHandler.removeCallbacks(it) }
                portalBgSettleRunnable = null
                portalBgTimeoutRunnable?.let { mainHandler.removeCallbacks(it) }

                val timeoutTask = Runnable {
                    val current = activePortalBgTask ?: return@Runnable
                    if (current.reqId != reqId) return@Runnable
                    val fallbackStatus = if (activePortalBgSawAuth || isAuthUrl(activePortalBgLastUrl)) {
                        "needs_login"
                    } else {
                        "timeout"
                    }
                    finishPortalBgTask(
                        ok = false,
                        status = fallbackStatus,
                        finalUrl = activePortalBgLastUrl.ifBlank { current.url }
                    )
                }
                portalBgTimeoutRunnable = timeoutTask
                mainHandler.postDelayed(timeoutTask, timeoutMs.toLong())
                portalWebView.loadUrl(url)
            }
        }

        @JavascriptInterface
        fun evalPortalJs(payloadJson: String) {
            val payload = runCatching { JSONObject(payloadJson) }.getOrNull() ?: return
            val reqId = payload.optString("reqId", "")
            val script = payload.optString("script", "")
            if (reqId.isBlank()) return

            runOnUiThread {
                if (isDestroyed || isFinishing) {
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", false)
                            put("status", "destroyed")
                            put("finalUrl", "")
                        }
                    )
                    return@runOnUiThread
                }

                val curUrl = portalWebView.url.orEmpty()
                val curHost = runCatching { Uri.parse(curUrl).host }.getOrNull().orEmpty()
                if (curUrl.isBlank() || curUrl == "about:blank" || !isAllowedPortalHost(curHost)) {
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", false)
                            put("status", "no_portal")
                            put("finalUrl", curUrl)
                        }
                    )
                    return@runOnUiThread
                }

                if (isAuthUrl(curUrl)) {
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", false)
                            put("status", "needs_login")
                            put("finalUrl", curUrl)
                        }
                    )
                    return@runOnUiThread
                }

                val wrappedScript =
                    "(function(){try{var __fn=function(){\n" +
                        script +
                        "\n};var __val=__fn();return JSON.stringify({ok:true,status:\"ok\",finalUrl:String(location.href||\"\"),value:__val===undefined?null:__val});}catch(__err){return JSON.stringify({ok:false,status:\"js_error\",finalUrl:String(location.href||\"\"),error:String(__err&&__err.message?__err.message:__err)});}})();"

                portalWebView.evaluateJavascript(wrappedScript) { jsResult ->
                    val rawStr = runCatching {
                        JSONTokener(jsResult ?: "null").nextValue() as? String
                    }.getOrNull()
                    val parsedObj = runCatching {
                        if (!rawStr.isNullOrBlank()) JSONObject(rawStr) else null
                    }.getOrNull()
                    val out = parsedObj ?: JSONObject().apply {
                        put("ok", false)
                        put("status", "eval_null")
                        put("finalUrl", portalWebView.url.orEmpty())
                    }
                    deliverBridgeResponse(reqId, out)
                }
            }
        }

        @JavascriptInterface
        fun warmPortalSession(payloadJson: String) {
            val payload = runCatching { JSONObject(payloadJson) }.getOrNull() ?: return
            val reqId = payload.optString("reqId", "")
            val url = payload.optString("url", "")
            val timeoutMs = payload.optInt("timeout", 12000).coerceIn(3000, 20000)
            if (reqId.isBlank()) return

            val uri = runCatching { Uri.parse(url) }.getOrNull()
            val scheme = uri?.scheme?.lowercase(Locale.US).orEmpty()
            val host = uri?.host?.trim()?.lowercase(Locale.US).orEmpty()
            if (uri == null ||
                (scheme != "http" && scheme != "https") ||
                !isAllowedPortalHost(host) ||
                isAuthHost(host)
            ) {
                deliverBridgeResponse(
                    reqId,
                    JSONObject().apply {
                        put("ok", false)
                        put("status", "invalid_url")
                        put("finalUrl", url)
                    }
                )
                return
            }

            runOnUiThread {
                if (isDestroyed || isFinishing) {
                    deliverBridgeResponse(
                        reqId,
                        JSONObject().apply {
                            put("ok", false)
                            put("status", "destroyed")
                            put("finalUrl", url)
                        }
                    )
                    return@runOnUiThread
                }
                ssoQueue.add(SsoWarmupTask(reqId, url, host, timeoutMs))
                startNextSsoTask()
            }
        }

        @JavascriptInterface
        fun openExternalBrowser(url: String) {
            val parsed = runCatching { Uri.parse(url) }.getOrNull() ?: return
            if (!"https".equals(parsed.scheme, ignoreCase = true)) {
                return
            }
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, parsed))
                } catch (_: ActivityNotFoundException) {
                    Toast.makeText(
                        this@MainActivity,
                        "Không tìm thấy trình duyệt trên máy.",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }

        @JavascriptInterface
        fun copyText(text: String): Boolean {
            return try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("Remote Inside", text))
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun readClipboard(): String {
            return try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = cm.primaryClip ?: return ""
                if (clip.itemCount <= 0) return ""
                clip.getItemAt(0).coerceToText(this@MainActivity)?.toString().orEmpty()
            } catch (_: Exception) {
                ""
            }
        }

        @JavascriptInterface
        fun clearSessionCookies(): Boolean {
            return try {
                val cookieManager = CookieManager.getInstance()
                cookieManager.removeAllCookies(null)
                cookieManager.flush()
                runOnUiThread {
                    if (!isDestroyed && !isFinishing) {
                        portalWebView.clearCache(true)
                        portalWebView.clearHistory()
                        ssoWebView.clearCache(true)
                        ssoWebView.clearHistory()
                    }
                }
                true
            } catch (_: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun getAppVersion(): String {
            return try {
                val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    packageManager.getPackageInfo(
                        packageName,
                        PackageManager.PackageInfoFlags.of(0)
                    )
                } else {
                    @Suppress("DEPRECATION")
                    packageManager.getPackageInfo(packageName, 0)
                }
                info.versionName ?: "0.10.0"
            } catch (_: Exception) {
                "0.10.0"
            }
        }
    }

    companion object {
        private const val APP_ASSETS_HOST = "appassets.androidplatform.net"
        private const val APP_CONSOLE_URL =
            "https://appassets.androidplatform.net/assets/remote-inside.html"
        private const val MAX_REDIRECTS = 10
        private const val MAX_RESPONSE_BYTES = 8 * 1024 * 1024
        private val REDIRECT_STATUS_CODES = setOf(301, 302, 303, 307, 308)
        private val AUTH_HOST_PREFIX_RE =
            Regex("^(iam|sso|login|auth|signin|oauth|cas|sts)[.-]", RegexOption.IGNORE_CASE)
        private val LOGIN_PATH_RE =
            Regex("/(loginpage\\.aspx|account/login|auth/login|login(?:/|$))", RegexOption.IGNORE_CASE)
        private val SSO_LOGIN_TITLE_RE =
            Regex("\\b(iam|sign\\s*in|đăng\\s*nhập|login)\\b", RegexOption.IGNORE_CASE)
    }
}
