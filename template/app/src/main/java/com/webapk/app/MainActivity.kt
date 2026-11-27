@file:Suppress("DEPRECATION")

package com.webapk.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
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
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
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
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import org.json.JSONTokener
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
    private var videoButton: ImageButton? = null   // own button for "Download video" when there is no floating menu
    private var siteList: View? = null
    private lateinit var ads: Ads

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
    private var homeUrl = ""                  // start page of the site being shown
    private var showingList = false           // multi-site app: the site list is on screen
    private var clearHistoryOnLoad = false    // forget the previous site once the new one loads
    private val handler = Handler(Looper.getMainLooper())

    // video download: .mp4 / .webm requests seen on the current page, and whether the page has a <video>
    private val sniffedVideos: MutableSet<String> = java.util.Collections.synchronizedSet(LinkedHashSet())
    private var pageHasVideoTag = false

    // runtime permissions: request code -> what to do with the answer
    private val permissionCallbacks = mutableMapOf<Int, (Map<String, Boolean>) -> Unit>()
    private var nextPermissionRequest = 5000

    private var wentToBackground = false
    private var ignoreNextReturn = false      // came back from our own file picker / share sheet: no app-open ad

    private val prefs by lazy { getSharedPreferences("webapk", Context.MODE_PRIVATE) }

    companion object {
        private const val FILE_REQUEST = 4401
        private val VIDEO_EXT = Regex("""\.(mp4|m4v|webm)$""", RegexOption.IGNORE_CASE)
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

        homeUrl = cfg.url
        Uri.parse(cfg.url).host?.let { siteRoots += rootDomain(it) }
        for (site in cfg.sites) Uri.parse(site.url).host?.let { siteRoots += rootDomain(it) }
        siteRoots += cfg.allowedDomains

        applyOrientation(prefs.getString("orientation", cfg.orientation) ?: cfg.orientation)
        if (cfg.keepScreenOn) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (cfg.noScreenshot) window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)

        ads = Ads(this, cfg.ads)
        buildLayout()
        setupWindow()
        setupWebView()

        // ask for the chosen permissions first (if set to ask on start), so the ad consent form doesn't overlap
        val startPerms = if (cfg.permissions.askOnStart && savedInstanceState == null) chosenPermissions() else emptyArray()
        if (startPerms.isNotEmpty()) requestAppPermissions(startPerms) { ads.start() } else ads.start()

        val link = intent?.dataString?.takeIf { it.startsWith("http") }
        when {
            savedInstanceState != null -> {
                homeUrl = savedInstanceState.getString("homeUrl") ?: cfg.url
                web.restoreState(savedInstanceState)
                if (savedInstanceState.getBoolean("showingList")) showSiteList()
            }
            link != null -> web.loadUrl(link)
            isMultiSite -> showSiteList()
            else -> web.loadUrl(cfg.url)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
        outState.putString("homeUrl", homeUrl)
        outState.putBoolean("showingList", showingList)
    }

    private val isMultiSite get() = cfg.sites.size > 1

    override fun onResume() { super.onResume(); web.onResume(); ads.resume() }

    override fun onPause() {
        super.onPause()
        web.onPause()
        ads.pause()
        CookieManager.getInstance().flush()
    }

    override fun onStart() {
        super.onStart()
        if (!wentToBackground) return
        wentToBackground = false
        if (ignoreNextReturn) ignoreNextReturn = false else ads.onReturnToApp()
    }

    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) wentToBackground = true
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        ads.destroy()
        web.destroy()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- runtime permissions

    /** Dangerous permissions switched on in the builder (they are also the only ones in the manifest). */
    private fun chosenPermissions(): Array<String> {
        val p = mutableListOf<String>()
        if (cfg.permissions.camera) p += Manifest.permission.CAMERA
        if (cfg.permissions.microphone) p += Manifest.permission.RECORD_AUDIO
        if (cfg.permissions.location) { p += Manifest.permission.ACCESS_FINE_LOCATION; p += Manifest.permission.ACCESS_COARSE_LOCATION }
        return p.toTypedArray()
    }

    private fun hasPermission(p: String) = checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED

    /** Asks for the permissions that aren't granted yet, then calls [done] with permission -> granted. */
    private fun requestAppPermissions(perms: Array<String>, done: (Map<String, Boolean>) -> Unit) {
        val missing = perms.filter { !hasPermission(it) }
        if (missing.isEmpty()) { done(perms.associateWith { true }); return }
        val code = nextPermissionRequest++
        permissionCallbacks[code] = { done(perms.associateWith { hasPermission(it) }) }
        requestPermissions(missing.toTypedArray(), code)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        val cb = permissionCallbacks.remove(requestCode) ?: return super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        cb(emptyMap())
    }

    private fun permissionDenied(what: String) {
        toast("$what permission is off. Turn it on in Settings › Apps › ${getString(R.string.app_name)} › Permissions")
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && (cfg.fullscreen || customView != null)) hideSystemBars(true)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when {
            customView != null -> hideCustomView()
            !showingList && web.canGoBack() -> web.goBack()
            !showingList && isMultiSite -> showSiteList()
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

        if (isMultiSite) content.addView(buildSiteList().also { siteList = it },
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        val fabParams = { FrameLayout.LayoutParams(dp(46), dp(46)).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            setMargins(0, 0, dp(16), dp(24))
        } }
        if (cfg.floatingMenu) content.addView(buildMenuButton(), fabParams())
        else if (cfg.videoDownload) content.addView(buildVideoButton(), fabParams())

        // page + optional AdMob banner strip above or below it
        val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val banner = ads.bannerView()?.apply { setBackgroundColor(if (cfg.darkMode) Color.BLACK else Color.WHITE) }
        val bannerOnTop = cfg.ads.bannerPosition == "top"
        if (banner != null && bannerOnTop) column.addView(banner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        column.addView(content, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        if (banner != null && !bannerOnTop) column.addView(banner, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)

        root.addView(column, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
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

    private fun buildFab(iconRes: Int, label: String, onTap: (View) -> Unit): ImageButton {
        val btn = ImageButton(this).apply {
            setImageResource(iconRes)
            imageTintList = ColorStateList.valueOf(if (isLight(themeColor)) Color.BLACK else Color.WHITE)
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(themeColor) }
            alpha = 0.75f
            elevation = dp(6).toFloat()
            contentDescription = label
        }
        makeDraggable(btn, onTap)
        return btn
    }

    /** Move the button with a finger; a tap without moving runs [onTap]. */
    @SuppressLint("ClickableViewAccessibility")
    private fun makeDraggable(btn: View, onTap: (View) -> Unit) {
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
                MotionEvent.ACTION_UP -> if (!dragging) onTap(v)
            }
            true
        }
    }

    private fun buildMenuButton(): View =
        buildFab(android.R.drawable.ic_menu_more, "Menu") { showMenu(it) }.also { menuButton = it }

    /** Shown instead of the menu when the floating menu is off; appears only on pages with a video. */
    private fun buildVideoButton(): View =
        buildFab(android.R.drawable.stat_sys_download, "Download video") { downloadVideo() }.also {
            it.visibility = View.GONE
            videoButton = it
        }

    /** Shows / hides the floating buttons (hidden on the site list and in fullscreen video). */
    private fun updateFloatingButtons() {
        val pageOnScreen = !showingList && customView == null
        menuButton?.visibility = if (pageOnScreen) View.VISIBLE else View.GONE
        videoButton?.visibility = if (pageOnScreen && (pageHasVideoTag || sniffedVideos.isNotEmpty())) View.VISIBLE else View.GONE
    }

    private fun showMenu(anchor: View) {
        val pm = PopupMenu(this, anchor)
        val m = pm.menu
        if (isMultiSite) m.add(0, 10, 0, "All sites")
        m.add(0, 1, 0, "Home")
        m.add(0, 2, 1, "Refresh")
        if (cfg.videoDownload) m.add(0, 11, 1, "Download video")
        m.add(0, 3, 2, "Desktop mode").apply { isCheckable = true; isChecked = desktopMode }
        m.add(0, 4, 3, "Rotate screen")
        m.add(0, 5, 4, "Auto rotate")
        m.add(0, 6, 5, "Share link")
        m.add(0, 7, 6, "Open in browser")
        m.add(0, 8, 7, "Clear cache & cookies")
        m.add(0, 9, 8, "Exit")
        pm.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                10 -> showSiteList()
                1 -> web.loadUrl(homeUrl)
                2 -> web.reload()
                11 -> downloadVideo()
                3 -> setDesktopMode(!desktopMode)
                4 -> {
                    val landscape = resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE
                    val o = if (landscape) "portrait" else "landscape"
                    prefs.edit().putString("orientation", o).apply(); applyOrientation(o)
                }
                5 -> { prefs.edit().putString("orientation", "sensor").apply(); applyOrientation("sensor") }
                6 -> {
                    ignoreNextReturn = true
                    startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"; putExtra(Intent.EXTRA_TEXT, web.url ?: cfg.url)
                    }, "Share"))
                }
                7 -> openExternal(Uri.parse(web.url ?: cfg.url))
                8 -> {
                    web.clearCache(true); web.clearHistory()
                    CookieManager.getInstance().removeAllCookies(null)
                    android.webkit.WebStorage.getInstance().deleteAllData()
                    if (showingList) web.loadUrl("about:blank") else web.loadUrl(homeUrl)
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
        s.setGeolocationEnabled(cfg.permissions.location)
        defaultUserAgent = cfg.userAgent.ifBlank { s.userAgentString }
        s.userAgentString = if (desktopMode) DESKTOP_UA else defaultUserAgent

        if (cfg.darkMode && WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, true)
        }

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, !cfg.adBlock)

        web.addJavascriptInterface(object {
            @JavascriptInterface fun setScrollUp(v: Boolean) { jsCanScrollUp = v }
            @JavascriptInterface fun setHasVideo(v: Boolean) { handler.post { pageHasVideoTag = v; updateFloatingButtons() } }
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
        // tells the app whether the page has a video, so the "Download video" button can appear
        val videoJs = if (cfg.videoDownload && !cfg.floatingMenu) """
            if (!window.__webapkVideoWatch) {
              window.__webapkVideoWatch = true;
              var had = null;
              var check = function(){
                var v = !!document.querySelector('video, a[href*=".mp4"], a[href*=".webm"]');
                if (v !== had) { had = v; if (window.__webapk) __webapk.setHasVideo(v); }
              };
              check(); setInterval(check, 2000);
            }
        """ else ""
        return """
            (function(){
              try {
                $desktopJs
                $videoJs
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
            if (cfg.videoDownload && isVideoFile(request.url)) {
                val url = request.url.toString()
                if (sniffedVideos.size < 50 && sniffedVideos.add(url)) handler.post { updateFloatingButtons() }
            }
            return null
        }

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return false
            return handleNavigation(request.url, request.hasGesture())
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
            errorView.visibility = View.GONE
            sniffedVideos.clear()       // new page: forget the previous page's videos
            pageHasVideoTag = false
            updateFloatingButtons()
            if (showingList) return
            if (cfg.progressBar) progress.visibility = View.VISIBLE
            if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                view.evaluateJavascript(earlyScript(), null)
            }
        }

        override fun onPageFinished(view: WebView, url: String?) {
            swipe.isRefreshing = false
            progress.visibility = View.GONE
            if (showingList || url == null || url == "about:blank") return
            if (clearHistoryOnLoad) { clearHistoryOnLoad = false; view.clearHistory() }
            if (initialLoad) {
                // site redirected on first load (e.g. example.com -> www.example.net): trust it
                Uri.parse(url ?: "").host?.let { siteRoots += rootDomain(it) }
                initialLoad = false
            }
            view.evaluateJavascript(pageFinishedScript(), null)
            if (lastCountedPage != url) { lastCountedPage = url; ads.onPageLoaded() }
        }

        private var lastCountedPage: String? = null

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame && !showingList) {
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
                ignoreNextReturn = true
                startActivityForResult(params.createIntent(), FILE_REQUEST); true
            } catch (e: ActivityNotFoundException) {
                ignoreNextReturn = false
                fileCallback = null; false
            }
        }

        /** Camera / microphone for the site (video calls, voice notes, QR scanners...). */
        override fun onPermissionRequest(request: PermissionRequest) {
            val wanted = mutableListOf<String>()     // WebView resources we may grant
            val needed = mutableListOf<String>()     // Android permissions they need
            for (r in request.resources) when (r) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> if (cfg.permissions.camera) { wanted += r; needed += Manifest.permission.CAMERA }
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> if (cfg.permissions.microphone) { wanted += r; needed += Manifest.permission.RECORD_AUDIO }
                PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID -> wanted += r   // DRM video, needs no permission
            }
            if (wanted.isEmpty()) { request.deny(); return }
            requestAppPermissions(needed.toTypedArray()) { granted ->
                val ok = wanted.filter {
                    when (it) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> granted[Manifest.permission.CAMERA] == true
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> granted[Manifest.permission.RECORD_AUDIO] == true
                        else -> true
                    }
                }
                if (ok.size < wanted.size) permissionDenied(if (granted[Manifest.permission.CAMERA] == false) "Camera" else "Microphone")
                if (ok.isEmpty()) request.deny() else request.grant(ok.toTypedArray())
            }
        }

        /** navigator.geolocation */
        override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
            if (!cfg.permissions.location) { callback.invoke(origin, false, false); return }
            requestAppPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) { granted ->
                val ok = granted.values.any { it }
                if (!ok) permissionDenied("Location")
                callback.invoke(origin, ok, false)
            }
        }

        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) { callback.onCustomViewHidden(); return }
            customView = view
            customViewCallback = callback
            root.setPadding(0, 0, 0, 0)
            root.addView(view, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            updateFloatingButtons()
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
        updateFloatingButtons()
        if (!cfg.fullscreen) hideSystemBars(false)
        root.requestApplyInsets()
    }

    // ---------------------------------------------------------------- multi-site list

    private fun showSiteList() {
        val list = siteList ?: return
        showingList = true
        web.stopLoading()
        web.loadUrl("about:blank")   // stops sound / video of the site that was open
        swipe.isRefreshing = false
        progress.visibility = View.GONE
        errorView.visibility = View.GONE
        updateFloatingButtons()
        list.visibility = View.VISIBLE
    }

    private fun openSite(site: Site) {
        showingList = false
        homeUrl = site.url
        initialLoad = true
        clearHistoryOnLoad = true   // back from this site's first page returns to the list
        siteList?.visibility = View.GONE
        updateFloatingButtons()
        web.loadUrl(site.url)
    }

    private fun buildSiteList(): View {
        val dark = cfg.darkMode
        val pageBg = Color.parseColor(if (dark) "#121212" else "#F5F6F8")
        val cardBg = if (dark) Color.parseColor("#1E1E1E") else Color.WHITE
        val cardLine = Color.parseColor(if (dark) "#2C2C2C" else "#E4E7EC")
        val textColor = if (dark) Color.WHITE else Color.parseColor("#101828")
        val subColor = Color.parseColor(if (dark) "#9E9E9E" else "#667085")
        val onTheme = if (isLight(themeColor)) Color.BLACK else Color.WHITE

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(28), dp(20), dp(24))
        }
        column.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 26f
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(textColor)
        })
        column.addView(TextView(this).apply {
            text = "Choose a site to open"
            textSize = 15f
            setTextColor(subColor)
            setPadding(0, dp(4), 0, dp(20))
        })

        for (site in cfg.sites) {
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(14), dp(14), dp(14), dp(14))
                val card = GradientDrawable().apply {
                    cornerRadius = dp(16).toFloat(); setColor(cardBg); setStroke(dp(1), cardLine)
                }
                background = RippleDrawable(ColorStateList.valueOf(Color.argb(40, 128, 128, 128)), card, null)
                isClickable = true
                isFocusable = true
                contentDescription = site.name
                setOnClickListener { openSite(site) }
            }
            row.addView(TextView(this).apply {
                text = site.name.firstOrNull { it.isLetterOrDigit() }?.uppercase() ?: "#"
                textSize = 18f
                gravity = Gravity.CENTER
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(onTheme)
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(themeColor) }
            }, LinearLayout.LayoutParams(dp(44), dp(44)))
            val texts = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(14), 0, 0, 0)
            }
            texts.addView(TextView(this).apply {
                text = site.name
                textSize = 17f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(textColor)
            })
            texts.addView(TextView(this).apply {
                text = Uri.parse(site.url).host?.removePrefix("www.") ?: site.url
                textSize = 13.5f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                setTextColor(subColor)
            })
            row.addView(texts, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            column.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(10)
            })
        }

        return ScrollView(this).apply {
            setBackgroundColor(pageBg)
            isFillViewport = true
            isClickable = true   // keep taps away from the WebView underneath
            visibility = View.GONE
            addView(column)
        }
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
        enqueueDownload(url, URLUtil.guessFileName(url, disposition, mime), mime, ua)
    }

    /** Saves [url] to the Downloads folder with Android's download manager (progress in the notification bar). */
    private fun enqueueDownload(url: String, name: String, mime: String?, ua: String?, referer: String? = null) {
        if (Build.VERSION.SDK_INT < 29 && !hasPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
            // Android 8-9 need the storage permission to write to Downloads
            requestAppPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE)) { granted ->
                if (granted.values.all { it }) enqueueDownload(url, name, mime, ua, referer)
                else { permissionDenied("Storage"); openExternal(Uri.parse(url)) }
            }
            return
        }
        try {
            val req = DownloadManager.Request(Uri.parse(url)).apply {
                mime?.let { setMimeType(it) }
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                ua?.let { addRequestHeader("User-Agent", it) }
                referer?.let { addRequestHeader("Referer", it) }
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

    // ---------------------------------------------------------------- video download

    private fun isVideoFile(uri: Uri): Boolean {
        val path = uri.path ?: return false
        return (uri.scheme == "http" || uri.scheme == "https") && VIDEO_EXT.containsMatchIn(path)
    }

    /** Finds the videos on the page (video tags, links, og:video and .mp4 requests) and offers to download one. */
    private fun downloadVideo() {
        if (showingList) { toast("Open a site first"); return }
        val findScript = """
            (function(){
              var out = [], seen = {}, blob = false, stream = false;
              function add(u){
                if (!u) return;
                try { u = new URL(u, location.href).href; } catch(e) { return; }
                if (/^blob:/i.test(u)) { blob = true; return; }
                if (!/^https?:/i.test(u) || seen[u]) return;
                if (/\.(m3u8|mpd)(\?|#|$)/i.test(u)) { stream = true; return; }
                seen[u] = 1; out.push(u);
              }
              document.querySelectorAll('video').forEach(function(v){
                add(v.currentSrc); add(v.getAttribute('src'));
                v.querySelectorAll('source').forEach(function(s){ add(s.getAttribute('src')); });
              });
              document.querySelectorAll('a[href]').forEach(function(a){ if (/\.(mp4|m4v|webm)(\?|#|$)/i.test(a.href)) add(a.href); });
              document.querySelectorAll('meta[property^="og:video"]').forEach(function(m){ if (/^https?:/i.test(m.content)) add(m.content); });
              return JSON.stringify({ urls: out, blob: blob, stream: stream, title: document.title || '' });
            })();
        """.trimIndent()
        web.evaluateJavascript(findScript) { raw ->
            val found = LinkedHashSet<String>()
            var streamed = false
            var title = ""
            runCatching {
                val o = JSONObject(JSONTokener(raw).nextValue() as String)
                val arr = o.getJSONArray("urls")
                for (i in 0 until arr.length()) found += arr.getString(i)
                streamed = o.optBoolean("blob") || o.optBoolean("stream")
                title = o.optString("title")
            }
            synchronized(sniffedVideos) { found += sniffedVideos }
            val urls = found.toList()
            when {
                urls.isEmpty() && streamed -> toast("This video is streamed in small pieces and can't be downloaded")
                urls.isEmpty() -> toast("No video found on this page. Play the video, then try again.")
                else -> chooseVideo(urls, title)
            }
        }
    }

    private fun chooseVideo(urls: List<String>, pageTitle: String) {
        val labels = urls.map { u ->
            val uri = Uri.parse(u)
            "${uri.lastPathSegment ?: "video"}\n${uri.host?.removePrefix("www.") ?: ""}"
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle(if (urls.size == 1) "Download this video?" else "Choose a video to download")
            .setItems(labels) { _, which -> startVideoDownload(urls[which], pageTitle) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun startVideoDownload(url: String, pageTitle: String) {
        val uri = Uri.parse(url)
        val ext = VIDEO_EXT.find(uri.path ?: "")?.groupValues?.get(1)?.lowercase() ?: "mp4"
        // name it after the page ("My video.mp4") rather than "videoplayback.mp4"
        val base = pageTitle.replace(Regex("""[\\/:*?"<>|\r\n\t]+"""), " ").trim().take(80)
            .ifEmpty { URLUtil.guessFileName(url, null, "video/$ext").substringBeforeLast('.') }
        val mime = if (ext == "webm") "video/webm" else "video/mp4"
        enqueueDownload(url, "$base.$ext", mime, web.settings.userAgentString, web.url)
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
