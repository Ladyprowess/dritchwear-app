import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { toByteArray } from 'base64-js';
import { supabase } from '@/lib/supabase';

const BUCKET = 'portfolio-media';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024; // kept well under the bucket's 100MB cap - base64 read inflates size ~33% and large native reads are slow/memory heavy
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', '3gp', '3gpp', 'webm', 'mkv'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

export interface UploadedMedia {
  url: string;
  type: 'image' | 'video';
  posterUrl?: string;
}

const decode = (b64: string): Uint8Array => toByteArray(b64);

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

async function captureWebVideoFrame(uri: string): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const video = document.createElement('video');
    // Some browsers only reliably fire loadedmetadata/seeked for elements
    // attached to the document, so this stays in the DOM (hidden) instead
    // of floating detached, and is always cleaned up on settle.
    video.style.position = 'fixed';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let settled = false;
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.remove();
    };
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
      cleanup();
    };
    const timer = setTimeout(() => settle(() => reject(new Error('Timed out capturing a video frame'))), 8000);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.3, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) { settle(() => reject(new Error('Canvas not available'))); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      settle(() => resolve(dataUrl.split(',')[1]));
    };
    video.onerror = () => settle(() => reject(new Error('Video load failed')));

    document.body.appendChild(video);
    video.src = uri;
  });
}

async function captureNativeVideoFrame(uri: string): Promise<string> {
  const VideoThumbnails = await import('expo-video-thumbnails');
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out capturing a video frame')), 8000));
  const { uri: thumbUri } = await Promise.race([VideoThumbnails.getThumbnailAsync(uri, { time: 300, quality: 0.6 }), timeout]);
  return await readAssetBase64(thumbUri);
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

function extensionFromName(name?: string | null): string {
  const ext = name?.split('.').pop()?.toLowerCase();
  return ext && ext !== name?.toLowerCase() ? ext : '';
}

function isVideoAsset(asset: ImagePicker.ImagePickerAsset): boolean {
  const mime = asset.mimeType?.toLowerCase() || '';
  const ext = extensionFromName(asset.fileName);
  return asset.type === 'video' || mime.startsWith('video/') || VIDEO_EXTENSIONS.includes(ext);
}

function getVideoContentType(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType?.toLowerCase() || '';
  const ext = extensionFromName(asset.fileName);
  if (mime.startsWith('video/')) return mime;
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'm4v') return 'video/x-m4v';
  if (ext === '3gp' || ext === '3gpp') return 'video/3gpp';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mkv') return 'video/x-matroska';
  return 'video/mp4';
}

function getImageContentType(asset: ImagePicker.ImagePickerAsset): string {
  const mime = asset.mimeType?.toLowerCase() || '';
  const ext = extensionFromName(asset.fileName);
  if (mime.startsWith('image/')) return mime;
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return 'image/jpeg';
}

function extensionForContentType(contentType: string, fallbackName?: string | null): string {
  const ext = extensionFromName(fallbackName);
  if (VIDEO_EXTENSIONS.includes(ext) || IMAGE_EXTENSIONS.includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  if (contentType === 'video/quicktime') return 'mov';
  if (contentType === 'video/x-m4v') return 'm4v';
  if (contentType === 'video/3gpp') return '3gp';
  if (contentType === 'video/webm') return 'webm';
  if (contentType === 'video/x-matroska') return 'mkv';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/heic') return 'heic';
  if (contentType === 'image/heif') return 'heif';
  return contentType.startsWith('video/') ? 'mp4' : 'jpg';
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
    const isVideo = isVideoAsset(asset);
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
        contentType = getVideoContentType(asset);
        ext = extensionForContentType(contentType, asset.fileName);
        base64 = await readAssetBase64(asset.uri);
      } else {
        if (Platform.OS === 'web') {
          base64 = await downscaleWebImage(asset.uri, 1600, 0.82);
          contentType = 'image/jpeg';
        } else {
          base64 = await readAssetBase64(asset.uri);
          contentType = getImageContentType(asset);
        }
        ext = extensionForContentType(contentType, asset.fileName);
      }

      const filePath = `${pathPrefix}/${await uniqueName(ext)}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(filePath, decode(base64), {
        contentType,
        upsert: false,
      });
      if (error || !data) throw error || new Error('Upload failed');

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      if (!pub?.publicUrl) continue;

      let posterUrl: string | undefined;
      if (isVideo) {
        try {
          const posterBase64 = Platform.OS === 'web'
            ? await captureWebVideoFrame(asset.uri)
            : await captureNativeVideoFrame(asset.uri);
          const posterPath = `${pathPrefix}/${await uniqueName('jpg')}`;
          const { data: posterData } = await supabase.storage.from(BUCKET).upload(posterPath, decode(posterBase64), {
            contentType: 'image/jpeg',
            upsert: false,
          });
          if (posterData) {
            const { data: posterPub } = supabase.storage.from(BUCKET).getPublicUrl(posterData.path);
            posterUrl = posterPub?.publicUrl;
          }
        } catch {
          // Best effort - falls back to the play-icon placeholder if a frame couldn't be captured.
        }
      }

      uploaded.push({ url: pub.publicUrl, type: isVideo ? 'video' : 'image', ...(posterUrl ? { posterUrl } : {}) });
    } catch (err: any) {
      failures.push(`${asset.fileName || (isVideo ? 'Video' : 'Image')}: ${err?.message || 'upload failed'}`);
    }
  }

  if (failures.length > 0) {
    Alert.alert('Some files could not be uploaded', failures.join('\n'));
  }

  return uploaded;
}
