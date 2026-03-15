# Keep JavaScript interface methods
-keepclassmembers class com.tcardio.wrapper.MainActivity$TCardioJsBridge {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.tcardio.wrapper.** { *; }
