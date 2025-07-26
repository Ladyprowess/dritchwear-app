import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dritchwear',
  slug: 'dritchwear',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  androidStatusBar: {
    barStyle: 'dark-content',
    backgroundColor: 'transparent',
    translucent: true,
  },
  androidNavigationBar: {
    visible: 'leanback',
    barStyle: 'dark-content',
    backgroundColor: 'transparent',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    compileSdkVersion: 35,
    targetSdkVersion: 35,
    minSdkVersion: 21,
    // Enable edge-to-edge for Android 15+
    enableEdgeToEdge: true,
  },
  web: {
    favicon: './assets/favicon.png',
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