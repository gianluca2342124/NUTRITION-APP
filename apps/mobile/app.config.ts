import type { ExpoConfig } from 'expo/config';
import { brand } from '@repo/config/brand';

/**
 * Dynamic app config. Names, scheme and colours come from the central brand
 * file; store identifiers come from the environment so nothing is assumed to
 * be registered.
 */
const config: ExpoConfig = {
  name: brand.brandName,
  slug: brand.brandSlug,
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: brand.appScheme,
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: process.env.APP_IOS_BUNDLE_ID ?? brand.defaultIosBundleId,
    icon: './assets/app.icon',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'La cámara se usa para leer códigos de barras y fotografiar comidas o etiquetas.',
      NSMicrophoneUsageDescription: 'El micrófono se usa para que puedas dictar lo que has comido.',
      NSPhotoLibraryUsageDescription: 'Puedes elegir una foto de tu galería para analizar una comida o una etiqueta.',
    },
  },
  android: {
    package: process.env.APP_ANDROID_PACKAGE ?? brand.defaultAndroidPackage,
    adaptiveIcon: {
      backgroundColor: brand.primaryColor,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-sharing',
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.backgroundColor,
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
        dark: { backgroundColor: '#0A0F1E' },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'La cámara se usa para leer códigos de barras y fotografiar comidas o etiquetas.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Puedes elegir una foto de tu galería para analizar una comida o una etiqueta.' },
    ],
    ['expo-audio', { microphonePermission: 'El micrófono se usa para que puedas dictar lo que has comido.' }],
    'expo-localization',
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
};

export default config;
