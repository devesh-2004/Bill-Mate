import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.devesh.billmate',
  appName: 'Bill Mate',
  webDir: 'public',
  server: {
    url: 'https://bill-mate-ten.vercel.app',
    cleartext: false,
  },
};

export default config;