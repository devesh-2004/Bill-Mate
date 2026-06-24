import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.devesh.billmate',
  appName: 'Bill Mate',
  webDir: 'public',
  server: {
    url: 'https://bill-mate-ten.vercel.app',
    cleartext: false,
  },
  plugins: {
    // The app loads a remote URL, so after the native launch screen there is a
    // short network gap while the web app loads. Without this the gap shows as a
    // blank (black in dark mode) screen. SplashScreen keeps the branded launch
    // image (the same Splash image set, light + dark) visible across that gap.
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#ffffffff',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;