import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Platform, Share } from 'react-native';
import { env } from './env';

/** Server-rendered 9:16 card with the product's real data (see /api/v1/share). */
export function productCardUrl(gtin: string): string {
  return `${env.apiUrl}/api/v1/share/product/${encodeURIComponent(gtin)}`;
}

/**
 * Downloads the card and opens the system share sheet with the image (so it
 * can go straight to TikTok, Instagram or Messages). On the web it opens the
 * image in a new tab.
 */
export async function shareProductCard(gtin: string, title: string): Promise<void> {
  const url = productCardUrl(gtin);
  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }
  const target = new File(Paths.cache, `fudyu-${gtin}.png`);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(url, target);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: title });
  } else {
    await Share.share({ url: file.uri, title });
  }
}
