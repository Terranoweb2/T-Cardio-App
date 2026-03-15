import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tcardio.patient',
  appName: 'T-Cardio Patient',
  webDir: 'out',
  server: {
    url: 'https://t-cardio.org',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // Keep WebView running in background for call notifications
    backgroundColor: '#1e1b4b',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1e1b4b',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1e1b4b',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#22d3ee',
      sound: 'notification_message.mp3',
    },
  },
};

export default config;
