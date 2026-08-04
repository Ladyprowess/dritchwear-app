import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { pickAndUploadImage } from '@/lib/uploadImage';
import { SHOP_CATEGORIES } from '@/lib/categories';

const BRAND_PURPLE = '#5A2D82';

export default function CategoryImagesScreen() {
  const router = useRouter();
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('category_images').select('category, image_url');
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { if (r.image_url) map[r.category] = r.image_url; });
    setImages(map);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const setImage = async (category: string) => {
    setBusy(category);
    const url = await pickAndUploadImage('categories');
    if (url) {
      const { error } = await supabase
        .from('category_images')
        .upsert({ category, image_url: url, updated_at: new Date().toISOString() });
      if (error) Alert.alert('Could not save', error.message);
      else setImages((prev) => ({ ...prev, [category]: url }));
    }
    setBusy(null);
  };

  const clearImage = (category: string) => {
    Alert.alert('Remove image', `Reset "${category}" to the default (a product photo)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('category_images').delete().eq('category', category);
          if (error) { Alert.alert('Error', error.message); return; }
          setImages((prev) => { const next = { ...prev }; delete next[category]; return next; });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/(admin)/settings')}>
          <ArrowLeft size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Category Images</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND_PURPLE} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>Set the photo shown on each shop category tile. Categories without a photo use a product image.</Text>
          {SHOP_CATEGORIES.map((category) => {
            const url = images[category];
            return (
              <View key={category} style={styles.row}>
                <View style={styles.thumbWrap}>
                  {url ? (
                    <Image source={{ uri: optimizeImageUrl(url, { width: 160 }) as string }} style={styles.thumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.thumbEmpty}><Text style={styles.thumbEmptyText}>{category.charAt(0)}</Text></View>
                  )}
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{category}</Text>
                  <Text style={styles.rowState}>{url ? 'Custom photo set' : 'Using product image'}</Text>
                </View>
                {url && (
                  <Pressable style={styles.clearBtn} onPress={() => clearImage(category)} hitSlop={6}>
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                )}
                <Pressable style={[styles.setBtn, busy === category && styles.setBtnBusy]} onPress={() => setImage(category)} disabled={busy === category}>
                  <ImagePlus size={15} color="#FFFFFF" />
                  <Text style={styles.setBtnText}>{busy === category ? 'Uploading…' : url ? 'Change' : 'Set'}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scroll: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#665F6C', lineHeight: 19, marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#EDEAF1' },
  thumbWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  thumb: { width: 52, height: 52, backgroundColor: '#F3F4F6' },
  thumbEmpty: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#EDEAF0', alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { fontFamily: 'Inter-Bold', fontSize: 18, color: BRAND_PURPLE },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  rowState: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7380', marginTop: 2 },
  clearBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  setBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND_PURPLE, borderRadius: 9, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  setBtnBusy: { opacity: 0.6 },
  setBtnText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 13 },
});
