import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Package, X, Minus, Plus } from 'lucide-react-native';
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

interface B2BPackage {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number | null;
}

function formatNaira(n: number | null): string {
  return n == null ? '-' : `₦${n.toLocaleString('en-NG')}`;
}

const PAGE_SIZE = 10;

export default function CorporateProductsScreen() {
  const router = useRouter();
  const { isDesktop, isWideDesktop } = useDesktopLayout();
  const { addItem, getTotalPieces } = useQuoteBasket();
  const basketCount = getTotalPieces();

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [packages, setPackages] = useState<B2BPackage[]>([]);
  const [page, setPage] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<B2BPackage | null>(null);
  const [packageCount, setPackageCount] = useState(20);
  const [packageAdded, setPackageAdded] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: pk }] = await Promise.all([
        supabase.from('b2b_products').select('*').order('sort_order', { ascending: true }),
        supabase.from('b2b_packages').select('*').order('sort_order', { ascending: true }),
      ]);
      setProducts((p || []) as B2BProduct[]);
      setPackages((pk || []) as B2BPackage[]);
      setLoading(false);
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const pagedProducts = useMemo(
    () => products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [products, page]
  );

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
            {pagedProducts.map((item) => (
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

          {totalPages > 1 && (
            <View style={styles.paginationRow}>
              <Pressable
                disabled={page === 1}
                style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.pageIndicator}>Page {page} of {totalPages}</Text>
              <Pressable
                disabled={page === totalPages}
                style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          )}

          {packages.length > 0 && (
            <View style={styles.packagesSection}>
              <Text style={styles.packagesSectionTitle}>Event Packages</Text>
              <Text style={styles.packagesSectionSub}>Bundled sets priced per person - easier to budget for a full attendee list.</Text>
              <View style={isDesktop && styles.packageGrid}>
                {packages.map((pkg) => (
                  <Pressable
                    key={pkg.id}
                    style={[styles.packageCard, isDesktop && styles.packageCardDesktop]}
                    onPress={() => { setSelectedPackage(pkg); setPackageCount(20); setPackageAdded(false); }}
                  >
                    <View style={styles.packageIcon}><Package size={18} color={BRAND.purple} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageName}>{pkg.name}</Text>
                      {pkg.description ? <Text style={styles.packageDesc} numberOfLines={1}>{pkg.description}</Text> : null}
                    </View>
                    <Text style={styles.packagePrice}>{formatNaira(pkg.price_per_person)}<Text style={styles.packagePriceUnit}>/person</Text></Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

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

      <Modal visible={!!selectedPackage} animationType="slide" transparent onRequestClose={() => setSelectedPackage(null)}>
        <View style={styles.packageModalBackdrop}>
          <View style={styles.packageModalCard}>
            <View style={styles.packageModalHeader}>
              <View style={styles.packageIcon}><Package size={18} color={BRAND.purple} /></View>
              <Pressable onPress={() => setSelectedPackage(null)} hitSlop={8}>
                <X size={22} color="#6B7280" />
              </Pressable>
            </View>
            {selectedPackage && (
              <>
                <Text style={styles.packageModalName}>{selectedPackage.name}</Text>
                <Text style={styles.packageModalPrice}>{formatNaira(selectedPackage.price_per_person)}<Text style={styles.packagePriceUnit}> / person</Text></Text>
                {selectedPackage.description ? <Text style={styles.packageModalDesc}>{selectedPackage.description}</Text> : null}

                <Text style={styles.qtyLabel}>Number of People</Text>
                <View style={styles.qtyRow}>
                  <Pressable style={styles.qtyBtn} onPress={() => setPackageCount((c) => Math.max(1, c - 5))}>
                    <Minus size={16} color={BRAND.purple} />
                  </Pressable>
                  <TextInput
                    style={styles.qtyInput}
                    value={String(packageCount)}
                    onChangeText={(t) => setPackageCount(Math.max(1, parseInt(t.replace(/[^0-9]/g, ''), 10) || 0))}
                    keyboardType="number-pad"
                    textAlign="center"
                  />
                  <Pressable style={styles.qtyBtn} onPress={() => setPackageCount((c) => c + 5)}>
                    <Plus size={16} color={BRAND.purple} />
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.quoteBtn, packageAdded && styles.quoteBtnDone]}
                  onPress={async () => {
                    await addItem({
                      productId: `package:${selectedPackage.id}`,
                      productName: selectedPackage.name,
                      photoUrl: null,
                      quantity: packageCount,
                      type: 'package',
                    });
                    setPackageAdded(true);
                  }}
                >
                  <Text style={styles.quoteBtnText}>{packageAdded ? 'Added to Quote ✓' : 'Add to Quote'}</Text>
                </Pressable>
                {packageAdded && (
                  <Pressable style={styles.viewQuoteLink} onPress={() => { setSelectedPackage(null); router.push('/corporate/quote' as any); }}>
                    <Text style={styles.viewQuoteLinkText}>Continue browsing, or build your quote →</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
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

  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4B5563' },
  pageIndicator: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },

  packageModalBackdrop: { flex: 1, backgroundColor: 'rgba(10,6,16,0.5)', justifyContent: 'flex-end' },
  packageModalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 },
  packageModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  packageModalName: { fontSize: 19, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 4 },
  packageModalPrice: { fontSize: 16, fontFamily: 'Inter-Bold', color: BRAND.purple, marginBottom: 14 },
  packageModalDesc: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 20 },

  qtyLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  qtyBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', minWidth: 50, textAlign: 'center' },
  qtyInput: {
    fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', minWidth: 70,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingVertical: 8,
  },
  quoteBtnDone: { backgroundColor: '#10B981' },
  viewQuoteLink: { alignItems: 'center', paddingVertical: 12 },
  viewQuoteLinkText: { color: BRAND.purple, fontSize: 13, fontFamily: 'Inter-Bold' },

  packagesSection: { marginTop: 32 },
  packagesSectionTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 6 },
  packagesSectionSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 19, marginBottom: 16 },
  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  packageCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#EDE9F6' },
  packageCardDesktop: { width: '48%', marginBottom: 0 },
  packageIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  packageName: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937' },
  packageDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF', marginTop: 2 },
  packagePrice: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND.purple },
  packagePriceUnit: { fontSize: 10.5, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

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
