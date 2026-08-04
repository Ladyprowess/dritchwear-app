import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Linking, Modal, SafeAreaView, Platform, Alert, ActivityIndicator } from 'react-native';
import { FileText, Download, X } from 'lucide-react-native';
import { isImage, humanSize, type AttachmentRow } from '@/lib/attachments';

const BRAND_PURPLE = '#5A2D82';

interface Props {
  attachments: AttachmentRow[];
  mine?: boolean;
}

// Fetches a signed Supabase Storage URL (which carries a ?token= secret) into
// a same-origin local resource: a blob: object URL on web, a cached file://
// path on native. The raw remote URL is only ever used inside this one
// fetch/download call - it is never assigned to an <Image>/<a> element or
// passed to Linking, so there is nothing for a browser's "copy image
// address"/"open in new tab" or a native share sheet to reveal.
async function localize(remoteUrl: string, fileName: string): Promise<string> {
  if (Platform.OS === 'web') {
    const response = await fetch(remoteUrl);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
  const FileSystem = await import('expo-file-system/legacy');
  const dest = (FileSystem as any).cacheDirectory + fileName;
  const { uri } = await (FileSystem as any).downloadAsync(remoteUrl, dest);
  return uri;
}

async function openLocalDocument(localUri: string, fileName: string) {
  if (Platform.OS === 'web') {
    const anchor = document.createElement('a');
    anchor.href = localUri;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return;
  }

  const Sharing = await import('expo-sharing');
  if (await (Sharing as any).isAvailableAsync()) {
    await (Sharing as any).shareAsync(localUri);
  } else {
    Linking.openURL(localUri);
  }
}

export default function MessageAttachments({ attachments, mine }: Props) {
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    const images = (attachments || []).filter((a) => isImage(a.mime_type) && a.signedUrl);

    images.forEach((a) => {
      if (localImages[a.id]) return;
      localize(a.signedUrl!, a.file_name)
        .then((uri) => {
          if (!active) return;
          if (Platform.OS === 'web') objectUrls.current.push(uri);
          setLocalImages((prev) => ({ ...prev, [a.id]: uri }));
        })
        .catch((error) => console.error('Failed to load attachment image:', error));
    });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  if (!attachments || attachments.length === 0) return null;

  const handleOpenDocument = async (a: AttachmentRow) => {
    if (!a.signedUrl || openingDocId) return;
    setOpeningDocId(a.id);
    try {
      const localUri = await localize(a.signedUrl, a.file_name);
      await openLocalDocument(localUri, a.file_name);
      if (Platform.OS === 'web') URL.revokeObjectURL(localUri);
    } catch (error) {
      console.error('Attachment download failed:', error);
      Alert.alert('Download failed', 'Could not download this file. Please try again.');
    } finally {
      setOpeningDocId(null);
    }
  };

  const previewUri = previewId ? localImages[previewId] : null;

  return (
    <View style={styles.wrap}>
      {attachments.map((a) => {
        if (isImage(a.mime_type) && a.signedUrl) {
          const localUri = localImages[a.id];
          return (
            <Pressable key={a.id} onPress={() => localUri && setPreviewId(a.id)} style={[styles.imageWrap, !localUri && styles.imageLoading]}>
              {localUri ? (
                <Image source={{ uri: localUri }} style={styles.image} resizeMode="cover" />
              ) : (
                <ActivityIndicator size="small" color={BRAND_PURPLE} />
              )}
            </Pressable>
          );
        }
        return (
          <Pressable key={a.id} onPress={() => handleOpenDocument(a)} style={[styles.docChip, mine ? styles.docChipMine : styles.docChipTheirs]}>
            <View style={[styles.docIcon, mine && styles.docIconMine]}>
              <FileText size={18} color={mine ? '#FFFFFF' : BRAND_PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.docName, mine && styles.docTextMine]} numberOfLines={1}>{a.file_name}</Text>
              <Text style={[styles.docSize, mine && styles.docSubMine]}>{humanSize(a.file_size)}</Text>
            </View>
            {openingDocId === a.id ? (
              <ActivityIndicator size="small" color={mine ? '#FFFFFF' : BRAND_PURPLE} />
            ) : (
              <Download size={16} color={mine ? 'rgba(255,255,255,0.85)' : '#8B8391'} />
            )}
          </Pressable>
        );
      })}

      <Modal visible={!!previewId} transparent animationType="fade" onRequestClose={() => setPreviewId(null)}>
        <SafeAreaView style={styles.previewBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewId(null)} />
          <Pressable style={styles.previewClose} onPress={() => setPreviewId(null)}>
            <X size={22} color="#FFFFFF" />
          </Pressable>
          {previewUri && (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 2 },
  imageWrap: { borderRadius: 10, overflow: 'hidden' },
  imageLoading: { width: 180, height: 180, backgroundColor: '#EEEAF2', alignItems: 'center', justifyContent: 'center' },
  image: { width: 180, height: 180, borderRadius: 10, backgroundColor: '#EEEAF2' },
  docChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, minWidth: 200 },
  docChipMine: { backgroundColor: 'rgba(255,255,255,0.15)' },
  docChipTheirs: { backgroundColor: '#F3EFF7' },
  docIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  docIconMine: { backgroundColor: 'rgba(255,255,255,0.2)' },
  docName: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  docSize: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#8B8391', marginTop: 1 },
  docTextMine: { color: '#FFFFFF' },
  docSubMine: { color: 'rgba(255,255,255,0.75)' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  previewClose: { position: 'absolute', top: 16, right: 16, zIndex: 1, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
