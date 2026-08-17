import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calculator } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { smartBack } from '@/lib/navigation';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const PRINT_METHOD_LABELS: Record<string, string> = {
  screen_print: 'Screen Print',
  embroidery: 'Embroidery',
};

interface PricingTier {
  id: string;
  product_name: string;
  print_method: string | null;
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
}

function formatNaira(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`;
}

function tierRangeLabel(t: PricingTier): string {
  return t.max_qty ? `${t.min_qty}-${t.max_qty}` : `${t.min_qty}+`;
}

export default function B2BPricingScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [product, setProduct] = useState<string | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('b2b_pricing_tiers')
        .select('*')
        .order('product_name', { ascending: true })
        .order('min_qty', { ascending: true });
      if (!error) setTiers((data || []) as PricingTier[]);
      setLoading(false);
    })();
  }, []);

  const products = useMemo(() => Array.from(new Set(tiers.map((t) => t.product_name))), [tiers]);

  useEffect(() => {
    if (!product && products.length > 0) setProduct(products[0]);
  }, [products, product]);

  const productTiers = useMemo(() => tiers.filter((t) => t.product_name === product), [tiers, product]);

  const methodsForProduct = useMemo(
    () => Array.from(new Set(productTiers.map((t) => t.print_method).filter(Boolean))) as string[],
    [productTiers]
  );

  useEffect(() => {
    setMethod(methodsForProduct.length > 0 ? methodsForProduct[0] : null);
  }, [product, methodsForProduct.length]);

  const qty = parseInt(qtyText, 10) || 0;

  const matchedTier = useMemo(() => {
    if (qty <= 0) return null;
    const candidates = productTiers.filter(
      (t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty)
    );
    if (candidates.length === 0) return null;
    const exact = candidates.find((t) => t.print_method === method);
    return exact || candidates.find((t) => !t.print_method) || candidates[0];
  }, [productTiers, qty, method]);

  const displayedTiers = useMemo(
    () => (methodsForProduct.length > 0 ? productTiers.filter((t) => t.print_method === method || !t.print_method) : productTiers),
    [productTiers, method, methodsForProduct.length]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => smartBack(router, '/corporate' as any)}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={BRAND.purple} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>B2B Pricing</Text>
          <Text style={styles.headerSub}>Transparent volume pricing for bulk & corporate orders</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND.purple} /></View>
      ) : tiers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Pricing is being finalised - request a quote and we'll get back to you.</Text>
          <Pressable style={styles.quoteBtn} onPress={() => router.push('/corporate' as any)}>
            <Text style={styles.quoteBtnText}>Request a Quote</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.calcCard}>
            <View style={styles.calcHeaderRow}>
              <Calculator size={18} color={BRAND.purple} />
              <Text style={styles.calcTitle}>Price Calculator</Text>
            </View>

            <Text style={styles.label}>Product</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {products.map((p) => (
                <Pressable key={p} style={[styles.chip, product === p && styles.chipActive]} onPress={() => setProduct(p)}>
                  <Text style={[styles.chipText, product === p && styles.chipTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {methodsForProduct.length > 0 && (
              <>
                <Text style={styles.label}>Print Method</Text>
                <View style={styles.chipRow}>
                  {methodsForProduct.map((m) => (
                    <Pressable key={m} style={[styles.chip, method === m && styles.chipActive]} onPress={() => setMethod(m)}>
                      <Text style={[styles.chipText, method === m && styles.chipTextActive]}>{PRINT_METHOD_LABELS[m] || m}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.qtyInput}
              value={qtyText}
              onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 50"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
            />

            {qty > 0 && (
              matchedTier ? (
                <View style={styles.resultBox}>
                  <Text style={styles.resultUnit}>{formatNaira(matchedTier.unit_price)} / piece</Text>
                  <Text style={styles.resultTotal}>{formatNaira(matchedTier.unit_price * qty)} total for {qty} pieces</Text>
                </View>
              ) : (
                <View style={styles.resultBox}>
                  <Text style={styles.resultNoMatch}>No tier covers {qty} pieces yet - request a quote and we'll price it for you.</Text>
                </View>
              )
            )}
          </View>

          <Text style={styles.tableTitle}>{product} - Full Price Breakdown</Text>
          <View style={styles.table}>
            {displayedTiers.map((t) => (
              <View key={t.id} style={[styles.tableRow, matchedTier?.id === t.id && styles.tableRowActive]}>
                <Text style={styles.tableRange}>{tierRangeLabel(t)} pieces</Text>
                <Text style={styles.tablePrice}>{formatNaira(t.unit_price)}<Text style={styles.tablePriceUnit}> / piece</Text></Text>
              </View>
            ))}
          </View>

          <Text style={styles.note}>
            Prices cover a single-colour logo in one placement. Multi-colour logos, extra placements, or custom garment colours may adjust final pricing - confirmed at quote stage.
          </Text>

          <Pressable style={styles.quoteBtnLarge} onPress={() => router.push('/corporate' as any)}>
            <Text style={styles.quoteBtnText}>Request a Formal Quote</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 16, paddingBottom: 48 },

  calcCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#EDEAF1', marginBottom: 24 },
  calcHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  calcTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#17131C' },

  label: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 8, marginTop: 14 },
  chipScroll: { marginHorizontal: -2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  chipActive: { backgroundColor: BRAND.purple, borderColor: BRAND.purple },
  chipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  chipTextActive: { color: '#FFF' },

  qtyInput: { minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C', backgroundColor: '#FFFFFF' },

  resultBox: { marginTop: 16, backgroundColor: '#F3F0F8', borderRadius: 12, padding: 14 },
  resultUnit: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND.purple },
  resultTotal: { fontSize: 19, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 4 },
  resultNoMatch: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 19 },

  tableTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 10 },
  table: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EDEAF1', overflow: 'hidden', marginBottom: 20 },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  tableRowActive: { backgroundColor: '#F3F0F8' },
  tableRange: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#374151' },
  tablePrice: { fontSize: 15, fontFamily: 'Inter-Bold', color: BRAND.purple },
  tablePriceUnit: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  note: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 18, marginBottom: 24 },

  quoteBtn: { backgroundColor: BRAND.purple, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  quoteBtnLarge: { backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  quoteBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-Bold' },
});
