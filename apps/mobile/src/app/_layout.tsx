import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfettiHost } from '@/components/confetti';
import { CelebrationHost, ToastHost, UndoHost } from '@/components/feedback';
import { initHaptics } from '@/lib/haptics';
import { initPrefs } from '@/lib/prefs';
import { queryClient } from '@/lib/queries';
import { SessionProvider } from '@/lib/session';
import { restoreCompare, restoreOnboarding } from '@/lib/stores';
import { useIsDark, usePalette } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const p = usePalette();
  const dark = useIsDark();
  const [ready, setReady] = useState(false);
  // Brand typeface (SIL OFL). If loading fails, the app still renders with system fonts.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    Promise.all([restoreOnboarding(), restoreCompare(), initHaptics(), initPrefs()]).finally(() => setReady(true));
  }, []);

  const appReady = ready && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (appReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [appReady]);

  const navTheme = {
    ...DefaultTheme,
    dark,
    colors: { ...DefaultTheme.colors, primary: p.primary, background: p.background, card: p.surface, text: p.ink, border: p.border },
  };

  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: p.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style={dark ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.background } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
                <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
                <Stack.Screen name="voice" options={{ presentation: 'modal' }} />
                <Stack.Screen name="review" options={{ presentation: 'modal' }} />
                <Stack.Screen name="label" options={{ presentation: 'modal' }} />
                <Stack.Screen name="product/[code]" />
                <Stack.Screen name="food/[id]" />
                <Stack.Screen name="additive/[code]" />
                <Stack.Screen name="entry/[id]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="compare" />
                <Stack.Screen name="progress" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="create/recipe" options={{ presentation: 'modal' }} />
                <Stack.Screen name="create/article" options={{ presentation: 'modal' }} />
                <Stack.Screen name="methodology" />
                <Stack.Screen name="recipe/[slug]" />
              </Stack>
              <UndoHost />
              <ToastHost />
              <CelebrationHost />
              <ConfettiHost />
            </ThemeProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
