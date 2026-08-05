import React from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import { ImagePlus, X } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { StoreProduct } from '@/types/product';
import { styles, BRAND_PURPLE } from '../styles';

interface BrandingOrNoteSectionProps {
  product: StoreProduct;
  note: string;
  onNoteChange: (note: string) => void;
  logoUrl: string | null;
  uploadingLogo: boolean;
  onUploadLogo: () => void;
  onRemoveLogo: () => void;
}

export function BrandingOrNoteSection({
  product,
  note,
  onNoteChange,
  logoUrl,
  uploadingLogo,
  onUploadLogo,
  onRemoveLogo,
}: BrandingOrNoteSectionProps) {
  if (product.allow_logo_upload) {
    return (
      <View style={styles.selectionSection}>
        <Text style={styles.selectionTitle}>For branded outfits/items, insert logo or describe the design</Text>
        <Text style={styles.noteHint}>Optional. Custom logos, artwork, and personalised designs attract an additional customization fee, added to your order total at checkout.</Text>
        {logoUrl ? (
          <View style={styles.logoPreviewWrap}>
            <Image source={{ uri: optimizeImageUrl(logoUrl, { width: 240 }) as string }} style={styles.logoPreview} resizeMode="contain" />
            <Pressable style={styles.logoRemove} onPress={onRemoveLogo} hitSlop={6}><X size={14} color="#FFFFFF" /></Pressable>
          </View>
        ) : (
          <Pressable style={styles.logoUploadBtn} onPress={onUploadLogo} disabled={uploadingLogo}>
            <ImagePlus size={18} color={BRAND_PURPLE} />
            <Text style={styles.logoUploadText}>{uploadingLogo ? 'Uploading…' : 'Insert logo image'}</Text>
          </Pressable>
        )}
        <TextInput
          style={[styles.noteInput, { marginTop: 12 }]}
          value={note}
          onChangeText={onNoteChange}
          placeholder="Describe the design, colours and placement"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
          maxLength={300}
          textAlignVertical="top"
        />
      </View>
    );
  }

  return (
    <View style={styles.selectionSection}>
      <Text style={styles.selectionTitle}>Can't find what you're looking for?</Text>
      <Text style={styles.noteHint}>
        Describe your perfect piece - a size, color, fabric or custom detail
        that isn't listed - and we'll tailor it just for you.
      </Text>
      <TextInput
        style={styles.noteInput}
        value={note}
        onChangeText={onNoteChange}
        placeholder="e.g. Waist 34, forest green, embroider initials JD"
        placeholderTextColor="#9CA3AF"
        multiline
        numberOfLines={3}
        maxLength={300}
        textAlignVertical="top"
      />
    </View>
  );
}
