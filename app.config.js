import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dritchwear',
  slug: 'dritch-wear',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  androidStatusBar: {
    barStyle: 'dark-content',
    backgroundColor: '#000000', // ✅ must be a valid hex color
    translucent: true,
  },
  androidNavigationBar: {
    visible: 'leanback',
    barStyle: 'dark-content',
    backgroundColor: '#000000', // ✅ must be a valid hex color
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    // ✅ Removed invalid fields
  },
  web: {
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          minSdkVersion: 21,
          enableEdgeToEdge: true,
        },
      },
    ],
  ],
});
