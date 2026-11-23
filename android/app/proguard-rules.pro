# Keep JS bridge interface methods intact
-keepclassmembers class com.remoteinside.app.MainActivity$NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
