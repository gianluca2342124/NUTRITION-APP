import 'server-only';
import { createHash } from 'node:crypto';
import type { ImageInput } from '@repo/ai';
import { ApiFailure } from './http';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function sniffImage(bytes: Uint8Array): ImageInput['mediaType'] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export interface UploadedImage extends ImageInput {
  sha256: string;
  bytes: number;
}

/** Reads and validates an uploaded image by content (not by declared type). */
export async function readImage(form: FormData, field = 'image'): Promise<UploadedImage> {
  const file = form.get(field);
  if (!(file instanceof Blob)) throw new ApiFailure(400, 'invalid_input', `Missing "${field}" file.`);
  if (file.size > MAX_IMAGE_BYTES) throw new ApiFailure(413, 'payload_too_large', 'Image is larger than 8 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) throw new ApiFailure(400, 'invalid_input', 'Unsupported image format. Use JPEG, PNG or WebP.');
  return {
    mediaType,
    data: Buffer.from(bytes).toString('base64'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.byteLength,
  };
}

export async function readAudio(form: FormData, field = 'audio'): Promise<{ blob: Blob; filename: string }> {
  const file = form.get(field);
  if (!(file instanceof Blob)) throw new ApiFailure(400, 'invalid_input', `Missing "${field}" file.`);
  if (file.size === 0) throw new ApiFailure(400, 'invalid_input', 'Empty recording.');
  if (file.size > MAX_AUDIO_BYTES) throw new ApiFailure(413, 'payload_too_large', 'Recording is too long.');
  const name = file instanceof File && file.name ? file.name : 'recording.m4a';
  return { blob: file, filename: name.replace(/[^\w.-]/g, '_').slice(0, 60) };
}

export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new ApiFailure(400, 'invalid_input', 'Expected multipart/form-data.');
  }
}
