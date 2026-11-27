package com.webapk.app

import android.app.Activity
import android.view.View

/** Used when the app has no ads: same calls as src/ads/.../Ads.kt, but they do nothing and AdMob is not included. */
@Suppress("UNUSED_PARAMETER")
class Ads(activity: Activity, cfg: AdsConfig) {
    fun bannerView(): View? = null
    fun start() {}
    fun onPageLoaded() {}
    fun onReturnToApp() {}
    fun resume() {}
    fun pause() {}
    fun destroy() {}
}
