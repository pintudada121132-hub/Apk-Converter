package com.webapk.app

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdError
import com.google.android.gms.ads.AdListener
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.appopen.AppOpenAd
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform

/**
 * AdMob: banner, interstitial (every N page loads) and app-open ads.
 * Compiled only into apps that use ads (see src/noads for the empty version).
 */
class Ads(private val activity: Activity, private val cfg: AdsConfig) {

    private val handler = Handler(Looper.getMainLooper())
    private val createdAt = System.currentTimeMillis()
    private var sdkStarted = false

    private var bannerBox: FrameLayout? = null
    private var banner: AdView? = null

    private var interstitial: InterstitialAd? = null
    private var loadingInterstitial = false
    private var pageLoads = 0

    private var appOpen: AppOpenAd? = null
    private var appOpenLoadedAt = 0L
    private var loadingAppOpen = false
    private var showAppOpenOnLoad = true     // cold start: show the first app-open ad as soon as it is ready

    private var showingFullScreen = false
    private var lastFullScreen = 0L

    /** Strip that holds the banner, placed above or below the page. Null when there is no banner. */
    fun bannerView(): View? {
        if (!cfg.enabled || cfg.bannerId.isEmpty()) return null
        return FrameLayout(activity).also { bannerBox = it }
    }

    /** Asks for GDPR consent if switched on, then starts the SDK and loads the ads. */
    fun start() {
        if (!cfg.enabled) return
        if (!cfg.consent) { startSdk(); return }
        val info = UserMessagingPlatform.getConsentInformation(activity)
        info.requestConsentInfoUpdate(activity, ConsentRequestParameters.Builder().build(), {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity) { startSdk() }
        }, { startSdk() })
        if (info.canRequestAds()) startSdk()   // consent given in an earlier session
    }

    private fun startSdk() {
        if (sdkStarted || activity.isFinishing) return
        sdkStarted = true
        // Google recommends initializing off the main thread; ads are requested on it.
        Thread {
            MobileAds.initialize(activity) { }
            handler.post {
                if (activity.isFinishing || activity.isDestroyed) return@post
                loadBanner()
                loadInterstitial()
                loadAppOpen()
            }
        }.start()
    }

    // ---------------------------------------------------------------- banner

    private fun loadBanner() {
        val box = bannerBox ?: return
        val metrics = activity.resources.displayMetrics
        val widthDp = ((if (box.width > 0) box.width else metrics.widthPixels) / metrics.density).toInt()
        val ad = AdView(activity)
        ad.setAdUnitId(cfg.bannerId)
        ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, widthDp))
        ad.setAdListener(object : AdListener() {
            override fun onAdLoaded() { box.visibility = View.VISIBLE }
            override fun onAdFailedToLoad(error: LoadAdError) {
                box.visibility = View.GONE
                handler.postDelayed({ banner?.loadAd(AdRequest.Builder().build()) }, 60_000)
            }
        })
        box.addView(ad, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
        banner = ad
        ad.loadAd(AdRequest.Builder().build())
    }

    // ---------------------------------------------------------------- interstitial

    private fun loadInterstitial() {
        if (cfg.interstitialId.isEmpty() || interstitial != null || loadingInterstitial) return
        loadingInterstitial = true
        InterstitialAd.load(activity, cfg.interstitialId, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { loadingInterstitial = false; interstitial = ad }
            override fun onAdFailedToLoad(error: LoadAdError) {
                loadingInterstitial = false
                handler.postDelayed({ loadInterstitial() }, 60_000)
            }
        })
    }

    /** Called after every page load; shows an interstitial every [AdsConfig.interstitialEvery] pages. */
    fun onPageLoaded() {
        if (!sdkStarted || cfg.interstitialId.isEmpty()) return
        pageLoads++
        if (pageLoads < cfg.interstitialEvery || !canShowFullScreen(cfg.interstitialSeconds * 1000L)) return
        val ad = interstitial ?: run { loadInterstitial(); return }
        interstitial = null
        pageLoads = 0
        ad.setFullScreenContentCallback(fullScreenCallback { loadInterstitial() })
        showingFullScreen = true
        ad.show(activity)
    }

    // ---------------------------------------------------------------- app open

    private fun loadAppOpen() {
        if (cfg.appOpenId.isEmpty() || loadingAppOpen || (appOpen != null && !appOpenExpired())) return
        loadingAppOpen = true
        AppOpenAd.load(activity, cfg.appOpenId, AdRequest.Builder().build(), object : AppOpenAd.AppOpenAdLoadCallback() {
            override fun onAdLoaded(ad: AppOpenAd) {
                loadingAppOpen = false
                appOpen = ad
                appOpenLoadedAt = System.currentTimeMillis()
                // only right after launch: an ad popping up later, mid-page, would be annoying
                if (showAppOpenOnLoad && System.currentTimeMillis() - createdAt < 8_000) showAppOpen()
                showAppOpenOnLoad = false
            }
            override fun onAdFailedToLoad(error: LoadAdError) { loadingAppOpen = false; showAppOpenOnLoad = false }
        })
    }

    private fun appOpenExpired() = System.currentTimeMillis() - appOpenLoadedAt > 4 * 3600_000L

    /** The user came back to the app from another app or the home screen. */
    fun onReturnToApp() {
        if (!sdkStarted || cfg.appOpenId.isEmpty()) return
        if (!canShowFullScreen(30_000)) return
        showAppOpen()
    }

    private fun showAppOpen() {
        val ad = appOpen?.takeIf { !appOpenExpired() } ?: run { appOpen = null; loadAppOpen(); return }
        if (showingFullScreen || activity.isFinishing) return
        appOpen = null
        ad.setFullScreenContentCallback(fullScreenCallback { loadAppOpen() })
        showingFullScreen = true
        ad.show(activity)
    }

    // ---------------------------------------------------------------- shared

    private fun canShowFullScreen(minGapMs: Long) =
        !showingFullScreen && System.currentTimeMillis() - lastFullScreen >= minGapMs

    private fun fullScreenCallback(loadNext: () -> Unit) = object : FullScreenContentCallback() {
        override fun onAdDismissedFullScreenContent() { done() }
        override fun onAdFailedToShowFullScreenContent(error: AdError) { done() }
        private fun done() {
            showingFullScreen = false
            lastFullScreen = System.currentTimeMillis()
            loadNext()
        }
    }

    fun resume() { banner?.resume() }
    fun pause() { banner?.pause() }
    fun destroy() { handler.removeCallbacksAndMessages(null); banner?.destroy() }
}
