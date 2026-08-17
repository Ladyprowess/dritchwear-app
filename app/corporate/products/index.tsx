import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
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

export default function CorporateProductsScreen() {
  const router = useRouter();
  const { isDesktop, isWideDesktop } = useDesktopLayout();
  const { getTotalPieces } = useQuoteBasket();
  const basketCount = getTotalPieces();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<B2BProduct[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('b2b_products').select('*').order('sort_order', { ascending: true });
      setProducts((data || []) as B2BProduct[]);
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
          <Pressable style={styles.backButton} onPress={() => smartBack(router, '/corporate' as any)} accessibilityRole="button" accessibilityLabel="Back">
            <ArrowLeft size={20} color={BRAND.purple} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Browse Merchandise</Text>
            <Text style={styles.headerSub}>Prices below are per-piece garment estimates. See each product for full details.</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={BRAND.purple} /></View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Our catalogue is being finalised - request a quote and we'll send pricing directly.</Text>
          <Pressable style={styles.quoteBtn} onPress={() => router.push('/corporate/quote' as any)}>
            <Text style={styles.quoteBtnText}>Request a Quote</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
          <View style={isDesktop && styles.grid}>
            {products.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.card, isDesktop && styles.cardDesktop, isWideDesktop && styles.cardWide]}
                onPress={() => router.push(`/corporate/products/${item.id}` as any)}
              >
                {item.photo_url && <Image source={{ uri: item.photo_url }} style={[styles.photo, isDesktop && styles.photoDesktop]} resizeMode="cover" />}
                <View style={styles.body}>
                  <Text style={styles.name}>{item.name}</Text>
                  {item.fabric_spec ? <Text style={styles.spec}>{item.fabric_spec}</Text> : null}
                  <Text style={styles.priceFrom}>{formatNaira(item.price_100_plus ?? item.price_50_99 ?? item.price_20_49)} <Text style={styles.priceFromUnit}>from {item.min_qty} pieces</Text></Text>
                  {item.sizes.length > 0 && <Text style={styles.spec}>Sizes {item.sizes.join(', ')}</Text>}
                  <View style={styles.linkRow}>
                    <Text style={styles.linkText}>View Product</Text>
                    <ChevronRight size={14} color={BRAND.purple} />
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
          <Text style={styles.disclaimer}>
            Prices shown are product and standard branding estimates. Final pricing is confirmed after we review your logo, specifications and quantity.
          </Text>
        </ScrollView>
      )}

      {basketCount > 0 && (
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
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  header: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 20, paddingVertical: 16 },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: 1120, alignSelf: 'center', width: '100%' },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 16, paddingBottom: 100 },
  contentDesktop: { padding: 40, maxWidth: 1120, alignSelf: 'center', width: '100%' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EDE9F6' },
  cardDesktop: { flexDirection: 'column', width: '48%', marginBottom: 0 },
  cardWide: { width: '31.5%' },
  photo: { width: 76, height: 76, borderRadius: 12, backgroundColor: '#F3F4F6' },
  photoDesktop: { width: '100%', height: 200, marginBottom: 12 },
  body: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 3 },
  spec: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 16 },
  priceFrom: { fontSize: 15, fontFamily: 'Inter-Bold', color: BRAND.purple, marginTop: 6, marginBottom: 4 },
  priceFromUnit: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  linkText: { fontSize: 13, fontFamily: 'Inter-Bold', color: BRAND.purple },

  disclaimer: { fontSize: 11.5, fontFamily: 'Inter-Regular', color: '#9CA3AF', lineHeight: 17, marginTop: 20, textAlign: 'center' },

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
