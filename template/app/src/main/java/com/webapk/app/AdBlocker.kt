package com.webapk.app

import android.content.Context
import android.webkit.WebResourceResponse
import java.io.ByteArrayInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Host based ad / tracker / redirect blocker.
 * Loads assets/adhosts_builtin.txt and (if bundled) assets/adhosts.txt on a background thread.
 */
object AdBlocker {
    private val hosts = HashSet<String>(100_000)
    private val ready = CountDownLatch(1)
    @Volatile private var started = false

    fun init(context: Context) {
        if (started) return
        started = true
        val appContext = context.applicationContext
        Thread {
            try {
                for (name in listOf("adhosts_builtin.txt", "adhosts.txt")) {
                    try {
                        appContext.assets.open(name).bufferedReader().useLines { lines ->
                            lines.forEach { raw ->
                                val line = raw.substringBefore('#').trim()
                                if (line.isEmpty()) return@forEach
                                // supports "domain" and hosts-file "0.0.0.0 domain" formats
                                val host = line.split(' ', '\t').last { it.isNotBlank() }.lowercase()
                                if (host != "localhost" && host.contains('.')) hosts.add(host)
                            }
                        }
                    } catch (_: Exception) { /* file not bundled */ }
                }
            } finally {
                ready.countDown()
            }
        }.start()
    }

    /** Waits (max 3s) for the list. Only call from background threads. */
    fun isBlockedWaiting(host: String?): Boolean {
        ready.await(3, TimeUnit.SECONDS)
        return isBlocked(host)
    }

    fun isBlocked(host: String?): Boolean {
        if (host.isNullOrEmpty() || ready.count > 0) return false
        var h = host.lowercase()
        while (true) {
            if (hosts.contains(h)) return true
            val dot = h.indexOf('.')
            if (dot < 0 || h.indexOf('.', dot + 1) < 0) return false
            h = h.substring(dot + 1)
        }
    }

    fun emptyResponse(): WebResourceResponse =
        WebResourceResponse("text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)))

    /** Generic cosmetic filter that hides common ad containers. */
    const val HIDE_ADS_CSS = """
        ins.adsbygoogle, .adsbygoogle, [id^="google_ads"], [id^="div-gpt-ad"], [data-ad-slot],
        [data-ad-client], iframe[src*="doubleclick"], iframe[src*="googlesyndication"],
        iframe[src*="ads."], iframe[id^="aswift"], .ad-banner, .ad-container, .ad-wrapper,
        .ad-slot, .adsbox, .advertisement, .sponsored-ad, #ad-banner, #ad-container,
        .popunder, .taboola, [id^="taboola"], .OUTBRAIN, [id^="mgid"], [class*="adsterra"]
        { display: none !important; visibility: hidden !important; height: 0 !important; }
    """
}
