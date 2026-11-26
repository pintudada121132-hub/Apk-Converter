package com.webapk.app

import android.content.Context
import org.json.JSONObject

/** All settings chosen on the website, read from assets/config.json. */
data class AppConfig(
    val url: String,
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
    val fileUpload: Boolean,
    val doubleBackExit: Boolean,
    val cache: Boolean,
    val themeColor: String,
    val userAgent: String,
    val allowedDomains: List<String>,
    val customCss: String,
    val customJs: String,
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
            return AppConfig(
                url = j.optString("url", "https://example.com"),
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
                fileUpload = j.optBoolean("fileUpload", true),
                doubleBackExit = j.optBoolean("doubleBackExit", true),
                cache = j.optBoolean("cache", true),
                themeColor = j.optString("themeColor", "#2563EB"),
                userAgent = j.optString("userAgent", ""),
                allowedDomains = domains,
                customCss = j.optString("customCss", ""),
                customJs = j.optString("customJs", ""),
            )
        }
    }
}
