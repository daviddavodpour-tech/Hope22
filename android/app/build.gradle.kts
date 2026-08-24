plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.hope.marketplace"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.hope.marketplace"
        minSdk = 30
        targetSdk = 36
        versionCode = 5
        versionName = "3.5.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("ANDROID_RELEASE_STORE_FILE")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("ANDROID_RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            // Never silently ship a debug-signed release artifact. CI can
            // inject a real keystore through the ANDROID_RELEASE_* env vars.
            val releaseStore = System.getenv("ANDROID_RELEASE_STORE_FILE")
            signingConfig = if (!releaseStore.isNullOrBlank()) signingConfigs.getByName("release") else null
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}
