import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  name: 'Dritchwear',
  slug: 'dritchwear',
  version: '1.0.0',
  orientation: 'default',

  icon: './assets/images/icon.png',

  scheme: 'dritchwear',

  userInterfaceStyle: 'light',

  splash: {
    image: './assets/images/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },

  androidStatusBar: {
    barStyle: 'dark-content',
    backgroundColor: '#F9FAFB',
    translucent: false,
  },

  androidNavigationBar: {
    visible: 'visible',
    barStyle: 'dark-content',
    backgroundColor: '#F9FAFB',
  },


  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.dritchwear.app',
  },

  android: {
    package: 'com.dritchwear.app',
    googleServicesFile: './google-services.json',
    softwareKeyboardLayoutMode: 'resize',
    versionCode: 155,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },
    permissions: [
      'READ_MEDIA_AUDIO',
      'WRITE_EXTERNAL_STORAGE',
      'READ_EXTERNAL_STORAGE',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
    ],
  },

  web: {
    bundler: 'metro',
    favicon: './assets/images/favicon.png',
    name: 'Dritchwear',
    shortName: 'Dritchwear',
    description: 'Shop premium custom clothing from Dritchwear Collections.',
    themeColor: '#5A2D82',
    backgroundColor: '#F9FAFB',
    display: 'standalone',
    orientation: 'default',
    lang: 'en',
    startUrl: '/',
  },

  extra: {
    ...(config.extra ?? {}),
    posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
    posthogHost: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
  },

});
