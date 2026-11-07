import { resolveLocale, type Locale } from '@repo/config';
import { en } from './en';
import { es } from './es';
import type { Messages } from './types';

export type { Messages } from './types';
export type { Locale } from '@repo/config';

const catalogs: Record<Locale, Messages> = { es, en };

export function messages(locale: string | null | undefined): Messages {
  return catalogs[resolveLocale(locale)];
}

/** Replaces {placeholders} in a message. Unknown placeholders are kept. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}
