import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Minus, Plus, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { smartBack } from '@/lib/navigation';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useQuoteBasket } from '@/contexts/QuoteBasketContext';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

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

function formatNaira(n: number | null): string {
  return n == null ? '-' : `₦${n.toLocaleString('en-NG')}`;
}

export default function CorporateProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isDesktop } = useDesktopLayout();
  const { addItem, getTotalPieces } = useQuoteBasket();

  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<B2BProduct | null>(null);
  const [quantity, setQuantity] = useState(10);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('b2b_products').select('*').eq('id', id).single();
      const p = data as B2BProduct | null;
      setProduct(p);
      if (p) setQuantity(p.min_qty || 10);
      setLoading(false);
    })();
  }, [id]);

  const handleAddToQuote = async () => {
    if (!product) return;
    if (quantity < product.min_qty) {
      Alert.alert('Quantity too low', `The minimum order for this item is ${product.min_qty} pieces.`);
      return;
    }
    await addItem({ productId: product.id, productName: product.name, photoUrl: product.photo_url, quantity });
    setAdded(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={BRAND.purple} /></View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>This product could not be found.</Text>
          <Pressable style={styles.quoteBtn} onPress={() => router.push('/corporate/products' as any)}>
            <Text style={styles.quoteBtnText}>Back to Products</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const basketCount = getTotalPieces();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
          <Pressable style={styles.backButton} onPress={() => smartBack(router, '/corporate/products' as any)} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={20} color={BRAND.purple} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
        <View style={isDesktop && styles.detailRow}>
          {product.photo_url ? (
            <Image source={{ uri: product.photo_url }} style={[styles.photo, isDesktop && styles.photoDesktop]} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder, isDesktop && styles.photoDesktop]} />
          )}

          <View style={isDesktop && styles.detailCol}>
            <Text style={styles.name}>{product.name}</Text>
            {product.fabric_spec ? <Text style={styles.spec}>{product.fabric_spec}</Text> : null}
            {product.colors.length > 0 && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Colours</Text>
                <Text style={styles.specValue}>{product.colors.join(', ')}</Text>
              </View>
            )}
            {product.sizes.length > 0 && (
              <View style={styles.specRow}>
                <Text style={styles.specLabel}>Sizes</Text>
                <Text style={styles.specValue}>{product.sizes.join(', ')}</Text>
              </View>
            )}
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Branding</Text>
              <Text style={styles.specValue}>Screen print or embroidery</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Minimum order</Text>
              <Text style={styles.specValue}>{product.min_qty} pieces</Text>
            </View>

            <Text style={styles.priceTitle}>Price Tiers</Text>
            <View style={styles.priceLadder}>
              <View style={styles.priceRow}><Text style={styles.priceRange}>10-49</Text><Text style={styles.priceValue}>{formatNaira(product.price_20_49)} / piece</Text></View>
              <View style={styles.priceRow}><Text style={styles.priceRange}>50-99</Text><Text style={styles.priceValue}>{formatNaira(product.price_50_99)} / piece</Text></View>
              <View style={styles.priceRow}><Text style={styles.priceRange}>100+</Text><Text style={styles.priceValue}>{formatNaira(product.price_100_plus)} / piece</Text></View>
            </View>
            {product.branding_note ? <Text style={styles.brandingNote}>* {product.branding_note}</Text> : null}
            <Text style={styles.disclaimer}>
              Prices shown are product and standard branding estimates. Final pricing is confirmed after we review your logo, specifications and quantity.
            </Text>

            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyRow}>
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => Math.max(product.min_qty, q - 10))}>
                <Minus size={16} color={BRAND.purple} />
              </Pressable>
              <TextInput
                style={styles.qtyInput}
                value={String(quantity)}
                onChangeText={(t) => setQuantity(Math.max(1, parseInt(t.replace(/[^0-9]/g, ''), 10) || 0))}
                keyboardType="number-pad"
                textAlign="center"
              />
              <Pressable style={styles.qtyBtn} onPress={() => setQuantity((q) => q + 10)}>
                <Plus size={16} color={BRAND.purple} />
              </Pressable>
            </View>

            <Pressable style={[styles.addBtn, added && styles.addBtnDone]} onPress={handleAddToQuote}>
              <Text style={styles.addBtnText}>{added ? 'Added to Quote ✓' : 'Add to Quote'}</Text>
            </Pressable>
            {added && (
              <Pressable style={styles.viewQuoteLink} onPress={() => router.push('/corporate/quote' as any)}>
                <Text style={styles.viewQuoteLinkText}>Continue browsing, or build your quote →</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {basketCount > 0 && !added && (
        <Pressable style={styles.basketBar} onPress={() => router.push('/corporate/quote' as any)}>
          <Text style={styles.basketBarText}>Build Your Quote ({basketCount} pieces)</Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },

  header: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 20, paddingVertical: 16 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: 1120, alignSelf: 'center', width: '100%' },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937', flexShrink: 1 },

  content: { padding: 20, paddingBottom: 100 },
  contentDesktop: { padding: 40, maxWidth: 1120, alignSelf: 'center', width: '100%' },

  detailRow: { flexDirection: 'row', gap: 40, alignItems: 'flex-start' },
  detailCol: { flex: 1 },
  photo: { width: '100%', height: 320, borderRadius: 18, backgroundColor: '#F3F4F6', marginBottom: 20 },
  photoDesktop: { flex: 1, height: 480, marginBottom: 0 },
  photoPlaceholder: { backgroundColor: '#374151' },

  name: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 6 },
  spec: { fontSize: 13.5, fontFamily: 'Inter-Regular', color: '#6B7280', marginBottom: 16 },

  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  specLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  specValue: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#17131C', textAlign: 'right', flexShrink: 1, marginLeft: 12 },

  priceTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 20, marginBottom: 10 },
  priceLadder: { backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#EDE9F6', overflow: 'hidden' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  priceRange: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  priceValue: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND.purple },
  brandingNote: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 10, lineHeight: 17 },
  disclaimer: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 12, lineHeight: 16 },

  qtyLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginTop: 24, marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', minWidth: 50, textAlign: 'center' },
  qtyInput: {
    fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', minWidth: 70,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8,
  },

  addBtn: { backgroundColor: BRAND.purple, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  addBtnDone: { backgroundColor: '#10B981' },
  addBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Inter-Bold' },
  viewQuoteLink: { alignItems: 'center', paddingVertical: 12 },
  viewQuoteLinkText: { color: BRAND.purple, fontSize: 13, fontFamily: 'Inter-Bold' },

  quoteBtn: { backgroundColor: BRAND.purple, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  quoteBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-Bold' },

  basketBar: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    backgroundColor: BRAND.purple, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  basketBarText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-Bold' },
});
