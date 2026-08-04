import React, { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import ResponsiveGrid from '@/components/ResponsiveGrid';
import ProductModal from '@/features/customer/shared/productModal/components/ProductModal';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import type { StoreProduct } from '@/types/product';

export default function WishlistScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  const loadWishlist = useCallback(async () => {
    if (!user?.id) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    const { data: saved, error: savedError } = await supabase.from('wishlists').select('product_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false });
    if (savedError) { setLoading(false); Alert.alert('Wishlist unavailable', 'We could not load your saved products. Please try again.'); return; }
    const ids = (saved ?? []).map((row: any) => row.product_id);
    if (!ids.length) { setProducts([]); setLoading(false); return; }
    const [{ data: productRows, error }, { data: images }] = await Promise.all([
      supabase.from('products').select('*').in('id', ids).eq('is_active', true),
      supabase.from('product_images').select('product_id, image_url').in('product_id', ids).eq('is_primary', true),
    ]);
    if (error) { setLoading(false); Alert.alert('Wishlist unavailable', 'We could not load your saved products. Please try again.'); return; }
    const byId = new Map((productRows ?? []).map((product: any) => [String(product.id), product]));
    setProducts(ids.map((id: string) => {
      const product: any = byId.get(String(id));
      if (!product) return null;
      const primary = (images ?? []).find((image: any) => image.product_id === id);
      return { ...product, image_url: primary?.image_url || product.image_url, categories: Array.isArray(product.categories) ? product.categories : product.category ? [product.category] : [] };
    }).filter(Boolean) as StoreProduct[]);
    setLoading(false);
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void loadWishlist(); }, [loadWishlist]));

  const remove = async (product: StoreProduct) => {
    if (!user?.id) return;
    const previous = products;
    setProducts((current) => current.filter((item) => item.id !== product.id));
    const { error } = await supabase.from('wishlists').delete().eq('user_id', user.id).eq('product_id', product.id);
    if (error) { setProducts(previous); Alert.alert('Could not remove item', 'Please try again.'); }
  };

  const priceText = (item: StoreProduct) =>
    formatCurrency(
      profile?.preferred_currency === 'NGN' || !profile?.preferred_currency
        ? item.price
        : convertFromNGN(item.price, profile.preferred_currency),
      profile?.preferred_currency || 'NGN'
    );

  // Phones: a full-width row card so a single saved item never looks squeezed
  // into a half-width grid column. Tablets/desktop keep the multi-column grid.
  const isPhone = width < 700;

  const renderRowCard = (item: StoreProduct) => (
    <Pressable style={styles.rowCard} onPress={() => setSelectedProduct(item)}>
      <Image source={{ uri: optimizeImageUrl(item.image_url, { width: 200 }) as string }} style={styles.rowImage} resizeMode="cover" />
      <View style={styles.rowBody}>
        <View style={styles.rowInfo}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.price}>{priceText(item)}</Text>
        </View>
        <View style={styles.actions}>
          <View style={styles.viewAction}><ShoppingBag size={15} color="#FFFFFF" /><Text style={styles.viewActionText}>View options</Text></View>
          <Pressable accessibilityLabel={`Remove ${item.name}`} style={styles.removeButton} onPress={(event) => { event.stopPropagation(); void remove(item); }}><Trash2 size={17} color="#B42318" /></Pressable>
        </View>
      </View>
    </Pressable>
  );

  const renderGridCard = (item: StoreProduct) => (
    <Pressable style={styles.card} onPress={() => setSelectedProduct(item)}>
      <Image source={{ uri: optimizeImageUrl(item.image_url, { width: 600 }) as string }} style={styles.image} resizeMode="cover" />
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.price}>{priceText(item)}</Text>
        <View style={styles.actions}>
          <View style={styles.viewAction}><ShoppingBag size={15} color="#FFFFFF" /><Text style={styles.viewActionText}>View options</Text></View>
          <Pressable accessibilityLabel={`Remove ${item.name}`} style={styles.removeButton} onPress={(event) => { event.stopPropagation(); void remove(item); }}><Trash2 size={17} color="#B42318" /></Pressable>
        </View>
      </View>
    </Pressable>
  );

  if (!user) return <SafeAreaView style={styles.center}><Heart size={40} color="#5A2D82" /><Text style={styles.emptyTitle}>Save pieces you love</Text><Text style={styles.emptyText}>Sign in to keep a wishlist across your devices.</Text><Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/welcome')}><Text style={styles.primaryButtonText}>Sign in</Text></Pressable></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.heading}><Text style={styles.title}>Your Wishlist</Text><Text style={styles.subtitle}>{products.length} saved {products.length === 1 ? 'item' : 'items'}</Text></View>
      {loading ? <View style={styles.center}><Text style={styles.emptyText}>Loading your wishlist…</Text></View> : products.length === 0 ? (
        <View style={styles.center}><Heart size={42} color="#5A2D82" /><Text style={styles.emptyTitle}>Your wishlist is empty</Text><Text style={styles.emptyText}>Tap the heart on any product to save it here.</Text><Pressable style={styles.primaryButton} onPress={() => router.push('/(customer)/shop')}><Text style={styles.primaryButtonText}>Browse products</Text></Pressable></View>
      ) : <ResponsiveGrid data={products} keyExtractor={(item: StoreProduct) => item.id} defaultColumns={isPhone ? 1 : width >= 1050 ? 4 : 3} enableResponsiveColumns={!isPhone} spacing={16} contentContainerStyle={styles.grid} renderItem={({ item }: { item: StoreProduct }) => isPhone ? renderRowCard(item) : renderGridCard(item)} />}
      <ProductModal product={selectedProduct} visible={!!selectedProduct} onClose={() => setSelectedProduct(null)} onOrderSuccess={() => void loadWishlist()} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' }, heading: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16 }, title: { fontFamily: 'Inter-Bold', fontSize: 26, color: '#17131C' }, subtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#665F6C', marginTop: 4 }, grid: { paddingHorizontal: 20, paddingBottom: 80 }, card: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E3EB' }, image: { width: '100%', aspectRatio: 0.88, backgroundColor: '#F3EFF7' }, cardBody: { padding: 12 }, rowCard: { width: '100%', flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E8E3EB' }, rowImage: { width: 116, alignSelf: 'stretch', minHeight: 150, backgroundColor: '#F3EFF7' }, rowBody: { flex: 1, padding: 14, justifyContent: 'space-between', gap: 10 }, rowInfo: { flex: 1 }, name: { fontFamily: 'Inter-SemiBold', fontSize: 14, lineHeight: 19, color: '#17131C' }, price: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#5A2D82', marginTop: 7 }, actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }, viewAction: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: '#5A2D82', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, viewActionText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 12 }, removeButton: { width: 42, height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3F2' }, center: { flex: 1, minHeight: 360, alignItems: 'center', justifyContent: 'center', padding: 28 }, emptyTitle: { fontFamily: 'Inter-Bold', fontSize: 20, color: '#17131C', marginTop: 14 }, emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, color: '#665F6C', textAlign: 'center', marginTop: 7, maxWidth: 360 }, primaryButton: { minHeight: 46, paddingHorizontal: 22, borderRadius: 9, backgroundColor: '#5A2D82', alignItems: 'center', justifyContent: 'center', marginTop: 18 }, primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },
});
