import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Save, X, Trash2 } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

const BRAND = '#5A2D82';

const PRINT_METHODS: { value: string; label: string }[] = [
  { value: '', label: 'Any method' },
  { value: 'screen_print', label: 'Screen Print' },
  { value: 'embroidery', label: 'Embroidery' },
];

interface PricingTier {
  id: string;
  product_name: string;
  print_method: string | null;
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
  sort_order: number;
}

const EMPTY_FORM = { productName: '', printMethod: '', minQty: '', maxQty: '', unitPrice: '' };

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`;
}

export default function AdminB2BPricingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadTiers = async () => {
    const { data, error } = await supabase
      .from('b2b_pricing_tiers')
      .select('*')
      .order('product_name', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('min_qty', { ascending: true });
    if (!error) setTiers((data || []) as PricingTier[]);
    setLoading(false);
  };

  useEffect(() => { void loadTiers(); }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, PricingTier[]>();
    for (const t of tiers) {
      const list = map.get(t.product_name) || [];
      list.push(t);
      map.set(t.product_name, list);
    }
    return Array.from(map.entries());
  }, [tiers]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (tier: PricingTier) => {
    setEditingId(tier.id);
    setForm({
      productName: tier.product_name,
      printMethod: tier.print_method || '',
      minQty: String(tier.min_qty),
      maxQty: tier.max_qty != null ? String(tier.max_qty) : '',
      unitPrice: String(tier.unit_price),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    const minQty = parseInt(form.minQty, 10);
    const maxQty = form.maxQty.trim() ? parseInt(form.maxQty, 10) : null;
    const unitPrice = parseInt(form.unitPrice, 10);

    if (!form.productName.trim()) {
      Alert.alert('Product name required', 'e.g. Custom Hoodie');
      return;
    }
    if (!minQty || minQty < 1) {
      Alert.alert('Minimum quantity required', 'Must be at least 1.');
      return;
    }
    if (maxQty != null && maxQty < minQty) {
      Alert.alert('Invalid range', 'Max quantity must be greater than or equal to min quantity.');
      return;
    }
    if (!unitPrice || unitPrice < 0) {
      Alert.alert('Unit price required', 'Enter the price per piece in Naira.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_name: form.productName.trim(),
        print_method: form.printMethod || null,
        min_qty: minQty,
        max_qty: maxQty,
        unit_price: unitPrice,
      };
      const { error } = editingId
        ? await supabase.from('b2b_pricing_tiers').update(payload).eq('id', editingId)
        : await supabase.from('b2b_pricing_tiers').insert(payload);
      if (error) throw error;

      setShowModal(false);
      await loadTiers();
    } catch (error: any) {
      Alert.alert('Could not save', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tier: PricingTier) => {
    Alert.alert('Delete price tier', `Remove this ${tier.product_name} tier?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('b2b_pricing_tiers').delete().eq('id', tier.id);
          if (error) { Alert.alert('Error', error.message); return; }
          await loadTiers();
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
        <Text style={styles.headerTitle}>B2B Pricing</Text>
        <Pressable style={styles.addBtn} onPress={openAdd}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {tiers.length === 0 && (
          <Text style={styles.emptyText}>No price tiers yet. Tap + to add your first one, e.g. "Custom Hoodie" 20-49 pieces.</Text>
        )}
        {grouped.map(([productName, productTiers]) => (
          <View key={productName} style={styles.productGroup}>
            <Text style={styles.productName}>{productName}</Text>
            {productTiers.map((tier) => (
              <Pressable key={tier.id} style={styles.tierRow} onPress={() => openEdit(tier)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierRange}>
                    {tier.min_qty}{tier.max_qty ? `-${tier.max_qty}` : '+'} pieces
                    {tier.print_method ? ` · ${PRINT_METHODS.find((m) => m.value === tier.print_method)?.label}` : ''}
                  </Text>
                  <Text style={styles.tierPrice}>{formatNaira(tier.unit_price)} / piece</Text>
                </View>
                <Pressable style={styles.deleteBtn} onPress={() => handleDelete(tier)} hitSlop={4}>
                  <Trash2 size={14} color="#FFFFFF" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Price Tier' : 'Add Price Tier'}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)}><X size={20} color="#6B7280" /></Pressable>
              <Pressable style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFF" /> : <><Save size={16} color="#FFF" /><Text style={styles.modalSaveText}>Save</Text></>}
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Product Name *</Text>
            <TextInput style={styles.input} value={form.productName} onChangeText={(t) => setForm((p) => ({ ...p, productName: t }))} placeholder="e.g. Custom Hoodie" placeholderTextColor="#9CA3AF" />

            <Text style={styles.label}>Print Method</Text>
            <View style={styles.chipRow}>
              {PRINT_METHODS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.chip, form.printMethod === m.value && styles.chipActive]}
                  onPress={() => setForm((p) => ({ ...p, printMethod: m.value }))}
                >
                  <Text style={[styles.chipText, form.printMethod === m.value && styles.chipTextActive]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Min Quantity *</Text>
                <TextInput style={styles.input} value={form.minQty} onChangeText={(t) => setForm((p) => ({ ...p, minQty: t.replace(/[^0-9]/g, '') }))} placeholder="20" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Max Quantity</Text>
                <TextInput style={styles.input} value={form.maxQty} onChangeText={(t) => setForm((p) => ({ ...p, maxQty: t.replace(/[^0-9]/g, '') }))} placeholder="Leave blank for no cap" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
              </View>
            </View>

            <Text style={styles.label}>Unit Price (₦ per piece) *</Text>
            <TextInput style={styles.input} value={form.unitPrice} onChangeText={(t) => setForm((p) => ({ ...p, unitPrice: t.replace(/[^0-9]/g, '') }))} placeholder="8500" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />

            <Text style={styles.hint}>Tip: use the same Product Name across multiple tiers (e.g. 20-49, 50-99, 100+) to build out the full price break for one item.</Text>
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

  productGroup: { marginBottom: 20 },
  productName: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 8 },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF',
    borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#EDEAF1',
  },
  tierRange: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  tierPrice: { fontSize: 15, fontFamily: 'Inter-Bold', color: BRAND, marginTop: 2 },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },

  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6, minWidth: 76, justifyContent: 'center' },
  modalSaveText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },

  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 6, marginTop: 14 },
  input: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C', backgroundColor: '#FFFFFF' },
  hint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 12, lineHeight: 17 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: BRAND, borderColor: BRAND },
  chipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  chipTextActive: { color: '#FFF' },
});
