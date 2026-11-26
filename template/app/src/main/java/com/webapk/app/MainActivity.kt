@file:Suppress("DEPRECATION")

package com.webapk.app

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import kotlin.math.abs
import kotlin.math.max

class MainActivity : Activity() {

    private lateinit var cfg: AppConfig
    private lateinit var root: FrameLayout
    private lateinit var swipe: SwipeRefreshLayout
    private lateinit var web: WebView
    private lateinit var progress: ProgressBar
    private lateinit var errorView: LinearLayout
    private var menuButton: ImageButton? = null

    private var themeColor = Color.parseColor("#2563EB")
    private var desktopMode = false
    private var defaultUserAgent = ""
    private val siteRoots: MutableSet<String> = java.util.concurrent.ConcurrentHashMap.newKeySet()
    private var initialLoad = true
    private var jsCanScrollUp = false

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var lastBackPress = 0L
    private var lastToast = 0L
    private var failedUrl: String? = null
    private val handler = Handler(Looper.getMainLooper())

    private val prefs by lazy { getSharedPreferences("webapk", Context.MODE_PRIVATE) }

    companion object {
        private const val FILE_REQUEST = 4401
        private const val DESKTOP_UA =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }

    // ---------------------------------------------------------------- lifecycle

    override fun onCreate(savedInstanceState: Bundle?) {
        cfg = AppConfig.load(this)
        if (cfg.darkMode) setTheme(android.R.style.Theme_Material_NoActionBar)
        super.onCreate(savedInstanceState)

        if (cfg.adBlock) AdBlocker.init(this)
        themeColor = runCatching { Color.parseColor(cfg.themeColor) }.getOrDefault(themeColor)
        desktopMode = prefs.getBoolean("desktop", cfg.desktopMode)

        Uri.parse(cfg.url).host?.let { siteRoots += rootDomain(it) }
        siteRoots += cfg.allowedDomains

        applyOrientation(prefs.getString("orientation", cfg.orientation) ?: cfg.orientation)
        if (cfg.keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (cfg.noScreenshot) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        buildLayout()
        setupWindow()
        setupWebView()

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        else web.loadUrl(intent?.dataString?.takeIf { it.startsWith("http") } ?: cfg.url)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() { super.onResume(); web.onResume() }

    override fun onPause() {
        super.onPause()
        web.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        web.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && (cfg.fullscreen || customView != null)) hideSystemBars(true)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            customView != null -> hideCustomView()
            web.canGoBack() -> web.goBack()
            cfg.doubleBackExit && System.currentTimeMillis() - lastBackPress > 2000 -> {
                lastBackPress = System.currentTimeMillis()
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show()
            }
            else -> super.onBackPressed()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_REQUEST) {
            fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    // ---------------------------------------------------------------- layout & window

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    @SuppressLint("ClickableViewAccessibility")
    private fun buildLayout() {
        root = FrameLayout(this).apply { setBackgroundColor(if (cfg.fullscreen) Color.BLACK else themeColor) }

        web = WebView(this)
        swipe = SwipeRefreshLayout(this).apply {
            addView(web, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            isEnabled = cfg.pullToRefresh
            setColorSchemeColors(themeColor)
            setOnRefreshListener { web.reload() }
            setOnChildScrollUpCallback { _, _ -> jsCanScrollUp || web.scrollY > 0 || web.canScrollVertically(-1) }
        }
        val content = FrameLayout(this).apply { setBackgroundColor(if (cfg.darkMode) Color.BLACK else Color.WHITE) }
        content.addView(swipe, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progressTintList = ColorStateList.valueOf(themeColor)
            visibility = View.GONE
        }
        content.addView(progress, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, dp(4)).apply {
            topMargin = -dp(1)
        })

        errorView = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(32), dp(32), dp(32), dp(32))
            setBackgroundColor(if (cfg.darkMode) Color.BLACK else Color.WHITE)
            visibility = View.GONE
            isClickable = true
            addView(TextView(context).apply {
                text = "No connection"
                textSize = 22f
                gravity = Gravity.CENTER
                setTextColor(if (cfg.darkMode) Color.WHITE else Color.DKGRAY)
            })
            addView(TextView(context).apply {
                text = "Check your internet and try again."
                textSize = 15f
                gravity = Gravity.CENTER
                setPadding(0, dp(8), 0, dp(20))
                setTextColor(Color.GRAY)
            })
            addView(Button(context).apply {
                text = "Retry"
                backgroundTintList = ColorStateList.valueOf(themeColor)
                setTextColor(if (isLight(themeColor)) Color.BLACK else Color.WHITE)
                setOnClickListener {
                    errorView.visibility = View.GONE
                    failedUrl?.let { web.loadUrl(it) } ?: web.reload()
                }
            })
        }
        content.addView(errorView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        if (cfg.floatingMenu) content.addView(buildMenuButton(), FrameLayout.LayoutParams(dp(46), dp(46)).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            setMargins(0, 0, dp(16), dp(24))
        })

        root.addView(content, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        setContentView(root)

        // Keep content clear of status bar, navigation bar, notch and keyboard.
        root.setOnApplyWindowInsetsListener { v, insets ->
            if (customView != null) { v.setPadding(0, 0, 0, 0); return@setOnApplyWindowInsetsListener insets }
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                v.setPadding(bars.left, bars.top, bars.right, max(bars.bottom, ime.bottom))
            } else {
                v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                    insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            }
            insets
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun buildMenuButton(): View {
        val btn = ImageButton(this).apply {
            setImageResource(android.R.drawable.ic_menu_more)
            imageTintList = ColorStateList.valueOf(if (isLight(themeColor)) Color.BLACK else Color.WHITE)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(themeColor) }
            alpha = 0.75f
            elevation = dp(6).toFloat()
            contentDescription = "Menu"
        }
        // draggable: move with finger, tap opens menu
        var downX = 0f; var downY = 0f; var startX = 0f; var startY = 0f; var dragging = false
        btn.setOnTouchListener { v, e ->
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; startX = v.translationX; startY = v.translationY; dragging = false }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX; val dy = e.rawY - downY
                    if (dragging || abs(dx) > dp(8) || abs(dy) > dp(8)) {
                        dragging = true; v.translationX = startX + dx; v.translationY = startY + dy
                    }
                }
                MotionEvent.ACTION_UP -> if (!dragging) showMenu(v)
            }
            true
        }
        menuButton = btn
        return btn
    }

    private fun showMenu(anchor: View) {
        val pm = PopupMenu(this, anchor)
        val m = pm.menu
        m.add(0, 1, 0, "Home")
        m.add(0, 2, 1, "Refresh")
        m.add(0, 3, 2, "Desktop mode").apply { isCheckable = true; isChecked = desktopMode }
        m.add(0, 4, 3, "Rotate screen")
        m.add(0, 5, 4, "Auto rotate")
        m.add(0, 6, 5, "Share link")
        m.add(0, 7, 6, "Open in browser")
        m.add(0, 8, 7, "Clear cache & cookies")
        m.add(0, 9, 8, "Exit")
        pm.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> web.loadUrl(cfg.url)
                2 -> web.reload()
                3 -> setDesktopMode(!desktopMode)
                4 -> {
                    val landscape = resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
                    val o = if (landscape) "portrait" else "landscape"
                    prefs.edit().putString("orientation", o).apply(); applyOrientation(o)
                }
                5 -> { prefs.edit().putString("orientation", "sensor").apply(); applyOrientation("sensor") }
                6 -> startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"; putExtra(Intent.EXTRA_TEXT, web.url ?: cfg.url)
                }, "Share"))
                7 -> openExternal(Uri.parse(web.url ?: cfg.url))
                8 -> {
                    web.clearCache(true); web.clearHistory()
                    CookieManager.getInstance().removeAllCookies(null)
                    android.webkit.WebStorage.getInstance().deleteAllData()
                    web.loadUrl(cfg.url)
                    Toast.makeText(this, "Cleared", Toast.LENGTH_SHORT).show()
                }
                9 -> finishAndRemoveTask()
            }
            true
        }
        pm.show()
    }

    private fun setupWindow() {
        // Draw edge-to-edge on every Android version; insets listener adds the padding.
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= 28 && cfg.fullscreen) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }
        val lightBars = isLight(themeColor)
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
            val mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (lightBars) mask else 0, mask)
        } else {
            var flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            if (lightBars) flags = flags or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.decorView.systemUiVisibility = flags
        }
        if (cfg.fullscreen) hideSystemBars(true)
    }

    private fun hideSystemBars(hide: Boolean) {
        if (Build.VERSION.SDK_INT >= 30) {
            val c = window.insetsController ?: return
            if (hide) {
                c.hide(WindowInsets.Type.systemBars())
                c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else c.show(WindowInsets.Type.systemBars())
        } else {
            val base = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            window.decorView.systemUiVisibility = if (hide) base or View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY else base
        }
    }

    private fun applyOrientation(o: String) {
        requestedOrientation = when (o) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            "sensor" -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }

    // ---------------------------------------------------------------- webview

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun setupWebView() {
        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.loadWithOverviewMode = true   // auto-fit page to screen width
        s.useWideViewPort = true
        s.setSupportZoom(cfg.zoom || desktopMode)
        s.builtInZoomControls = cfg.zoom || desktopMode
        s.displayZoomControls = false
        s.mediaPlaybackRequiresUserGesture = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        s.allowFileAccess = false
        s.javaScriptCanOpenWindowsAutomatically = !cfg.blockPopups
        s.setSupportMultipleWindows(true)
        s.cacheMode = if (cfg.cache) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_NO_CACHE
        defaultUserAgent = cfg.userAgent.ifBlank { s.userAgentString }
        s.userAgentString = if (desktopMode) DESKTOP_UA else defaultUserAgent

        if (cfg.darkMode && WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, true)
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, !cfg.adBlock)

        web.addJavascriptInterface(object {
            @JavascriptInterface fun setScrollUp(v: Boolean) { jsCanScrollUp = v }
        }, "__webapk")

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(web, earlyScript(), setOf("*"))
        }

        web.webViewClient = Client()
        web.webChromeClient = Chrome()

        if (cfg.downloads) web.setDownloadListener { url, ua, disposition, mime, _ -> download(url, ua, disposition, mime) }
    }

    private fun setDesktopMode(on: Boolean) {
        desktopMode = on
        prefs.edit().putBoolean("desktop", on).apply()
        web.settings.userAgentString = if (on) DESKTOP_UA else defaultUserAgent
        web.settings.setSupportZoom(cfg.zoom || on)
        web.settings.builtInZoomControls = cfg.zoom || on
        web.reload()
    }

    /** Runs before page scripts: kills popups / tracks inner scroll for pull-to-refresh. */
    private fun earlyScript(): String = """
        (function(){
          if (window.__webapkInit) return; window.__webapkInit = true;
          ${if (cfg.blockPopups) """
          try {
            var fake = {closed:true, close:function(){}, focus:function(){}, blur:function(){}, postMessage:function(){}, document:{write:function(){},close:function(){}}, location:{}};
            var realOpen = window.open;
            window.open = function(u){
              try { var h = new URL(u, location.href).hostname; if (h === location.hostname) { location.href = new URL(u, location.href).href; return window; } } catch(e) {}
              return fake;
            };
          } catch(e) {}""" else ""}
          document.addEventListener('touchstart', function(e){
            var el = e.target, up = false;
            while (el && el !== document.documentElement) {
              if (el.scrollTop > 0) { up = true; break; }
              el = el.parentElement;
            }
            if (window.__webapk) __webapk.setScrollUp(up);
          }, {passive:true, capture:true});
        })();
    """.trimIndent()

    private fun pageFinishedScript(): String {
        val css = buildString {
            if (cfg.adBlock) append(AdBlocker.HIDE_ADS_CSS)
            append(cfg.customCss)
        }.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$")
        val desktopJs = if (desktopMode) """
            var m = document.querySelector('meta[name=viewport]');
            if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head && document.head.appendChild(m); }
            m.setAttribute('content', 'width=1280');
        """ else ""
        return """
            (function(){
              try {
                $desktopJs
                if (!document.getElementById('__webapk_css')) {
                  var st = document.createElement('style'); st.id = '__webapk_css';
                  st.textContent = `$css`;
                  (document.head || document.documentElement).appendChild(st);
                }
              } catch(e) {}
            })();
        """.trimIndent() + "\n" + cfg.customJs
    }

    private inner class Client : WebViewClient() {

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (cfg.adBlock && AdBlocker.isBlockedWaiting(request.url.host) && !isInternal(request.url.host)) {
                return AdBlocker.emptyResponse()
            }
            return null
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return false
            return handleNavigation(request.url, request.hasGesture())
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            if (cfg.progressBar) progress.visibility = View.VISIBLE
            errorView.visibility = View.GONE
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                view.evaluateJavascript(earlyScript(), null)
            }
        }

        override fun onPageFinished(view: WebView, url: String?) {
            swipe.isRefreshing = false
            progress.visibility = View.GONE
            if (initialLoad) {
                // site redirected on first load (e.g. example.com -> www.example.net): trust it
                Uri.parse(url ?: "").host?.let { siteRoots += rootDomain(it) }
                initialLoad = false
            }
            view.evaluateJavascript(pageFinishedScript(), null)
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) {
                failedUrl = request.url.toString()
                swipe.isRefreshing = false
                errorView.visibility = View.VISIBLE
            }
        }

        override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
            handler.cancel()
            toast("Insecure connection blocked")
        }
    }

    private inner class Chrome : WebChromeClient() {

        override fun onProgressChanged(view: WebView, newProgress: Int) {
            progress.progress = newProgress
            if (newProgress >= 100) progress.visibility = View.GONE
        }

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            val popup = WebView(this@MainActivity)
            popup.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                    handlePopup(r.url, isUserGesture); v.destroy(); return true
                }
                override fun onPageStarted(v: WebView, url: String?, favicon: Bitmap?) {
                    if (url != null && url != "about:blank") { v.stopLoading(); handlePopup(Uri.parse(url), isUserGesture); v.destroy() }
                }
            }
            (resultMsg.obj as WebView.WebViewTransport).webView = popup
            resultMsg.sendToTarget()
            handler.postDelayed({ runCatching { popup.destroy() } }, 15_000)
            return true
        }

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            if (!cfg.fileUpload) return false
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            return try {
                startActivityForResult(params.createIntent(), FILE_REQUEST); true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null; false
            }
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) { callback.onCustomViewHidden(); return }
            customView = view
            customViewCallback = callback
            root.setPadding(0, 0, 0, 0)
            root.addView(view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            menuButton?.visibility = View.GONE
            hideSystemBars(true)
        }

        override fun onHideCustomView() = hideCustomView()
    }

    private fun hideCustomView() {
        val v = customView ?: return
        root.removeView(v)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
        menuButton?.visibility = View.VISIBLE
        if (!cfg.fullscreen) hideSystemBars(false)
        root.requestApplyInsets()
    }

    // ---------------------------------------------------------------- link policy

    /** @return true if the WebView must NOT load this url itself. */
    private fun handleNavigation(uri: Uri, gesture: Boolean): Boolean {
        val scheme = uri.scheme?.lowercase() ?: return true
        if (scheme == "http" || scheme == "https") {
            val host = uri.host
            if (isInternal(host)) return false
            if (cfg.adBlock && AdBlocker.isBlocked(host)) { toast("Ad blocked"); return true }
            if (initialLoad) { host?.let { siteRoots += rootDomain(it) }; return false }
            if (cfg.blockRedirects && !gesture) { toast("Redirect blocked"); return true }
            return when (cfg.externalLinks) {
                "inside" -> false
                "block" -> { toast("External link blocked"); true }
                else -> { openExternal(uri); true }
            }
        }
        if (scheme in setOf("about", "javascript", "data", "blob")) return false
        // app links: tel:, mailto:, whatsapp:, intent:, market: ...
        if (cfg.blockRedirects && !gesture) { toast("Redirect blocked"); return true }
        if (scheme == "intent") {
            try {
                val intent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                intent.addCategory(Intent.CATEGORY_BROWSABLE); intent.component = null; intent.selector = null
                try { startActivity(intent) } catch (e: ActivityNotFoundException) {
                    intent.getStringExtra("browser_fallback_url")?.let { fb ->
                        val fu = Uri.parse(fb)
                        if (!handleNavigation(fu, gesture)) web.loadUrl(fb)
                    }
                }
            } catch (_: Exception) { }
            return true
        }
        openExternal(uri)
        return true
    }

    private fun handlePopup(uri: Uri, gesture: Boolean) {
        val host = uri.host
        when {
            cfg.adBlock && AdBlocker.isBlocked(host) -> toast("Popup ad blocked")
            isInternal(host) -> web.loadUrl(uri.toString())
            cfg.blockPopups -> toast("Popup blocked")
            else -> if (!handleNavigation(uri, gesture)) web.loadUrl(uri.toString())
        }
    }

    private fun isInternal(host: String?): Boolean {
        if (host.isNullOrEmpty()) return false
        val h = host.lowercase()
        return siteRoots.any { h == it || h.endsWith(".$it") }
    }

    private fun rootDomain(host: String): String {
        val parts = host.lowercase().removePrefix("www.").split('.').filter { it.isNotEmpty() }
        if (parts.size <= 2) return parts.joinToString(".")
        val sld = parts[parts.size - 2]
        // handles co.uk / com.pk / gov.in style suffixes
        val take = if (parts.last().length == 2 && sld.length <= 3) 3 else 2
        return parts.takeLast(take).joinToString(".")
    }

    private fun openExternal(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) { toast("No app can open this link") }
    }

    private fun download(url: String, ua: String?, disposition: String?, mime: String?) {
        if (!url.startsWith("http")) { toast("This download type is not supported"); return }
        if (Build.VERSION.SDK_INT < 29) { openExternal(Uri.parse(url)); return }
        try {
            val name = URLUtil.guessFileName(url, disposition, mime)
            val req = DownloadManager.Request(Uri.parse(url)).apply {
                mime?.let { setMimeType(it) }
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                ua?.let { addRequestHeader("User-Agent", it) }
                setTitle(name)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            toast("Downloading $name")
        } catch (e: Exception) {
            openExternal(Uri.parse(url))
        }
    }

    private fun toast(msg: String) {
        val now = System.currentTimeMillis()
        if (now - lastToast < 2500) return
        lastToast = now
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    private fun isLight(color: Int): Boolean {
        val l = (0.299 * Color.red(color) + 0.587 * Color.green(color) + 0.114 * Color.blue(color)) / 255
        return l > 0.6
    }
}
