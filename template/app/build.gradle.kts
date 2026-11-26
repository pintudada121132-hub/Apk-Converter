plugins {
    id("com.android.application")
}

fun prop(key: String, def: String): String = (project.findProperty(key) as String?)?.takeIf { it.isNotBlank() } ?: def

android {
    namespace = "com.webapk.app"
    compileSdk = 35

    defaultConfig {
        applicationId = prop("webapk.appId", "com.webapk.app")
        minSdk = 26
        targetSdk = 35
        versionCode = prop("webapk.versionCode", "1").toInt()
        versionName = prop("webapk.versionName", "1.0")
    }

    signingConfigs {
        create("release") {
            val store = prop("webapk.storeFile", "")
            if (store.isNotEmpty()) {
                storeFile = file(store)
                storePassword = prop("webapk.storePassword", "")
                keyAlias = prop("webapk.keyAlias", "webapk")
                keyPassword = prop("webapk.keyPassword", "")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = if (prop("webapk.storeFile", "").isNotEmpty())
                signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
