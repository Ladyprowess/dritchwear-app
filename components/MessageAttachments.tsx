import React from 'react';
import { View, Text, StyleSheet, Pressable, Image, Linking } from 'react-native';
import { FileText, Download } from 'lucide-react-native';
import { isImage, humanSize, type AttachmentRow } from '@/lib/attachments';

const BRAND_PURPLE = '#5A2D82';

interface Props {
  attachments: AttachmentRow[];
  mine?: boolean;
}

// Renders a message's attachments: images as thumbnails, documents as a chip
// with icon, filename and size. Tapping opens/downloads via the signed URL.
export default function MessageAttachments({ attachments, mine }: Props) {
  if (!attachments || attachments.length === 0) return null;
  const open = (url?: string) => { if (url) Linking.openURL(url); };

  return (
    <View style={styles.wrap}>
      {attachments.map((a) => {
        if (isImage(a.mime_type) && a.signedUrl) {
          return (
            <Pressable key={a.id} onPress={() => open(a.signedUrl)} style={styles.imageWrap}>
              <Image source={{ uri: a.signedUrl }} style={styles.image} resizeMode="cover" />
            </Pressable>
          );
        }
        return (
          <Pressable key={a.id} onPress={() => open(a.signedUrl)} style={[styles.docChip, mine ? styles.docChipMine : styles.docChipTheirs]}>
            <View style={[styles.docIcon, mine && styles.docIconMine]}>
              <FileText size={18} color={mine ? '#FFFFFF' : BRAND_PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.docName, mine && styles.docTextMine]} numberOfLines={1}>{a.file_name}</Text>
              <Text style={[styles.docSize, mine && styles.docSubMine]}>{humanSize(a.file_size)}</Text>
            </View>
            <Download size={16} color={mine ? 'rgba(255,255,255,0.85)' : '#8B8391'} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 2 },
  imageWrap: { borderRadius: 10, overflow: 'hidden' },
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
});
