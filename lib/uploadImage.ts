import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

// Reuses the existing public assets bucket so no new storage setup is needed.
const BUCKET = 'custom-order-assets';

const decode = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

// Web: draw the picked image to a canvas capped at maxDim and re-encode as JPEG.
// Shrinks a multi-MB phone photo to ~100–300KB before upload. Returns base64.
async function downscaleWebImage(uri: string, maxDim: number, quality: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new (window as any).Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = uri;
  });
  const longest = Math.max(img.width, img.height) || maxDim;
  const scale = Math.min(1, maxDim / longest);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

async function uniqueName(ext: string): Promise<string> {
  try {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Date.now().toString() + Math.random().toString()
    );
    return `${hash.slice(0, 16)}.${ext}`;
  } catch {
    return `${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`;
  }
}

// Pick one image from the library and upload it. Returns the public URL, or
// null when the user cancels or it fails (a friendly alert is shown on failure).
// Works on web (FileReader) and native (expo-file-system, lazily loaded).
export async function pickAndUploadImage(pathPrefix: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
    Alert.alert('Image too large', 'Please choose an image under 12MB.');
    return null;
  }
  if (asset.mimeType && !['image/jpeg', 'image/png', 'image/jpg'].includes(asset.mimeType)) {
    Alert.alert('Invalid format', 'Only JPG or PNG images are allowed.');
    return null;
  }

  // Read the image; on web downscale to keep stored files small (fast loads).
  let base64: string;
  let contentType = asset.mimeType || 'image/jpeg';
  try {
    if (Platform.OS === 'web') {
      base64 = await downscaleWebImage(asset.uri, 1280, 0.72);
      contentType = 'image/jpeg';
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      base64 = await (FileSystem as any).readAsStringAsync(asset.uri, {
        encoding: (FileSystem as any).EncodingType.Base64,
      });
    }
  } catch {
    Alert.alert('Could not read image', 'Please try another image.');
    return null;
  }

  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const filePath = `${pathPrefix}/${await uniqueName(ext)}`;

  const { data, error } = await supabase.storage.from(BUCKET).upload(filePath, decode(base64), {
    contentType,
    upsert: false,
  });
  if (error || !data) {
    Alert.alert('Upload failed', error?.message || 'Please try again.');
    return null;
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub?.publicUrl ?? null;
}
