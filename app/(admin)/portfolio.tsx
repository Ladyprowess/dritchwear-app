import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, Modal, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Save, X, Trash2, ImagePlus, Video as VideoIcon, Star } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { pickAndUploadPortfolioMedia, type UploadedMedia } from '@/lib/uploadMedia';
import RichTextEditor from '@/components/RichTextEditor';

const BRAND = '#5A2D82';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'corporate', label: 'Corporate / Tech Teams' },
  { value: 'event', label: 'Events & Conferences' },
  { value: 'streetwear', label: 'Streetwear Drops' },
];

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  client_name: string | null;
  media_urls: UploadedMedia[];
  is_featured: boolean;
  created_at: string;
}

const EMPTY_FORM = { title: '', category: 'corporate', client_name: '', description: '', isFeatured: false };

export default function AdminPortfolioScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [media, setMedia] = useState<UploadedMedia[]>([]);

  const loadItems = async () => {
    const { data, error } = await supabase
      .from('portfolio_items')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (!error) setItems((data || []) as PortfolioItem[]);
    setLoading(false);
  };

  useEffect(() => { void loadItems(); }, []);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setMedia([]);
    setShowModal(true);
  };

  const handleAddMedia = async () => {
    setUploading(true);
    const uploaded = await pickAndUploadPortfolioMedia('portfolio-items');
    setUploading(false);
    if (uploaded.length > 0) setMedia((prev) => [...prev, ...uploaded]);
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      Alert.alert('Title required', 'Give this project a title.');
      return;
    }
    if (media.length === 0) {
      Alert.alert('Add at least one photo or video', 'Upload at least one photo or video for this project.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('portfolio_items').insert({
        title: form.title.trim(),
        category: form.category,
        client_name: form.client_name.trim() || null,
        description: form.description.trim() || null,
        media_urls: media,
        is_featured: form.isFeatured,
      });
      if (error) throw error;

      setShowModal(false);
      await loadItems();
    } catch (error: any) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: PortfolioItem) => {
    Alert.alert('Delete project', `Remove "${item.title}" from the portfolio?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id);
          if (error) { Alert.alert('Error', error.message); return; }
          await loadItems();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={BRAND} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/(admin)/settings')}>
          <ArrowLeft size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Portfolio / Past Work</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {items.length === 0 && (
          <Text style={styles.emptyText}>No portfolio items yet. Tap + to add your first project.</Text>
        )}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            {item.media_urls[0] && (
              item.media_urls[0].type === 'image' ? (
                <Image source={{ uri: item.media_urls[0].url }} style={styles.thumb} resizeMode="cover" />
              ) : item.media_urls[0].posterUrl ? (
                <Image source={{ uri: item.media_urls[0].posterUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.videoThumb]}>
                  <VideoIcon size={22} color="#FFFFFF" />
                </View>
              )
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                {item.is_featured && <Star size={14} color="#F59E0B" fill="#F59E0B" />}
              </View>
              <Text style={styles.cardMeta}>
                {CATEGORIES.find((c) => c.value === item.category)?.label || item.category}
                {item.client_name ? ` · ${item.client_name}` : ''}
              </Text>
              <Text style={styles.cardMeta}>{item.media_urls.length} file{item.media_urls.length === 1 ? '' : 's'}</Text>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)}>
              <Trash2 size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Project</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}><X size={20} color="#6B7280" /></Pressable>
              <Pressable style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <><Save size={16} color="#FFF" /><Text style={styles.modalSaveText}>Save</Text></>}
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Title *</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={(t) => setForm((p) => ({ ...p, title: t }))} placeholder="e.g. 50 Custom Embroidered Hoodies for Tech Hub" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.chip, form.category === c.value && styles.chipActive]}
                  onPress={() => setForm((p) => ({ ...p, category: c.value }))}
                >
                  <Text style={[styles.chipText, form.category === c.value && styles.chipTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Client Name</Text>
            <TextInput style={styles.input} value={form.client_name} onChangeText={(t) => setForm((p) => ({ ...p, client_name: t }))} placeholder="e.g. Paystack" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Description</Text>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm((p) => ({ ...p, description: html }))}
              placeholder="e.g. Heavyweight 350gsm fleece hoodies with chest embroidery"
            />

            <View style={styles.toggleRow}>
              <Text style={styles.label}>Feature this project</Text>
              <Pressable onPress={() => setForm((p) => ({ ...p, isFeatured: !p.isFeatured }))} style={[styles.featureToggle, form.isFeatured && styles.featureToggleActive]}>
                <Star size={16} color={form.isFeatured ? '#FFFFFF' : '#9CA3AF'} fill={form.isFeatured ? '#FFFFFF' : 'none'} />
              </Pressable>
            </View>

            <Text style={styles.label}>Photos & Videos *</Text>
            <View style={styles.mediaGrid}>
              {media.map((m, i) => (
                <View key={i} style={styles.mediaThumbWrap}>
                  {m.type === 'image' ? (
                    <Image source={{ uri: m.url }} style={styles.mediaThumb} resizeMode="cover" />
                  ) : m.posterUrl ? (
                    <Image source={{ uri: m.posterUrl }} style={styles.mediaThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.mediaThumb, styles.videoThumb]}><VideoIcon size={18} color="#FFF" /></View>
                  )}
                  <Pressable style={styles.mediaRemove} onPress={() => removeMedia(i)} hitSlop={6}>
                    <X size={12} color="#FFF" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addMediaBtn} onPress={handleAddMedia} disabled={uploading}>
                {uploading ? <ActivityIndicator size="small" color={BRAND} /> : <ImagePlus size={22} color={BRAND} />}
              </Pressable>
            </View>
            <Text style={styles.hint}>Photos up to 12MB, videos up to 40MB. You can select multiple at once.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 40 },

  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EDEAF1', alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#F3F4F6' },
  videoThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#374151' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#17131C', flexShrink: 1 },
  cardMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, minWidth: 76, justifyContent: 'center' },
  modalSaveText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C', backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 8, lineHeight: 17 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  chipTextActive: { color: '#FFF' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  featureToggle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  featureToggleActive: { backgroundColor: '#F59E0B' },

  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  mediaThumbWrap: { position: 'relative' },
  mediaThumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: '#F3F4F6' },
  mediaRemove: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  addMediaBtn: { width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderColor: BRAND, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
