import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

const BUCKET = 'portfolio-media';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // kept well under the bucket's 100MB cap - base64 read inflates size ~33% and large native reads are slow/memory heavy

export interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
}

const decode = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

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

async function readAssetBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  const FileSystem = await import('expo-file-system/legacy');
  return await (FileSystem as any).readAsStringAsync(uri, {
    encoding: (FileSystem as any).EncodingType.Base64,
  });
}

// Lets an admin pick several photos and/or videos at once and uploads each
// to the public portfolio-media bucket. Returns whatever succeeded - a
// failure on one file doesn't lose the others, matching the same
// best-effort pattern as pickAndUploadImage.
export async function pickAndUploadPortfolioMedia(pathPrefix: string): Promise<UploadedMedia[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.All,
    quality: 0.8,
    allowsMultipleSelection: true,
  });
  if (result.canceled || !result.assets?.length) return [];

  const uploaded: UploadedMedia[] = [];
  const failures: string[] = [];

  for (const asset of result.assets) {
    const isVideo = asset.type === 'video';
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

    if (asset.fileSize && asset.fileSize > maxBytes) {
      failures.push(`${asset.fileName || 'File'} is too large (max ${Math.round(maxBytes / (1024 * 1024))}MB)`);
      continue;
    }

    try {
      let base64: string;
      let contentType: string;
      let ext: string;

      if (isVideo) {
        contentType = asset.mimeType || 'video/mp4';
        ext = contentType.includes('quicktime') ? 'mov' : 'mp4';
        base64 = await readAssetBase64(asset.uri);
      } else {
        if (Platform.OS === 'web') {
          base64 = await downscaleWebImage(asset.uri, 1600, 0.82);
          contentType = 'image/jpeg';
        } else {
          base64 = await readAssetBase64(asset.uri);
          contentType = asset.mimeType || 'image/jpeg';
        }
        ext = contentType === 'image/png' ? 'png' : 'jpg';
      }

      const filePath = `${pathPrefix}/${await uniqueName(ext)}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(filePath, decode(base64), {
        contentType,
        upsert: false,
      });
      if (error || !data) throw error || new Error('Upload failed');

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      if (pub?.publicUrl) uploaded.push({ url: pub.publicUrl, type: isVideo ? 'video' : 'image' });
    } catch (err: any) {
      failures.push(`${asset.fileName || (isVideo ? 'Video' : 'Image')}: ${err?.message || 'upload failed'}`);
    }
  }

  if (failures.length > 0) {
    Alert.alert('Some files could not be uploaded', failures.join('\n'));
  }

  return uploaded;
}
