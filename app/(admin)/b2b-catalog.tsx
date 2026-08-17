import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Save, X, Trash2, ImagePlus, Package } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { pickAndUploadPortfolioThumbnail } from '@/lib/uploadMedia';

const BRAND = '#5A2D82';

interface B2BProduct {
  id: string;
  name: string;
  photo_url: string | null;
  colors: string[];
  sizes: string[];
  fabric_spec: string | null;
  min_qty: number;
  price_20_49: number | null;
  price_50_99: number | null;
  price_100_plus: number | null;
  branding_note: string | null;
}

interface B2BPackage {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number | null;
}

const EMPTY_PRODUCT_FORM = {
  name: '', photoUrl: '', colors: '', sizes: '', fabricSpec: '',
  minQty: '20', price20_49: '', price50_99: '', price100Plus: '', brandingNote: '',
};
const EMPTY_PACKAGE_FORM = { name: '', description: '', pricePerPerson: '' };

function formatNaira(n: number | null): string {
  return n == null ? '-' : `₦${n.toLocaleString('en-NG')}`;
}

export default function AdminB2BCatalogScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'products' | 'packages'>('products');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [packages, setPackages] = useState<B2BPackage[]>([]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);

  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageForm, setPackageForm] = useState(EMPTY_PACKAGE_FORM);

  const loadAll = async () => {
    const [{ data: p }, { data: pk }] = await Promise.all([
      supabase.from('b2b_products').select('*').order('sort_order', { ascending: true }),
      supabase.from('b2b_packages').select('*').order('sort_order', { ascending: true }),
    ]);
    setProducts((p || []) as B2BProduct[]);
    setPackages((pk || []) as B2BPackage[]);
    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  // Products

  const openAddProduct = () => {
    setEditingProductId(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setShowProductModal(true);
  };

  const openEditProduct = (item: B2BProduct) => {
    setEditingProductId(item.id);
    setProductForm({
      name: item.name,
      photoUrl: item.photo_url || '',
      colors: item.colors.join(', '),
      sizes: item.sizes.join(', '),
      fabricSpec: item.fabric_spec || '',
      minQty: String(item.min_qty),
      price20_49: item.price_20_49 != null ? String(item.price_20_49) : '',
      price50_99: item.price_50_99 != null ? String(item.price_50_99) : '',
      price100Plus: item.price_100_plus != null ? String(item.price_100_plus) : '',
      brandingNote: item.branding_note || '',
    });
    setShowProductModal(true);
  };

  const handleUploadPhoto = async () => {
    setUploadingPhoto(true);
    const url = await pickAndUploadPortfolioThumbnail('b2b-products');
    setUploadingPhoto(false);
    if (url) setProductForm((p) => ({ ...p, photoUrl: url }));
  };

  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) {
      Alert.alert('Name required', 'e.g. Premium Heavyweight Tee');
      return;
    }
    setSaving(true);
    try {
      const toIntOrNull = (v: string) => (v.trim() ? parseInt(v, 10) : null);
      const payload = {
        name: productForm.name.trim(),
        photo_url: productForm.photoUrl || null,
        colors: productForm.colors.split(',').map((s) => s.trim()).filter(Boolean),
        sizes: productForm.sizes.split(',').map((s) => s.trim()).filter(Boolean),
        fabric_spec: productForm.fabricSpec.trim() || null,
        min_qty: parseInt(productForm.minQty, 10) || 20,
        price_20_49: toIntOrNull(productForm.price20_49),
        price_50_99: toIntOrNull(productForm.price50_99),
        price_100_plus: toIntOrNull(productForm.price100Plus),
        branding_note: productForm.brandingNote.trim() || null,
      };
      const { error } = editingProductId
        ? await supabase.from('b2b_products').update(payload).eq('id', editingProductId)
        : await supabase.from('b2b_products').insert(payload);
      if (error) throw error;
      setShowProductModal(false);
      await loadAll();
    } catch (error: any) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = (item: B2BProduct) => {
    Alert.alert('Delete product', `Remove "${item.name}" from the B2B catalogue?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('b2b_products').delete().eq('id', item.id);
          if (error) { Alert.alert('Error', error.message); return; }
          await loadAll();
        },
      },
    ]);
  };

  // Packages

  const openAddPackage = () => {
    setEditingPackageId(null);
    setPackageForm(EMPTY_PACKAGE_FORM);
    setShowPackageModal(true);
  };

  const openEditPackage = (item: B2BPackage) => {
    setEditingPackageId(item.id);
    setPackageForm({
      name: item.name,
      description: item.description || '',
      pricePerPerson: item.price_per_person != null ? String(item.price_per_person) : '',
    });
    setShowPackageModal(true);
  };

  const handleSavePackage = async () => {
    if (!packageForm.name.trim()) {
      Alert.alert('Name required', 'e.g. The Attendee Pack');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: packageForm.name.trim(),
        description: packageForm.description.trim() || null,
        price_per_person: packageForm.pricePerPerson.trim() ? parseInt(packageForm.pricePerPerson, 10) : null,
      };
      const { error } = editingPackageId
        ? await supabase.from('b2b_packages').update(payload).eq('id', editingPackageId)
        : await supabase.from('b2b_packages').insert(payload);
      if (error) throw error;
      setShowPackageModal(false);
      await loadAll();
    } catch (error: any) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = (item: B2BPackage) => {
    Alert.alert('Delete package', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('b2b_packages').delete().eq('id', item.id);
          if (error) { Alert.alert('Error', error.message); return; }
          await loadAll();
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
        <Text style={styles.headerTitle}>B2B Catalogue</Text>
        <Pressable style={styles.addBtn} onPress={tab === 'products' ? openAddProduct : openAddPackage}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'products' && styles.tabBtnActive]} onPress={() => setTab('products')}>
          <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>Products & Pricing</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'packages' && styles.tabBtnActive]} onPress={() => setTab('packages')}>
          <Text style={[styles.tabText, tab === 'packages' && styles.tabTextActive]}>Event Packages</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tab === 'products' ? (
          products.length === 0 ? (
            <Text style={styles.emptyText}>No products yet. Tap + to add one, e.g. "Premium Heavyweight Tee".</Text>
          ) : products.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => openEditProduct(item)}>
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.cardThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}><ImagePlus size={20} color="#9CA3AF" /></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>Min {item.min_qty} · {formatNaira(item.price_20_49)} / {formatNaira(item.price_50_99)} / {formatNaira(item.price_100_plus)}</Text>
              </View>
              <Pressable style={styles.deleteBtn} onPress={() => handleDeleteProduct(item)} hitSlop={4}>
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))
        ) : (
          packages.length === 0 ? (
            <Text style={styles.emptyText}>No packages yet. Tap + to add one, e.g. "The Attendee Pack".</Text>
          ) : packages.map((item) => (
            <Pressable key={item.id} style={styles.card} onPress={() => openEditPackage(item)}>
              <View style={[styles.cardThumb, styles.cardThumbPlaceholder]}><Package size={20} color="#9CA3AF" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.description || 'No description'}</Text>
                <Text style={styles.cardPrice}>{formatNaira(item.price_per_person)} / person</Text>
              </View>
              <Pressable style={styles.deleteBtn} onPress={() => handleDeletePackage(item)} hitSlop={4}>
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Product modal */}
      <Modal visible={showProductModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowProductModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingProductId ? 'Edit Product' : 'Add Product'}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowProductModal(false)}><X size={20} color="#6B7280" /></Pressable>
              <Pressable style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSaveProduct()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <><Save size={16} color="#FFF" /><Text style={styles.modalSaveText}>Save</Text></>}
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Photo</Text>
            {productForm.photoUrl ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: productForm.photoUrl }} style={styles.photoPreview} resizeMode="cover" />
                <Pressable style={styles.photoRemove} onPress={() => setProductForm((p) => ({ ...p, photoUrl: '' }))} hitSlop={6}>
                  <X size={12} color="#FFF" />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.photoUploadBtn} onPress={() => void handleUploadPhoto()} disabled={uploadingPhoto}>
                {uploadingPhoto ? <ActivityIndicator size="small" color={BRAND} /> : <><ImagePlus size={18} color={BRAND} /><Text style={styles.photoUploadText}>Upload photo</Text></>}
              </Pressable>
            )}

            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={productForm.name} onChangeText={(t) => setProductForm((p) => ({ ...p, name: t }))} placeholder="e.g. Premium Heavyweight Tee" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Colors (comma separated)</Text>
            <TextInput style={styles.input} value={productForm.colors} onChangeText={(t) => setProductForm((p) => ({ ...p, colors: t }))} placeholder="Black, Navy, White" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Sizes (comma separated)</Text>
            <TextInput style={styles.input} value={productForm.sizes} onChangeText={(t) => setProductForm((p) => ({ ...p, sizes: t }))} placeholder="S, M, L, XL, XXL" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Fabric / Spec</Text>
            <TextInput style={styles.input} value={productForm.fabricSpec} onChangeText={(t) => setProductForm((p) => ({ ...p, fabricSpec: t }))} placeholder="e.g. 240gsm cotton pique" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Minimum Quantity</Text>
            <TextInput style={styles.input} value={productForm.minQty} onChangeText={(t) => setProductForm((p) => ({ ...p, minQty: t.replace(/[^0-9]/g, '') }))} placeholder="20" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />

            <Text style={styles.label}>Price per piece (₦)</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>20-49</Text>
                <TextInput style={styles.input} value={productForm.price20_49} onChangeText={(t) => setProductForm((p) => ({ ...p, price20_49: t.replace(/[^0-9]/g, '') }))} placeholder="-" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>50-99</Text>
                <TextInput style={styles.input} value={productForm.price50_99} onChangeText={(t) => setProductForm((p) => ({ ...p, price50_99: t.replace(/[^0-9]/g, '') }))} placeholder="-" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subLabel}>100+</Text>
                <TextInput style={styles.input} value={productForm.price100Plus} onChangeText={(t) => setProductForm((p) => ({ ...p, price100Plus: t.replace(/[^0-9]/g, '') }))} placeholder="-" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
              </View>
            </View>

            <Text style={styles.label}>Branding Note</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={productForm.brandingNote}
              onChangeText={(t) => setProductForm((p) => ({ ...p, brandingNote: t }))}
              placeholder="e.g. Branding from ₦1,500/unit depending on logo size, placement & colours"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.hint}>Prices above are garment-only. Use the branding note to make clear that logo/print cost is added separately.</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Package modal */}
      <Modal visible={showPackageModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPackageModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingPackageId ? 'Edit Package' : 'Add Package'}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowPackageModal(false)}><X size={20} color="#6B7280" /></Pressable>
              <Pressable style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSavePackage()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <><Save size={16} color="#FFF" /><Text style={styles.modalSaveText}>Save</Text></>}
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={packageForm.name} onChangeText={(t) => setPackageForm((p) => ({ ...p, name: t }))} placeholder="e.g. The Attendee Pack" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>What's included</Text>
            <TextInput style={styles.input} value={packageForm.description} onChangeText={(t) => setPackageForm((p) => ({ ...p, description: t }))} placeholder="e.g. T-shirt + tote bag" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Estimated price per person (₦)</Text>
            <TextInput style={styles.input} value={packageForm.pricePerPerson} onChangeText={(t) => setPackageForm((p) => ({ ...p, pricePerPerson: t.replace(/[^0-9]/g, '') }))} placeholder="e.g. 12000" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
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

  tabRow: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBtn: { paddingHorizontal: 4, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: BRAND },
  tabText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#9CA3AF' },
  tabTextActive: { color: BRAND },

  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', marginTop: 40 },

  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EDEAF1', alignItems: 'center' },
  cardThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#F3F4F6' },
  cardThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#17131C' },
  cardMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardPrice: { fontFamily: 'Inter-Bold', fontSize: 13, color: BRAND, marginTop: 2 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, minWidth: 76, justifyContent: 'center' },
  modalSaveText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 6, marginTop: 14 },
  subLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginBottom: 4 },
  input: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C', backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 8, lineHeight: 17 },

  photoUploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: BRAND, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 14 },
  photoUploadText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: BRAND },
  photoPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoPreview: { width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  photoRemove: { position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
});
