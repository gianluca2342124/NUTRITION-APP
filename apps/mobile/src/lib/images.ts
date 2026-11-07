import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Downscales a photo before upload: enough detail for food/label analysis,
 * far smaller payloads (faster on slow connections, less data shared).
 */
export async function prepareImage(uri: string, size: { width: number; height: number }, maxSide = 1600) {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(size.width, size.height) > maxSide) {
    ctx.resize(size.width >= size.height ? { width: maxSide } : { height: maxSide });
  }
  const ref = await ctx.renderAsync();
  const saved = await ref.saveAsync({ compress: 0.72, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Multipart body with one file field, for native (file URI) and web (blob). */
export async function fileForm(field: string, uri: string, name: string, type: string): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob, name);
  } else {
    // React Native's FormData accepts { uri, name, type } descriptors.
    form.append(field, { uri, name, type } as unknown as Blob);
  }
  return form;
}
