package com.webapk.app

import android.content.Context
import org.json.JSONObject

/** One entry of a multi-site app's start list. */
data class Site(val name: String, val url: String)

/** Phone features the website may use. Only these are in the manifest; anything else is refused. */
data class PermissionConfig(
    val camera: Boolean,
    val microphone: Boolean,
    val location: Boolean,
    val askOnStart: Boolean,          // ask for all of them when the app opens, not when the site needs them
)

/** AdMob settings. Empty unit IDs switch that ad type off. */
data class AdsConfig(
    val enabled: Boolean,
    val bannerId: String,
    val bannerPosition: String,       // top | bottom
    val interstitialId: String,
    val interstitialEvery: Int,       // show after this many page loads
    val interstitialSeconds: Int,     // and at least this long after the previous full-screen ad
    val appOpenId: String,
    val consent: Boolean,             // show Google's GDPR consent form (UMP) first
)

/** All settings chosen on the website, read from assets/config.json. */
data class AppConfig(
    val url: String,
    val sites: List<Site>,            // 2+ entries: the app opens on a list of these sites

    val pullToRefresh: Boolean,
    val desktopMode: Boolean,
    val orientation: String,          // auto | portrait | landscape | sensor
    val fullscreen: Boolean,
    val adBlock: Boolean,
    val blockRedirects: Boolean,
    val blockPopups: Boolean,
    val externalLinks: String,        // browser | inside | block
    val floatingMenu: Boolean,
    val zoom: Boolean,
    val keepScreenOn: Boolean,
    val noScreenshot: Boolean,
    val darkMode: Boolean,
    val progressBar: Boolean,
    val downloads: Boolean,
    val videoDownload: Boolean,       // "Download video" in the menu, or its own button when the menu is off
    val fileUpload: Boolean,
    val doubleBackExit: Boolean,
    val cache: Boolean,
    val themeColor: String,
    val userAgent: String,
    val allowedDomains: List<String>,
    val customCss: String,
    val customJs: String,
    val permissions: PermissionConfig,
    val ads: AdsConfig,
) {
    companion object {
        fun load(context: Context): AppConfig {
            val text = context.assets.open("config.json").bufferedReader().use { it.readText() }
            val j = JSONObject(text)
            val domains = mutableListOf<String>()
            j.optJSONArray("allowedDomains")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val d = arr.optString(i).trim().lowercase().removePrefix("www.")
                    if (d.isNotEmpty()) domains += d
                }
            }
            val sites = mutableListOf<Site>()
            j.optJSONArray("sites")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val o = arr.optJSONObject(i) ?: continue
                    val u = o.optString("url").trim()
                    if (u.startsWith("http")) sites += Site(o.optString("name").trim().ifEmpty { u }, u)
                }
            }
            val p = j.optJSONObject("permissions") ?: JSONObject()
            val a = j.optJSONObject("ads") ?: JSONObject()
            return AppConfig(
                url = j.optString("url", "https://example.com"),
                sites = if (sites.size > 1) sites else emptyList(),
                pullToRefresh = j.optBoolean("pullToRefresh", true),
                desktopMode = j.optBoolean("desktopMode", false),
                orientation = j.optString("orientation", "auto"),
                fullscreen = j.optBoolean("fullscreen", false),
                adBlock = j.optBoolean("adBlock", true),
                blockRedirects = j.optBoolean("blockRedirects", true),
                blockPopups = j.optBoolean("blockPopups", true),
                externalLinks = j.optString("externalLinks", "browser"),
                floatingMenu = j.optBoolean("floatingMenu", true),
                zoom = j.optBoolean("zoom", true),
                keepScreenOn = j.optBoolean("keepScreenOn", false),
                noScreenshot = j.optBoolean("noScreenshot", false),
                darkMode = j.optBoolean("darkMode", false),
                progressBar = j.optBoolean("progressBar", true),
                downloads = j.optBoolean("downloads", true),
                videoDownload = j.optBoolean("videoDownload", false),
                fileUpload = j.optBoolean("fileUpload", true),
                doubleBackExit = j.optBoolean("doubleBackExit", true),
                cache = j.optBoolean("cache", true),
                themeColor = j.optString("themeColor", "#2563EB"),
                userAgent = j.optString("userAgent", ""),
                allowedDomains = domains,
                customCss = j.optString("customCss", ""),
                customJs = j.optString("customJs", ""),
                permissions = PermissionConfig(
                    camera = p.optBoolean("camera", false),
                    microphone = p.optBoolean("microphone", false),
                    location = p.optBoolean("location", false),
                    askOnStart = p.optBoolean("askOnStart", false),
                ),
                ads = AdsConfig(
                    enabled = a.optBoolean("enabled", false),
                    bannerId = a.optString("bannerId", "").trim(),
                    bannerPosition = a.optString("bannerPosition", "bottom"),
                    interstitialId = a.optString("interstitialId", "").trim(),
                    interstitialEvery = a.optInt("interstitialEvery", 5).coerceAtLeast(1),
                    interstitialSeconds = a.optInt("interstitialSeconds", 60).coerceAtLeast(0),
                    appOpenId = a.optString("appOpenId", "").trim(),
                    consent = a.optBoolean("consent", false),
                ),
            )
        }
    }
}
