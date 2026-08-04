import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ShoppingBag, Plus, Sparkles, Truck, RotateCcw, ShieldCheck } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { colorToHex } from '@/lib/colors';
import { fetchLookById, fetchLooks, lookTotalNGN } from '@/lib/outfits';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, CartItem } from '@/contexts/CartContext';
import { usePostHog } from 'posthog-react-native';
import ProductModal from '@/features/customer/shared/productModal/components/ProductModal';
import LookCard from '@/components/LookCard';
import type { StoreProduct } from '@/types/product';
import type { OutfitWithProducts } from '@/types/outfit';

const BRAND_PURPLE = '#5A2D82';
const BRAND_GOLD = '#FDB813';

export default function LookDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const posthog = usePostHog();

  const [look, setLook] = useState<OutfitWithProducts | null>(null);
  const [moreLooks, setMoreLooks] = useState<OutfitWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingAll, setAddingAll] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  const userCurrency = profile?.preferred_currency || 'NGN';
  const toUserPrice = (ngn: number) => (userCurrency === 'NGN' ? ngn : convertFromNGN(ngn, userCurrency));

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setLoading(true);
    (async () => {
      const [one, all] = await Promise.all([fetchLookById(String(id)), fetchLooks()]);
      if (cancelled) return;
      setLook(one);
      setMoreLooks(all.filter((l) => l.id !== id).slice(0, 6));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const openProduct = (p: StoreProduct) => { setSelectedProduct(p); setShowProductModal(true); };

  const getTheCompleteFit = async () => {
    if (!look) return;
    const inStock = look.products.filter((p) => p.stock > 0);
    if (inStock.length === 0) { Alert.alert('Sold out', 'The pieces in this fit are currently out of stock.'); return; }
    setAddingAll(true);
    try {
      const cartItems: CartItem[] = inStock.map((p) => ({
        productId: p.id,
        productName: p.name,
        productImage: p.image_url,
        price: p.price,
        size: p.sizes?.[0] ?? '',
        color: p.colors?.[0] ?? '',
        quantity: 1,
      }));
      await addToCart(cartItems);
      posthog?.capture('outfit_added_to_cart', {
        outfit_id: look.id, occasion: look.occasion, items: cartItems.length,
        total_ngn: inStock.reduce((s, p) => s + p.price, 0),
      });
      Alert.alert(
        'Added to cart',
        `${cartItems.length} piece${cartItems.length > 1 ? 's' : ''} from "${look.title}" added. Adjust sizes and colours in your cart.`,
        [
          { text: 'Keep browsing', style: 'cancel' },
          { text: 'View cart', onPress: () => router.push('/(customer)/cart') },
        ],
      );
    } catch {
      Alert.alert('Could not add', 'Something went wrong. Please try again.');
    } finally {
      setAddingAll(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}><View style={styles.centered}><ActivityIndicator size="large" color={BRAND_PURPLE} /></View></SafeAreaView>
    );
  }

  if (!look) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}><ArrowLeft size={22} color={BRAND_PURPLE} /></Pressable>
          <Text style={styles.headerTitle}>Fit</Text><View style={styles.backButton} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>This fit isn&apos;t available</Text>
          <Text style={styles.emptyText}>It may have been unpublished. Explore our latest arrivals instead.</Text>
          <Pressable style={styles.shopButton} onPress={() => router.replace('/(customer)/shop')}><Text style={styles.shopButtonText}>Shop the collection</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const total = toUserPrice(lookTotalNGN(look));
  const allSoldOut = look.products.every((p) => p.stock <= 0);
  const cover = look.cover_image || look.products[0]?.image_url;
  const pieceLabel = `${look.products.length} piece${look.products.length > 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Editorial hero with immediate shopping action */}
        <View style={styles.hero}>
          {!!cover && (
            <Image source={{ uri: optimizeImageUrl(cover, { width: 1000 }) as string }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}
          <LinearGradient colors={['rgba(0,0,0,0.35)', 'transparent', 'rgba(0,0,0,0.85)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} />
          <Pressable style={styles.heroBack} onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back"><ArrowLeft size={22} color="#FFFFFF" /></Pressable>
          <View style={styles.heroOverlay}>
            <Text style={styles.heroEyebrow}>{look.occasion?.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{look.title}</Text>
            {!!look.subtitle && <Text style={styles.heroSubtitle}>{look.subtitle}</Text>}
            <Pressable style={[styles.heroCta, allSoldOut && styles.ctaDisabled]} onPress={getTheCompleteFit} disabled={addingAll || allSoldOut}>
              {addingAll ? <ActivityIndicator size="small" color="#FFFFFF" /> : (<><ShoppingBag size={18} color="#FFFFFF" /><Text style={styles.heroCtaText}>{allSoldOut ? 'Sold out' : 'Get this fit'}</Text></>)}
            </Pressable>
            <Text style={styles.heroMeta}>{pieceLabel} • {formatCurrency(total, userCurrency)}</Text>
          </View>
        </View>

        {/* Trust & delivery details */}
        <View style={styles.trustCard}>
          <View style={styles.trustRow}><Truck size={17} color={BRAND_PURPLE} /><Text style={styles.trustText}>Fast delivery - 2–7 days across Nigeria</Text></View>
          <Pressable style={styles.trustRow} onPress={() => router.push('/(customer)/returns')}>
            <RotateCcw size={17} color={BRAND_PURPLE} /><Text style={styles.trustText}>Easy returns &amp; exchanges</Text>
          </Pressable>
          <View style={[styles.trustRow, styles.trustRowLast]}><ShieldCheck size={17} color={BRAND_PURPLE} /><Text style={styles.trustText}>Secure checkout · buyer protection</Text></View>
        </View>

        {/* Why this works (shown only when a stylist note exists) */}
        {!!look.stylist_note && (
          <View style={styles.whyCard}>
            <View style={styles.whyHead}><Sparkles size={15} color={BRAND_GOLD} /><Text style={styles.whyTitle}>Why this works</Text></View>
            <Text style={styles.whyText}>{look.stylist_note}</Text>
          </View>
        )}

        {/* Worn in this look - visual product cards */}
        <View style={styles.wornHeader}>
          <View style={styles.accentBar} />
          <Text style={styles.wornTitle}>Everything in this fit</Text>
          <Text style={styles.wornCaption}>Shop each piece below, or get this fit above.</Text>
        </View>
        <View style={styles.grid}>
          {look.products.map((p) => {
            const soldOut = p.stock <= 0;
            return (
              <Pressable key={p.id} style={styles.pCard} onPress={() => openProduct(p)}>
                <View style={styles.pImageWrap}>
                  <Image source={{ uri: optimizeImageUrl(p.image_url, { width: 400 }) as string }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  {soldOut && <View style={styles.pSoldOut}><Text style={styles.pSoldOutText}>Sold out</Text></View>}
                </View>
                <Text style={styles.pName} numberOfLines={1}>{p.name}</Text>
                {!!p.subtitle && <Text style={styles.pSub} numberOfLines={1}>{p.subtitle}</Text>}
                <Text style={styles.pPrice}>{formatCurrency(toUserPrice(p.price), userCurrency)}</Text>
                {p.colors?.length > 0 && (
                  <View style={styles.swatchRow}>
                    {p.colors.slice(0, 5).map((c, i) => (
                      <View key={`${c}-${i}`} style={[styles.swatch, { backgroundColor: colorToHex(c) }]} />
                    ))}
                    {p.colors.length > 5 && <Text style={styles.swatchMore}>+{p.colors.length - 5}</Text>}
                  </View>
                )}
                <Pressable style={[styles.addBtn, soldOut && styles.addBtnDisabled]} onPress={() => openProduct(p)} disabled={soldOut}>
                  <Plus size={15} color={soldOut ? '#B8AFC2' : BRAND_PURPLE} strokeWidth={2.5} />
                  <Text style={[styles.addBtnText, soldOut && styles.addBtnTextDisabled]}>Add</Text>
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        {/* More edits - keep customers inside the editorial experience */}
        {moreLooks.length > 0 && (
          <View style={styles.moreSection}>
            <Text style={styles.sectionHeading}>More fits</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moreRow}>
              {moreLooks.map((l) => (
                <View key={l.id} style={{ width: 220 }}>
                  <LookCard look={l} variant="carousel" width={220} onPress={() => router.push(`/(customer)/look/${l.id}` as any)} />
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Persistent buy bar */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{pieceLabel}</Text>
          <Text style={styles.footerTotal}>{formatCurrency(total, userCurrency)}</Text>
        </View>
        <Pressable style={[styles.footerCta, allSoldOut && styles.ctaDisabled]} onPress={getTheCompleteFit} disabled={addingAll || allSoldOut}>
          {addingAll ? <ActivityIndicator size="small" color="#FFFFFF" /> : (<><ShoppingBag size={18} color="#FFFFFF" /><Text style={styles.footerCtaText}>{allSoldOut ? 'Sold out' : 'Get this fit'}</Text></>)}
        </Pressable>
      </View>

      <ProductModal
        product={selectedProduct}
        visible={showProductModal}
        onClose={() => { setShowProductModal(false); setSelectedProduct(null); }}
        onOrderSuccess={() => { setShowProductModal(false); setSelectedProduct(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E3EB' },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  shopButton: { marginTop: 12, backgroundColor: BRAND_PURPLE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  shopButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },

  hero: { width: '100%', aspectRatio: 4 / 5, backgroundColor: '#17131C', justifyContent: 'flex-end' },
  heroBack: { position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroOverlay: { padding: 20 },
  heroEyebrow: { fontSize: 12, fontFamily: 'Inter-Bold', color: BRAND_GOLD, letterSpacing: 1.8, marginBottom: 6 },
  heroTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.85)', marginTop: 6, lineHeight: 20 },
  heroCta: { marginTop: 16, backgroundColor: BRAND_PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 12 },
  heroCtaText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 15 },
  heroMeta: { fontSize: 13, fontFamily: 'Inter-Medium', color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 10 },
  ctaDisabled: { backgroundColor: '#8A7F97' },

  trustCard: { marginHorizontal: 16, marginTop: 14, backgroundColor: '#F9F7FB', borderRadius: 12, borderWidth: 1, borderColor: '#EDEAF1', paddingHorizontal: 14 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDEAF1' },
  trustRowLast: { borderBottomWidth: 0 },
  trustText: { flex: 1, fontSize: 13.5, fontFamily: 'Inter-Medium', color: '#374151' },
  whyCard: { margin: 16, marginBottom: 4, backgroundColor: '#F6F1FB', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E7DEF3' },
  whyHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  whyTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: BRAND_PURPLE, letterSpacing: 0.4 },
  whyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4A4453', lineHeight: 21 },

  sectionHeading: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', marginHorizontal: 16, marginTop: 22, marginBottom: 12 },
  wornHeader: { paddingHorizontal: 16, marginTop: 24, marginBottom: 12 },
  accentBar: { width: 30, height: 3, borderRadius: 2, backgroundColor: BRAND_GOLD, marginBottom: 10 },
  wornTitle: { fontSize: 21, fontFamily: 'Inter-Bold', color: '#17131C', letterSpacing: -0.3 },
  wornCaption: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7A7380', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16 },
  pCard: { width: '48%', marginBottom: 18 },
  pImageWrap: { width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  pSoldOut: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pSoldOutText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 10 },
  pName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#17131C', marginTop: 8 },
  pSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7380', marginTop: 1 },
  pPrice: { fontSize: 14, fontFamily: 'Inter-Bold', color: BRAND_PURPLE, marginTop: 2 },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#E5E7EB' },
  swatchMore: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#7A7380' },
  addBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1.5, borderColor: BRAND_PURPLE, borderRadius: 10, minHeight: 40 },
  addBtnDisabled: { borderColor: '#E0DAE6' },
  addBtnText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: BRAND_PURPLE },
  addBtnTextDisabled: { color: '#B8AFC2' },

  moreSection: { marginTop: 8 },
  moreRow: { gap: 12, paddingHorizontal: 16, paddingBottom: 8 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E8E3EB' },
  footerLabel: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#7A7380' },
  footerTotal: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 2 },
  footerCta: { backgroundColor: BRAND_PURPLE, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, minHeight: 50, borderRadius: 12, justifyContent: 'center' },
  footerCtaText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 15 },
});
