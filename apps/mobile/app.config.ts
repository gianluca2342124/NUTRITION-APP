import type { ExpoConfig } from 'expo/config';
import { brand } from '@repo/config/brand';

const CAMERA = 'La cámara se usa para leer códigos de barras y fotografiar comidas o etiquetas.';
const MICROPHONE = 'El micrófono se usa para que puedas dictar lo que has comido.';
const PHOTOS = 'Puedes elegir fotos de tu galería para analizar comidas o etiquetas, y para tu perfil o tus recetas.';

/** A development build that talks to a backend on the local network (plain http). */
const localBackend = /^http:\/\//.test(process.env.EXPO_PUBLIC_API_URL ?? '');

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
      NSCameraUsageDescription: CAMERA,
      NSMicrophoneUsageDescription: MICROPHONE,
      NSPhotoLibraryUsageDescription: PHOTOS,
      // Only for development builds that reach a backend on your computer.
      ...(localBackend ? { NSLocalNetworkUsageDescription: 'En desarrollo, Fudyu se conecta a tu ordenador por la red local.' } : {}),
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
      // The camera plugin removes the microphone string when this is false, and
      // voice dictation (expo-audio) needs it: keep the same text here.
      { cameraPermission: CAMERA, microphonePermission: MICROPHONE, recordAudioAndroid: false },
    ],
    [
      'expo-image-picker',
      { photosPermission: PHOTOS },
    ],
    ['expo-audio', { microphonePermission: MICROPHONE }],
    'expo-localization',
    'expo-secure-store',
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
};

export default config;
