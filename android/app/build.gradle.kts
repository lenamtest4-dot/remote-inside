import org.gradle.api.GradleException

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

fun readAppVersion(): String {
    val pkgFile = rootProject.file("../package.json")
    if (!pkgFile.exists()) {
        throw GradleException("Cannot find package.json at ${pkgFile.absolutePath}")
    }
    val text = pkgFile.readText(Charsets.UTF_8)
    val match = Regex(""""version"\s*:\s*"(\d+\.\d+\.\d+)"""").find(text)
        ?: throw GradleException("Cannot parse version from package.json")
    return match.groupValues[1]
}

fun computeVersionCode(versionName: String): Int {
    val parts = versionName.split(".").map { it.toIntOrNull() ?: 0 }
    val major = parts.getOrElse(0) { 0 }
    val minor = parts.getOrElse(1) { 0 }
    val patch = parts.getOrElse(2) { 0 }
    return major * 10000 + minor * 100 + patch
}

val appVersionName = readAppVersion()
val appVersionCode = computeVersionCode(appVersionName)
val keystorePath = System.getenv("RI_KEYSTORE_FILE")?.trim().orEmpty()
val keystoreFile = if (keystorePath.isNotEmpty()) file(keystorePath) else null
val hasReleaseSigning = keystoreFile != null && keystoreFile.exists()

android {
    namespace = "com.remoteinside.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.remoteinside.app"
        minSdk = 24
        targetSdk = 34
        versionCode = appVersionCode
        versionName = appVersionName
    }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = keystoreFile
                storePassword = System.getenv("RI_KEYSTORE_PASSWORD") ?: ""
                keyAlias = System.getenv("RI_KEY_ALIAS") ?: ""
                keyPassword = System.getenv("RI_KEY_PASSWORD") ?: ""
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        debug {
            isDebuggable = true
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
