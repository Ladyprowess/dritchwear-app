import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { invalidateCommerceConfig } from '@/lib/commerceSettings';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Save, X, Edit3, Trash2, Truck, Store, Percent, MapPin, Star } from 'lucide-react-native';

interface DeliveryZoneRow {
  id: string;
  name: string;
  match_keywords: string[];
  fee_ngn: number;
  is_default: boolean;
  sort_order: number;
  active: boolean;
}

interface ZoneFormData {
  name: string;
  keywords: string; // comma-separated
  fee_ngn: string;
  is_default: boolean;
  active: boolean;
}

const EMPTY_ZONE: ZoneFormData = { name: '', keywords: '', fee_ngn: '', is_default: false, active: true };

export default function StoreSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // commerce_settings singleton fields
  const [storeOpen, setStoreOpen] = useState(true);
  const [closedMessage, setClosedMessage] = useState('');
  const [freeDelivery, setFreeDelivery] = useState(false);
  const [freeThreshold, setFreeThreshold] = useState('0');
  const [serviceFeePct, setServiceFeePct] = useState('2'); // shown as %
  const [taxPct, setTaxPct] = useState('7.5'); // shown as %
  const [minimumOrder, setMinimumOrder] = useState('1000');

  // delivery_zones
  const [zones, setZones] = useState<DeliveryZoneRow[]>([]);
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZoneRow | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneFormData>(EMPTY_ZONE);

  const loadAll = async () => {
    const [settingsRes, zonesRes] = await Promise.all([
      supabase.from('commerce_settings').select('*').eq('id', 'default').single(),
      supabase.from('delivery_zones').select('*').order('sort_order', { ascending: true }),
    ]);

    if (settingsRes.data) {
      const s: any = settingsRes.data;
      setStoreOpen(s.store_open ?? true);
      setClosedMessage(s.store_closed_message ?? '');
      setFreeDelivery(s.free_delivery_enabled ?? false);
      setFreeThreshold(String(s.free_delivery_threshold_ngn ?? 0));
      setServiceFeePct(String(Math.round((Number(s.service_fee_percentage ?? 0.02)) * 1000) / 10));
      setTaxPct(String(Math.round((Number(s.tax_percentage ?? 0.075)) * 1000) / 10));
      setMinimumOrder(String(s.minimum_order_ngn ?? 1000));
    }
    if (zonesRes.data) setZones(zonesRes.data as DeliveryZoneRow[]);
    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  const saveSettings = async () => {
    const svc = Number(serviceFeePct);
    const tax = Number(taxPct);
    const minOrder = Number(minimumOrder);
    const threshold = Number(freeThreshold);

    if ([svc, tax].some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
      Alert.alert('Check your rates', 'Service fee and tax must be between 0 and 100%.');
      return;
    }
    if ([minOrder, threshold].some((v) => !Number.isFinite(v) || v < 0)) {
      Alert.alert('Check your amounts', 'Minimum order and free-delivery threshold cannot be negative.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('commerce_settings').update({
      store_open: storeOpen,
      store_closed_message: closedMessage.trim() || 'We are briefly closed. Please check back soon.',
      free_delivery_enabled: freeDelivery,
      free_delivery_threshold_ngn: threshold,
      service_fee_percentage: svc / 100,
      tax_percentage: tax / 100,
      minimum_order_ngn: minOrder,
      updated_at: new Date().toISOString(),
    }).eq('id', 'default');
    setSaving(false);
    invalidateCommerceConfig();
    Alert.alert(error ? 'Could not save' : 'Settings saved', error?.message || 'Your store settings are now live at checkout.');
  };

  // ---- Delivery zone CRUD -----------------------------------------------------
  const openAddZone = () => { setEditingZone(null); setZoneForm(EMPTY_ZONE); setShowZoneModal(true); };
  const openEditZone = (z: DeliveryZoneRow) => {
    setEditingZone(z);
    setZoneForm({
      name: z.name,
      keywords: (z.match_keywords ?? []).join(', '),
      fee_ngn: String(z.fee_ngn),
      is_default: z.is_default,
      active: z.active,
    });
    setShowZoneModal(true);
  };

  const saveZone = async () => {
    const name = zoneForm.name.trim();
    const fee = Number(zoneForm.fee_ngn);
    const keywords = zoneForm.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    if (!name) { Alert.alert('Name required', 'Give this zone a name, e.g. "Lagos".'); return; }
    if (!Number.isFinite(fee) || fee < 0) { Alert.alert('Invalid fee', 'Enter a delivery fee of 0 or more.'); return; }
    if (!zoneForm.is_default && keywords.length === 0) {
      Alert.alert('Add match keywords', 'Non-default zones need at least one keyword (e.g. "lagos") to match delivery addresses. Or mark this as the default fallback zone.');
      return;
    }

    try {
      // Enforce a single default zone: clear existing defaults first so the
      // partial unique index (one row with is_default = true) never conflicts.
      if (zoneForm.is_default) {
        await supabase.from('delivery_zones').update({ is_default: false }).eq('is_default', true);
      }

      const payload = {
        name,
        match_keywords: zoneForm.is_default ? [] : keywords,
        fee_ngn: fee,
        is_default: zoneForm.is_default,
        active: zoneForm.active,
        updated_at: new Date().toISOString(),
      };

      if (editingZone) {
        const { error } = await supabase.from('delivery_zones').update(payload).eq('id', editingZone.id);
        if (error) throw error;
      } else {
        const nextSort = zones.length ? Math.max(...zones.map((z) => z.sort_order)) + 10 : 10;
        const { error } = await supabase.from('delivery_zones').insert({ ...payload, sort_order: nextSort });
        if (error) throw error;
      }

      setShowZoneModal(false);
      invalidateCommerceConfig();
      await loadAll();
    } catch (error: any) {
      Alert.alert('Could not save zone', error?.message || 'Please try again.');
    }
  };

  const deleteZone = (z: DeliveryZoneRow) => {
    Alert.alert('Delete zone', `Delete "${z.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('delivery_zones').delete().eq('id', z.id);
          if (error) { Alert.alert('Error', error.message); return; }
          invalidateCommerceConfig();
          await loadAll();
        },
      },
    ]);
  };

  const naira = (n: number) => `₦${Number(n).toLocaleString('en-NG')}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color="#5A2D82" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.replace('/(admin)/settings')}>
          <ArrowLeft size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Store & Delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Store status */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}><Store size={18} color="#5A2D82" /><Text style={styles.cardTitle}>Store status</Text></View>
          <View style={styles.toggleRow}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Store open</Text>
              <Text style={styles.hint}>{storeOpen ? 'Customers can place orders.' : 'Checkout is paused - customers see your closed message.'}</Text>
            </View>
            <Switch value={storeOpen} onValueChange={setStoreOpen} />
          </View>
          {!storeOpen && (
            <View style={styles.field}>
              <Text style={styles.label}>Closed message</Text>
              <TextInput style={[styles.input, styles.multiline]} value={closedMessage} onChangeText={setClosedMessage} multiline placeholder="We are briefly closed. Please check back soon." placeholderTextColor="#9CA3AF" />
            </View>
          )}
        </View>

        {/* Delivery */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}><Truck size={18} color="#5A2D82" /><Text style={styles.cardTitle}>Delivery</Text></View>
          <View style={styles.toggleRow}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Free delivery for all orders</Text>
              <Text style={styles.hint}>Overrides every zone below while on.</Text>
            </View>
            <Switch value={freeDelivery} onValueChange={setFreeDelivery} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Free delivery above (₦)</Text>
            <TextInput style={styles.input} value={freeThreshold} onChangeText={setFreeThreshold} keyboardType="number-pad" placeholder="0 = off" placeholderTextColor="#9CA3AF" />
            <Text style={styles.hint}>Orders at or above this subtotal ship free. Set 0 to disable.</Text>
          </View>

          <View style={styles.zonesHeaderRow}>
            <Text style={styles.subheading}>Delivery zones</Text>
            <Pressable style={styles.addZoneBtn} onPress={openAddZone}><Plus size={16} color="#FFFFFF" /><Text style={styles.addZoneText}>Add zone</Text></Pressable>
          </View>
          <Text style={styles.hint}>The first zone whose keyword appears in the delivery address sets the fee. The default zone is used when nothing matches.</Text>

          {zones.map((z) => (
            <View key={z.id} style={styles.zoneRow}>
              <View style={styles.flex1}>
                <View style={styles.zoneNameRow}>
                  {z.is_default ? <Star size={13} color="#F59E0B" /> : <MapPin size={13} color="#5A2D82" />}
                  <Text style={styles.zoneName}>{z.name}</Text>
                  {!z.active && <Text style={styles.inactiveTag}>Off</Text>}
                </View>
                <Text style={styles.zoneMeta}>{naira(z.fee_ngn)}{z.is_default ? ' · default (fallback)' : z.match_keywords?.length ? ` · ${z.match_keywords.slice(0, 4).join(', ')}${z.match_keywords.length > 4 ? '…' : ''}` : ''}</Text>
              </View>
              <Pressable style={[styles.zoneAction, styles.editAction]} onPress={() => openEditZone(z)}><Edit3 size={14} color="#FFFFFF" /></Pressable>
              <Pressable style={[styles.zoneAction, styles.deleteAction]} onPress={() => deleteZone(z)}><Trash2 size={14} color="#FFFFFF" /></Pressable>
            </View>
          ))}
          {zones.length === 0 && <Text style={styles.emptyZones}>No zones yet. Add one to charge delivery.</Text>}
        </View>

        {/* Fees */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}><Percent size={18} color="#5A2D82" /><Text style={styles.cardTitle}>Fees & limits</Text></View>
          <View style={styles.field}>
            <Text style={styles.label}>Service fee (%)</Text>
            <TextInput style={styles.input} value={serviceFeePct} onChangeText={setServiceFeePct} keyboardType="decimal-pad" placeholder="2" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Tax / VAT (%)</Text>
            <TextInput style={styles.input} value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" placeholder="7.5" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Minimum order (₦)</Text>
            <TextInput style={styles.input} value={minimumOrder} onChangeText={setMinimumOrder} keyboardType="number-pad" placeholder="1000" placeholderTextColor="#9CA3AF" />
          </View>
        </View>

        <Pressable style={[styles.saveBtn, saving && styles.disabled]} disabled={saving} onPress={() => void saveSettings()}>
          <Save size={17} color="#FFFFFF" /><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save settings'}</Text>
        </Pressable>
      </ScrollView>

      {/* Zone modal */}
      <Modal visible={showZoneModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowZoneModal(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingZone ? 'Edit zone' : 'Add zone'}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowZoneModal(false)}><X size={20} color="#6B7280" /></Pressable>
              <Pressable style={styles.modalSaveBtn} onPress={() => void saveZone()}><Save size={16} color="#FFFFFF" /><Text style={styles.modalSaveText}>Save</Text></Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.field}>
              <Text style={styles.label}>Zone name</Text>
              <TextInput style={styles.input} value={zoneForm.name} onChangeText={(t) => setZoneForm((p) => ({ ...p, name: t }))} placeholder="e.g. Lagos" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Delivery fee (₦)</Text>
              <TextInput style={styles.input} value={zoneForm.fee_ngn} onChangeText={(t) => setZoneForm((p) => ({ ...p, fee_ngn: t }))} keyboardType="number-pad" placeholder="3500" placeholderTextColor="#9CA3AF" />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Default (fallback) zone</Text>
                <Text style={styles.hint}>Used when no other zone matches. Only one zone can be the default; keywords are ignored.</Text>
              </View>
              <Switch value={zoneForm.is_default} onValueChange={(v) => setZoneForm((p) => ({ ...p, is_default: v }))} />
            </View>
            {!zoneForm.is_default && (
              <View style={styles.field}>
                <Text style={styles.label}>Match keywords</Text>
                <TextInput style={[styles.input, styles.multiline]} value={zoneForm.keywords} onChangeText={(t) => setZoneForm((p) => ({ ...p, keywords: t }))} multiline autoCapitalize="none" placeholder="lagos, ikeja, lekki" placeholderTextColor="#9CA3AF" />
                <Text style={styles.hint}>Comma-separated. Matched against the customer's full delivery address (case-insensitive).</Text>
              </View>
            )}
            <View style={styles.toggleRow}>
              <View style={styles.flex1}>
                <Text style={styles.label}>Active</Text>
                <Text style={styles.hint}>Inactive zones are ignored at checkout.</Text>
              </View>
              <Switch value={zoneForm.active} onValueChange={(v) => setZoneForm((p) => ({ ...p, active: v }))} />
            </View>
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#EDEAF1' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#17131C' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  flex1: { flex: 1 },
  field: { marginTop: 12 },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#374151', marginBottom: 6 },
  hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, color: '#746D79', marginTop: 4 },
  input: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C', backgroundColor: '#FFFFFF' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  subheading: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#17131C' },
  zonesHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  addZoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#5A2D82', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addZoneText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 13 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EDF4' },
  zoneNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  zoneName: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#17131C' },
  inactiveTag: { fontFamily: 'Inter-SemiBold', fontSize: 10, color: '#B91C1C', backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  zoneMeta: { fontFamily: 'Inter-Regular', fontSize: 12, color: '#6B7280', marginTop: 3 },
  zoneAction: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  editAction: { backgroundColor: '#3B82F6' },
  deleteAction: { backgroundColor: '#EF4444' },
  emptyZones: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#9CA3AF', marginTop: 14 },
  saveBtn: { minHeight: 50, borderRadius: 10, backgroundColor: '#5A2D82', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveText: { fontFamily: 'Inter-SemiBold', fontSize: 15, color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  modalSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#5A2D82', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, gap: 6 },
  modalSaveText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingVertical: 16 },
});
