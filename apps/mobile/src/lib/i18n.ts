import { getLocales } from 'expo-localization';
import { resolveLocale, type Locale } from '@repo/config';
import { format, messages, type Messages } from '@repo/i18n';

const deviceLocale: Locale = resolveLocale(getLocales()[0]?.languageCode ?? 'es');
let active: Locale = deviceLocale;

export function currentLocale(): Locale {
  return active;
}

export function setLocale(locale: Locale): void {
  active = locale;
}

/** Messages for the active locale plus an interpolation helper. */
export function useT(): { t: Messages; locale: Locale; f: typeof format } {
  return { t: messages(active), locale: active, f: format };
}
