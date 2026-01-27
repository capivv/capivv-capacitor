import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.capivv.example',
  appName: 'Capivv Example',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Capivv: {
      // Plugin configuration can go here
    }
  }
};

export default config;
