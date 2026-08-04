import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, Modal, Alert,
  ActivityIndicator, Switch, Platform, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Trash2, Check, X, Search, CreditCard as Edit3 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency } from '@/lib/currency';
import { OCCASIONS, GENDERS } from '@/types/outfit';

const BRAND_PURPLE = '#5A2D82';

interface OutfitRow {
  id: string;
  title: string;
  occasion: string;
  gender: string;
  subtitle: string | null;
  stylist_note: string | null;
  cover_image: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  itemCount: number;
}
interface PickProduct { id: string; name: string; image_url: string; price: number; }

const emptyForm = { title: '', occasion: OCCASIONS[0] as string, gender: 'Unisex' as string, subtitle: '', stylist_note: '', cover_image: '', is_active: true, position: '0' };

export default function AdminOutfitsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sideNav = Platform.OS === 'web' && width >= 768;

  const [outfits, setOutfits] = useState<OutfitRow[]>([]);
  const [products, setProducts] = useState<PickProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<OutfitRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    const [{ data: outfitRows }, { data: itemRows }, { data: productRows }] = await Promise.all([
      supabase.from('outfits').select('*').order('position', { ascending: true }).order('created_at', { ascending: false }),
      supabase.from('outfit_items').select('outfit_id'),
      supabase.from('products').select('id, name, image_url, price').eq('is_active', true).order('name', { ascending: true }),
    ]);
    const counts = new Map<string, number>();
    (itemRows ?? []).forEach((r: any) => counts.set(r.outfit_id, (counts.get(r.outfit_id) ?? 0) + 1));
    setOutfits(((outfitRows ?? []) as any[]).map((o) => ({ ...o, itemCount: counts.get(o.id) ?? 0 })));
    setProducts((productRows ?? []) as PickProduct[]);
    setLoading(false);
  };

  useEffect(() => { void fetchAll(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setSelectedIds([]);
    setProductSearch('');
    setShowModal(true);
  };

  const openEdit = async (outfit: OutfitRow) => {
    setEditing(outfit);
    setForm({
      title: outfit.title,
      occasion: outfit.occasion,
      gender: outfit.gender ?? 'Unisex',
      subtitle: outfit.subtitle ?? '',
      stylist_note: outfit.stylist_note ?? '',
      cover_image: outfit.cover_image ?? '',
      is_active: outfit.is_active,
      position: String(outfit.position ?? 0),
    });
    setProductSearch('');
    const { data } = await supabase.from('outfit_items').select('product_id').eq('outfit_id', outfit.id).order('position', { ascending: true });
    setSelectedIds((data ?? []).map((r: any) => r.product_id));
    setShowModal(true);
  };

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!form.title.trim()) { Alert.alert('Missing title', 'Give this look a title.'); return; }
    if (selectedIds.length === 0) { Alert.alert('No products', 'Add at least one product to the look.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        occasion: form.occasion,
        gender: form.gender,
        subtitle: form.subtitle.trim() || null,
        stylist_note: form.stylist_note.trim() || null,
        cover_image: form.cover_image.trim() || null,
        is_active: form.is_active,
        position: Number(form.position) || 0,
      };
      let outfitId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('outfits').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('outfits').insert(payload).select('id').single();
        if (error) throw error;
        outfitId = data.id;
      }
      // Replace the look's items with the current selection, preserving
      // order. Done as one atomic RPC so a failed insert can't leave the
      // outfit's old products already deleted (see replace_outfit_items).
      const { error: itemsError } = await supabase.rpc('replace_outfit_items', {
        p_outfit_id: outfitId,
        p_product_ids: selectedIds,
      });
      if (itemsError) throw itemsError;
      setShowModal(false);
      await fetchAll();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeOutfit = (outfit: OutfitRow) => {
    Alert.alert('Delete look?', `"${outfit.title}" will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('outfits').delete().eq('id', outfit.id);
          if (error) { Alert.alert('Could not delete', error.message); return; }
          await fetchAll();
        },
      },
    ]);
  };

  const toggleActive = async (outfit: OutfitRow) => {
    const next = !outfit.is_active;
    setOutfits((prev) => prev.map((o) => (o.id === outfit.id ? { ...o, is_active: next } : o)));
    const { error } = await supabase.from('outfits').update({ is_active: next }).eq('id', outfit.id);
    if (error) { Alert.alert('Update failed', error.message); await fetchAll(); }
  };

  const filteredProducts = productSearch.trim()
    ? products.filter((p) => p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))
    : products;

  return (
    <SafeAreaView style={styles.safe} edges={sideNav ? [] : ['top']}>
      <View style={styles.header}>
        {!sideNav && (
          <Pressable style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
            <ArrowLeft size={22} color={BRAND_PURPLE} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Shop the Look</Text>
          <Text style={styles.headerSubtitle}>Curate outfits customers can buy in one tap</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New look</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={BRAND_PURPLE} /></View>
      ) : outfits.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No looks yet</Text>
          <Text style={styles.emptyText}>Create your first outfit to power the customer stylist.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {outfits.map((outfit) => (
            <View key={outfit.id} style={styles.row}>
              {!!(outfit.cover_image) && (
                <Image source={{ uri: optimizeImageUrl(outfit.cover_image, { width: 160 }) as string }} style={styles.rowImage} resizeMode="cover" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{outfit.title}</Text>
                <Text style={styles.rowMeta}>{outfit.occasion} · {outfit.itemCount} piece{outfit.itemCount === 1 ? '' : 's'}</Text>
                {!outfit.is_active && <Text style={styles.inactiveTag}>Hidden</Text>}
              </View>
              <Switch value={outfit.is_active} onValueChange={() => toggleActive(outfit)} trackColor={{ true: BRAND_PURPLE, false: '#D1D5DB' }} />
              <Pressable style={styles.iconBtn} onPress={() => openEdit(outfit)} hitSlop={6}><Edit3 size={18} color="#4B5563" /></Pressable>
              <Pressable style={styles.iconBtn} onPress={() => removeOutfit(outfit)} hitSlop={6}><Trash2 size={18} color="#B42318" /></Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Add / edit modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit look' : 'New look'}</Text>
              <Pressable style={styles.iconBtn} onPress={() => setShowModal(false)} hitSlop={8}><X size={22} color="#4B5563" /></Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} value={form.title} onChangeText={(t) => setForm((f) => ({ ...f, title: t }))} placeholder="e.g. Sunday Service Fit" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Occasion *</Text>
              <View style={styles.chipWrap}>
                {OCCASIONS.map((occ) => (
                  <Pressable key={occ} style={[styles.chip, form.occasion === occ && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, occasion: occ }))}>
                    <Text style={[styles.chipText, form.occasion === occ && styles.chipTextActive]}>{occ}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Styled for *</Text>
              <View style={styles.chipWrap}>
                {GENDERS.map((g) => (
                  <Pressable key={g} style={[styles.chip, form.gender === g && styles.chipActive]} onPress={() => setForm((f) => ({ ...f, gender: g }))}>
                    <Text style={[styles.chipText, form.gender === g && styles.chipTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Subtitle</Text>
              <TextInput style={styles.input} value={form.subtitle} onChangeText={(t) => setForm((f) => ({ ...f, subtitle: t }))} placeholder="Short descriptor (optional)" placeholderTextColor="#9CA3AF" />

              <Text style={styles.label}>Why this works</Text>
              <TextInput style={[styles.input, { minHeight: 76, textAlignVertical: 'top' }]} value={form.stylist_note} onChangeText={(t) => setForm((f) => ({ ...f, stylist_note: t }))} placeholder="Short stylist note shown on the edit page (optional)" placeholderTextColor="#9CA3AF" multiline />

              <Text style={styles.label}>Cover image URL</Text>
              <TextInput style={styles.input} value={form.cover_image} onChangeText={(t) => setForm((f) => ({ ...f, cover_image: t }))} placeholder="https://… (optional, falls back to first product)" placeholderTextColor="#9CA3AF" autoCapitalize="none" />

              <View style={styles.inlineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Sort position</Text>
                  <TextInput style={styles.input} value={form.position} onChangeText={(t) => setForm((f) => ({ ...f, position: t.replace(/[^0-9]/g, '') }))} keyboardType="numeric" placeholder="0" placeholderTextColor="#9CA3AF" />
                </View>
                <View style={styles.activeToggle}>
                  <Text style={styles.label}>Active</Text>
                  <Switch value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} trackColor={{ true: BRAND_PURPLE, false: '#D1D5DB' }} />
                </View>
              </View>

              <Text style={styles.label}>Products in this look * ({selectedIds.length} selected)</Text>
              <View style={styles.searchBar}>
                <Search size={16} color="#9CA3AF" />
                <TextInput style={styles.searchInput} value={productSearch} onChangeText={setProductSearch} placeholder="Search products" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={styles.pickList}>
                {filteredProducts.map((p) => {
                  const selected = selectedIds.includes(p.id);
                  return (
                    <Pressable key={p.id} style={[styles.pickItem, selected && styles.pickItemActive]} onPress={() => toggleProduct(p.id)}>
                      <Image source={{ uri: optimizeImageUrl(p.image_url, { width: 100 }) as string }} style={styles.pickImage} resizeMode="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.pickPrice}>{formatCurrency(p.price, 'NGN')}</Text>
                      </View>
                      <View style={[styles.checkbox, selected && styles.checkboxActive]}>{selected && <Check size={14} color="#FFFFFF" />}</View>
                    </Pressable>
                  );
                })}
                {filteredProducts.length === 0 && <Text style={styles.pickEmpty}>No products match.</Text>}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Create look'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E3EB' },
  headerTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#17131C' },
  headerSubtitle: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#665F6C', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BRAND_PURPLE, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 13 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 6 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  list: { padding: 16, gap: 12, maxWidth: 900, alignSelf: 'center', width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E8E3EB' },
  rowImage: { width: 52, height: 66, borderRadius: 8, backgroundColor: '#EDEAF0' },
  rowTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  rowMeta: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#665F6C', marginTop: 2 },
  inactiveTag: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#B45309', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,19,28,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '92%', paddingBottom: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C' },
  modalScroll: { paddingHorizontal: 16, paddingBottom: 20 },
  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: 'Inter-Regular', color: '#1F2937', backgroundColor: '#FFFFFF' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  chipActive: { backgroundColor: BRAND_PURPLE, borderColor: BRAND_PURPLE },
  chipText: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#6B7280' },
  chipTextActive: { color: '#FFFFFF' },
  inlineRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-end' },
  activeToggle: { alignItems: 'flex-start' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12, height: 44, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#1F2937' },
  pickList: { gap: 8 },
  pickItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E8E3EB', backgroundColor: '#FFFFFF' },
  pickItemActive: { borderColor: BRAND_PURPLE, backgroundColor: '#F7F3FB' },
  pickImage: { width: 40, height: 50, borderRadius: 6, backgroundColor: '#F3F4F6' },
  pickName: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#1F2937' },
  pickPrice: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: BRAND_PURPLE, marginTop: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: BRAND_PURPLE, borderColor: BRAND_PURPLE },
  pickEmpty: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#9CA3AF', paddingVertical: 12, textAlign: 'center' },
  modalActions: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F0EEF2' },
  saveBtn: { backgroundColor: BRAND_PURPLE, borderRadius: 12, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 15 },
});
