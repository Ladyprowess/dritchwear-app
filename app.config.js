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
    backgroundColor: '#000000',
    translucent: true,
  },
  androidNavigationBar: {
    visible: 'leanback',
    barStyle: 'dark-content',
    backgroundColor: '#000000',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.dritchwear.app',           // ✅ required for EAS builds
    versionCode: 7,                          // ✅ increment this for each new build
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: ['NOTIFICATIONS', 'READ_MEDIA_IMAGES'],
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
          minSdkVersion: 24,
          enableEdgeToEdge: true,
        },
      },
    ],
  ],
});
