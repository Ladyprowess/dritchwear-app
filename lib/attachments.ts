import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';

const BUCKET = 'support-attachments';
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILES = 5;

const ALLOWED_MIME = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'text/csv',
  'text/plain',
];

export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface UploadedAttachment {
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  signedUrl?: string;
}

export function isImage(mime: string): boolean {
  return mime.startsWith('image/');
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateFile(f: PickedFile): string | null {
  if (f.size > MAX_FILE_BYTES) return `${f.name} is over 10MB.`;
  const mime = (f.mimeType || '').toLowerCase();
  if (mime && !ALLOWED_MIME.includes(mime)) return `${f.name} is not a supported file type.`;
  return null;
}

function extFromName(name: string, mime: string): string {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (fromName) return fromName;
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'txt';
  if (mime === 'text/csv') return 'csv';
  if (mime.includes('spreadsheet') || mime === 'application/vnd.ms-excel') return 'xlsx';
  if (mime.includes('word')) return 'docx';
  if (mime.startsWith('image/')) return mime.split('/')[1];
  return 'bin';
}

// ── Pickers ───────────────────────────────────────────────────────────────────
export async function pickImagesFromLibrary(): Promise<PickedFile[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: MAX_FILES,
    quality: 0.8,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({
    uri: a.uri,
    name: a.fileName || `photo.${(a.mimeType || 'image/jpeg').split('/')[1]}`,
    size: a.fileSize || 0,
    mimeType: a.mimeType || 'image/jpeg',
  }));
}

export async function takePhoto(): Promise<PickedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return [];
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (res.canceled) return [];
  const a = res.assets[0];
  return [{ uri: a.uri, name: a.fileName || 'photo.jpg', size: a.fileSize || 0, mimeType: a.mimeType || 'image/jpeg' }];
}

export async function pickDocuments(): Promise<PickedFile[]> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: [
      'image/*', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
      'text/csv', 'text/plain',
    ],
  });
  if (res.canceled) return [];
  return (res.assets || []).map((a) => ({
    uri: a.uri,
    name: a.name || 'file',
    size: a.size || 0,
    mimeType: a.mimeType || 'application/octet-stream',
  }));
}

// ── Upload ────────────────────────────────────────────────────────────────────
async function readBytes(file: PickedFile): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const resp = await fetch(file.uri);
    const buf = await resp.arrayBuffer();
    return new Uint8Array(buf);
  }
  const FileSystem = await import('expo-file-system/legacy');
  const b64 = await (FileSystem as any).readAsStringAsync(file.uri, { encoding: (FileSystem as any).EncodingType.Base64 });
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uid(): Promise<string> {
  try {
    const h = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, Date.now() + '' + Math.random());
    return h.slice(0, 20);
  } catch {
    return `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  }
}

// Uploads one file to the private bucket under the user's folder. Throws on failure.
export async function uploadAttachment(userId: string, file: PickedFile): Promise<UploadedAttachment> {
  const bytes = await readBytes(file);
  const ext = extFromName(file.name, file.mimeType);
  const path = `${userId}/${await uid()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.mimeType || 'application/octet-stream',
    upsert: false,
  });
  if (error || !data) throw error || new Error('Upload failed');
  return {
    file_name: file.name,
    file_size: file.size || bytes.byteLength,
    mime_type: file.mimeType || 'application/octet-stream',
    storage_path: data.path,
  };
}

// Creates short-lived signed URLs for a set of storage paths.
export async function signAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  const map: Record<string, string> = {};
  (data || []).forEach((d) => { if (d.signedUrl && d.path) map[d.path] = d.signedUrl; });
  return map;
}

// Loads attachments for a set of message ids, with signed URLs attached.
export async function loadAttachmentsForMessages(messageIds: string[]): Promise<Record<string, AttachmentRow[]>> {
  if (messageIds.length === 0) return {};
  const { data } = await supabase
    .from('support_message_attachments')
    .select('id, message_id, file_name, file_size, mime_type, storage_path')
    .in('message_id', messageIds)
    .order('created_at', { ascending: true });
  const rows = (data as AttachmentRow[]) || [];
  const urls = await signAttachmentUrls(rows.map((r) => r.storage_path));
  const map: Record<string, AttachmentRow[]> = {};
  rows.forEach((r) => {
    r.signedUrl = urls[r.storage_path];
    (map[r.message_id] ||= []).push(r);
  });
  return map;
}
