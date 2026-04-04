package com.tcardio.wrapper;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.telephony.TelephonyManager;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.JavascriptInterface;
import android.net.http.SslError;
import android.app.DownloadManager;
import android.webkit.URLUtil;
import android.widget.LinearLayout;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;


import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "TCardio";
    private static final String BASE_URL = "https://t-cardio.org";
    private static final int PERMISSION_REQUEST_CODE = 100;
    private static final int CAMERA_PERMISSION_REQUEST = 101;
    private static final int FILE_CHOOSER_REQUEST = 200;

    private WebView webView;
    private LinearLayout loadingOverlay;
    private SwipeRefreshLayout swipeRefresh;

    // Pending USSD call to execute after permission is granted
    private String pendingUssdCode = null;

    // File chooser callback for camera/gallery
    private ValueCallback<Uri[]> fileUploadCallback;
    private Uri cameraPhotoUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        loadingOverlay = findViewById(R.id.loadingOverlay);
        swipeRefresh = findViewById(R.id.swipeRefresh);

        // Request permissions on startup
        requestRequiredPermissions();

        setupWebView();
        setupSwipeRefresh();

        webView.loadUrl(BASE_URL);
    }

    private void requestRequiredPermissions() {
        List<String> permissionsNeeded = new ArrayList<>();

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
                != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CALL_PHONE);
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
                != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.READ_PHONE_STATE);
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.CAMERA);
        }

        if (!permissionsNeeded.isEmpty()) {
            ActivityCompat.requestPermissions(this,
                    permissionsNeeded.toArray(new String[0]),
                    PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == PERMISSION_REQUEST_CODE) {
            boolean callGranted = false;
            for (int i = 0; i < permissions.length; i++) {
                if (permissions[i].equals(Manifest.permission.CALL_PHONE)
                        && grantResults[i] == PackageManager.PERMISSION_GRANTED) {
                    callGranted = true;
                }
            }

            // If we have a pending call and permission was just granted, execute it
            if (callGranted && pendingUssdCode != null) {
                executeSilentCall(pendingUssdCode);
                pendingUssdCode = null;
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " TCardioApp/1.0");
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setDatabaseEnabled(true);

        // Enable cookies
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Add JavaScript bridge for SIM detection
        webView.addJavascriptInterface(new TCardioJsBridge(), "TCardioNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                // Intercept tel: links — launch call SILENTLY
                if (url.startsWith("tel:")) {
                    String phoneNumber = url.substring(4);
                    // Decode the URI component
                    try {
                        phoneNumber = Uri.decode(phoneNumber);
                    } catch (Exception e) {
                        Log.e(TAG, "Error decoding tel URI", e);
                    }

                    Log.d(TAG, "Intercepted tel: link, launching silent call");
                    handleSilentCall(phoneNumber);
                    return true;
                }

                // Allow navigation within our domain
                if (url.startsWith(BASE_URL) || url.startsWith("https://t-cardio.org")) {
                    return false;
                }

                // Open external links in browser
                Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                loadingOverlay.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);

                // Inject SIM detection info into the page
                injectSimInfo();

                // Inject blob download interceptor for PDF files
                injectBlobDownloadInterceptor();
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Accept SSL for our domain (Let's Encrypt certs)
                String url = error.getUrl();
                if (url != null && (url.contains("t-cardio.org") || url.contains("tibla.terrano-hosting.com"))) {
                    Log.w(TAG, "SSL error on our domain, proceeding: " + error.getPrimaryError());
                    handler.proceed();
                } else {
                    super.onReceivedSslError(view, handler, error);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    Log.e(TAG, "Page load error: " + error.getDescription());
                    loadingOverlay.setVisibility(View.GONE);
                    view.loadUrl("file:///android_asset/maintenance.html");
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback,
                                             FileChooserParams fileChooserParams) {
                // Cancel any existing callback
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                // Determine if camera capture is requested
                boolean captureEnabled = false;
                String[] acceptTypes = fileChooserParams.getAcceptTypes();
                if (fileChooserParams.isCaptureEnabled()) {
                    captureEnabled = true;
                }

                // Build camera intent
                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                    File photoFile = createImageFile();
                    if (photoFile != null) {
                        cameraPhotoUri = FileProvider.getUriForFile(
                                MainActivity.this,
                                getApplicationContext().getPackageName() + ".fileprovider",
                                photoFile);
                        cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                        cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    }
                }

                // If capture is explicitly requested (capture="environment"), open camera directly
                if (captureEnabled && cameraPhotoUri != null) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                    } else {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
                    }
                    return true;
                }

                // Build gallery intent
                Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
                galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
                galleryIntent.setType("image/*");

                // Create chooser with both camera and gallery options
                Intent chooserIntent = Intent.createChooser(galleryIntent, "Choisir une source");
                if (cameraPhotoUri != null) {
                    chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                }

                startActivityForResult(chooserIntent, FILE_CHOOSER_REQUEST);
                return true;
            }
        });

        // ─── Download handler for PDF reports and files ───
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

                // Extract filename from content disposition or URL
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                if (fileName == null || fileName.isEmpty()) {
                    fileName = "T-Cardio-Rapport.pdf";
                }

                // Pass cookies for authenticated downloads
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) {
                    request.addRequestHeader("Cookie", cookies);
                }

                // Pass auth token from WebView localStorage
                request.addRequestHeader("User-Agent", userAgent);

                request.setTitle(fileName);
                request.setDescription("Telechargement T-Cardio Pro");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                request.setMimeType(mimeType);

                DownloadManager downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                if (downloadManager != null) {
                    downloadManager.enqueue(request);
                    Toast.makeText(MainActivity.this, "Telechargement en cours: " + fileName, Toast.LENGTH_SHORT).show();
                    Log.d(TAG, "Download started: " + fileName + " (" + mimeType + ")");
                }
            } catch (Exception e) {
                Log.e(TAG, "Download error", e);
                // Fallback: open in browser
                try {
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(browserIntent);
                } catch (Exception ex) {
                    Toast.makeText(MainActivity.this, "Impossible de telecharger le fichier", Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    /**
     * Create a temporary image file for camera capture
     */
    private File createImageFile() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            String fileName = "TENSIOMETRE_" + timeStamp;
            File storageDir = getExternalCacheDir();
            return File.createTempFile(fileName, ".jpg", storageDir);
        } catch (IOException e) {
            Log.e(TAG, "Error creating image file", e);
            return null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback == null) return;

            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data != null && data.getData() != null) {
                    // Gallery selection
                    results = new Uri[]{data.getData()};
                } else if (cameraPhotoUri != null) {
                    // Camera capture
                    results = new Uri[]{cameraPhotoUri};
                }
            }

            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
        }
    }

    private void setupSwipeRefresh() {
        // DISABLED: SwipeRefreshLayout is completely disabled for stability.
        // Medical app — accidental page refreshes lose patient data (measurements, forms).
        // Users can refresh via in-app navigation if needed.
        swipeRefresh.setEnabled(false);
    }

    /**
     * Handle a silent USSD/phone call — no dialer shown to user
     */
    private void handleSilentCall(String phoneNumber) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED) {
            executeSilentCall(phoneNumber);
        } else {
            // Store the pending call and request permission
            pendingUssdCode = phoneNumber;
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CALL_PHONE},
                    PERMISSION_REQUEST_CODE);
        }
    }

    /**
     * Execute the call silently using ACTION_CALL (not ACTION_DIAL)
     * ACTION_CALL = direct call, no dialer shown
     * ACTION_DIAL = opens the dialer with the number (what tel: does in browser)
     */
    @SuppressLint("MissingPermission")
    private void executeSilentCall(String phoneNumber) {
        try {
            Log.d(TAG, "Executing silent USSD call");

            Intent callIntent = new Intent(Intent.ACTION_CALL);
            callIntent.setData(Uri.parse("tel:" + Uri.encode(phoneNumber)));

            // Try to select MTN SIM if dual SIM
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                int mtnSimSlot = findMtnSimSlot();
                if (mtnSimSlot >= 0) {
                    Log.d(TAG, "Using MTN SIM at slot " + mtnSimSlot);
                    // Set the SIM subscription for the call
                    try {
                        SubscriptionManager subManager = getSystemService(SubscriptionManager.class);
                        if (subManager != null) {
                            List<SubscriptionInfo> subs = subManager.getActiveSubscriptionInfoList();
                            if (subs != null && mtnSimSlot < subs.size()) {
                                int subId = subs.get(mtnSimSlot).getSubscriptionId();
                                callIntent.putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE",
                                        getPhoneAccountHandle(subId));
                            }
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Could not set SIM preference", e);
                    }
                }
            }

            startActivity(callIntent);

            // Notify the web page that the call was launched
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                    "if(window.__onUssdCallLaunched) window.__onUssdCallLaunched(true);",
                    null
                );
            });

        } catch (Exception e) {
            Log.e(TAG, "Error launching silent call", e);
            Toast.makeText(this, "Erreur lors du lancement du paiement", Toast.LENGTH_SHORT).show();

            // Notify failure
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                    "if(window.__onUssdCallLaunched) window.__onUssdCallLaunched(false);",
                    null
                );
            });
        }
    }

    /**
     * Find the SIM slot that belongs to MTN
     * Returns -1 if not found or no permission
     */
    @SuppressLint("MissingPermission")
    private int findMtnSimSlot() {
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_PHONE_STATE)
                    != PackageManager.PERMISSION_GRANTED) {
                return -1;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                SubscriptionManager subManager = getSystemService(SubscriptionManager.class);
                if (subManager == null) return -1;

                List<SubscriptionInfo> subs = subManager.getActiveSubscriptionInfoList();
                if (subs == null) return -1;

                for (int i = 0; i < subs.size(); i++) {
                    SubscriptionInfo info = subs.get(i);
                    String carrierName = "";
                    if (info.getCarrierName() != null) {
                        carrierName = info.getCarrierName().toString().toUpperCase();
                    }
                    String displayName = "";
                    if (info.getDisplayName() != null) {
                        displayName = info.getDisplayName().toString().toUpperCase();
                    }

                    // Check for MTN in carrier name or display name
                    if (carrierName.contains("MTN") || displayName.contains("MTN")
                            || carrierName.contains("AREEBA") || carrierName.contains("SCANCOM")) {
                        return info.getSimSlotIndex();
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error detecting MTN SIM", e);
        }
        return -1;
    }

    /**
     * Get PhoneAccountHandle for a specific subscription ID
     */
    private android.telecom.PhoneAccountHandle getPhoneAccountHandle(int subId) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.telecom.TelecomManager telecomManager =
                        (android.telecom.TelecomManager) getSystemService(TELECOM_SERVICE);
                if (telecomManager != null) {
                    List<android.telecom.PhoneAccountHandle> accounts =
                            telecomManager.getCallCapablePhoneAccounts();
                    for (android.telecom.PhoneAccountHandle account : accounts) {
                        // Match by subscription ID in the account ID
                        if (account.getId().contains(String.valueOf(subId))) {
                            return account;
                        }
                    }
                    // If we can't match, return the first one as fallback
                    if (!accounts.isEmpty()) {
                        return accounts.get(0);
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error getting PhoneAccountHandle", e);
        }
        return null;
    }

    /**
     * Inject SIM detection information into the web page
     * The web page can use window.TCardioNative.getMtnSimInfo()
     */
    private void injectSimInfo() {
        runOnUiThread(() -> {
            webView.evaluateJavascript(
                "window.__isNativeApp = true; " +
                "window.__appVersion = '1.0.0';",
                null
            );
        });
    }

    /**
     * Intercept blob/data URL downloads in JavaScript and route them
     * through the native bridge for saving to Downloads folder.
     * This is needed because WebView's DownloadListener doesn't handle blob: URLs.
     */
    private void injectBlobDownloadInterceptor() {
        String js = "(function() {" +
            "if (window.__blobInterceptorInstalled) return;" +
            "window.__blobInterceptorInstalled = true;" +

            // Override the <a>.click() download pattern used by the frontend
            "var origCreateElement = document.createElement.bind(document);" +
            "var origCreateObjectURL = URL.createObjectURL;" +

            // Intercept URL.createObjectURL to track blob-to-url mapping
            "var blobMap = new Map();" +
            "URL.createObjectURL = function(blob) {" +
            "  var url = origCreateObjectURL.call(URL, blob);" +
            "  if (blob && blob.type && blob.type.indexOf('pdf') !== -1) {" +
            "    blobMap.set(url, blob);" +
            "  }" +
            "  return url;" +
            "};" +

            // Override HTMLAnchorElement click to intercept PDF downloads
            "var origClick = HTMLAnchorElement.prototype.click;" +
            "HTMLAnchorElement.prototype.click = function() {" +
            "  var href = this.href || '';" +
            "  var download = this.download || '';" +
            "  if (download && (download.endsWith('.pdf') || href.startsWith('blob:') || href.startsWith('data:application/pdf'))) {" +
            "    console.log('TCardio: intercepting PDF download: ' + download);" +

            // Handle blob: URLs
            "    if (href.startsWith('blob:') && blobMap.has(href)) {" +
            "      var blob = blobMap.get(href);" +
            "      var reader = new FileReader();" +
            "      reader.onloadend = function() {" +
            "        window.TCardioNative.saveBase64PDF(reader.result, download);" +
            "      };" +
            "      reader.readAsDataURL(blob);" +
            "      return;" +
            "    }" +

            // Handle data: URLs (base64 PDF)
            "    if (href.startsWith('data:')) {" +
            "      window.TCardioNative.saveBase64PDF(href, download);" +
            "      return;" +
            "    }" +
            "  }" +
            "  return origClick.call(this);" +
            "};" +

            "console.log('TCardio: blob download interceptor installed');" +
            "})();";

        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    /**
     * JavaScript bridge — accessible from web page as window.TCardioNative
     */
    public class TCardioJsBridge {

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.0";
        }

        @JavascriptInterface
        public boolean hasCallPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this,
                    Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestCallPermission() {
            runOnUiThread(() -> {
                ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.CALL_PHONE},
                        PERMISSION_REQUEST_CODE);
            });
        }

        /**
         * Launch a silent USSD call from JavaScript
         * Usage: window.TCardioNative.silentCall("*880*1*1*...*PIN#")
         */
        @JavascriptInterface
        public void silentCall(String ussdCode) {
            Log.d(TAG, "silentCall called from JS");
            runOnUiThread(() -> handleSilentCall(ussdCode));
        }

        /**
         * Get MTN SIM info as JSON
         * Returns: {"found": true, "slot": 0, "carrierName": "MTN"}
         */
        @JavascriptInterface
        public String getMtnSimInfo() {
            try {
                int slot = findMtnSimSlot();
                if (slot >= 0) {
                    return "{\"found\":true,\"slot\":" + slot + "}";
                }
            } catch (Exception e) {
                Log.w(TAG, "Error in getMtnSimInfo", e);
            }
            return "{\"found\":false,\"slot\":-1}";
        }

        /**
         * Force clear all WebView data and reload — fixes stuck sessions
         * Usage: window.TCardioNative.clearAndReload()
         */
        @JavascriptInterface
        public void clearAndReload() {
            Log.d(TAG, "clearAndReload called from JS");
            runOnUiThread(() -> {
                webView.clearCache(true);
                webView.clearHistory();
                android.webkit.WebStorage.getInstance().deleteAllData();
                CookieManager.getInstance().removeAllCookies(null);
                CookieManager.getInstance().flush();
                webView.loadUrl(BASE_URL);
            });
        }

        /**
         * Get number of active SIMs
         */
        /**
         * Save a base64-encoded PDF to Downloads folder
         * Called from JS when blob download is intercepted
         */
        @JavascriptInterface
        public void saveBase64PDF(String base64Data, String fileName) {
            Log.d(TAG, "saveBase64PDF called: " + fileName);
            try {
                // Remove data URI prefix if present
                String cleanBase64 = base64Data;
                if (cleanBase64.contains(",")) {
                    cleanBase64 = cleanBase64.substring(cleanBase64.indexOf(",") + 1);
                }

                byte[] pdfBytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT);

                if (fileName == null || fileName.isEmpty()) {
                    fileName = "T-Cardio-Rapport-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.getDefault()).format(new Date()) + ".pdf";
                }

                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File outputFile = new File(downloadsDir, fileName);
                FileOutputStream fos = new FileOutputStream(outputFile);
                fos.write(pdfBytes);
                fos.close();

                // Notify media scanner so file appears in Downloads
                Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                scanIntent.setData(Uri.fromFile(outputFile));
                sendBroadcast(scanIntent);

                final String finalFileName = fileName;
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "PDF enregistre dans Telechargements: " + finalFileName,
                        Toast.LENGTH_LONG).show());

                Log.d(TAG, "PDF saved: " + outputFile.getAbsolutePath() + " (" + pdfBytes.length + " bytes)");
            } catch (Exception e) {
                Log.e(TAG, "Error saving PDF", e);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Erreur lors de l'enregistrement du PDF",
                        Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public int getSimCount() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED) {
                        SubscriptionManager subManager = getSystemService(SubscriptionManager.class);
                        if (subManager != null) {
                            List<SubscriptionInfo> subs = subManager.getActiveSubscriptionInfoList();
                            return subs != null ? subs.size() : 0;
                        }
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "Error getting SIM count", e);
            }
            return 0;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
