import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import type { StoreProduct } from '@/types/product';

export function useWishlist(userId: string | undefined, posthog: { capture: (event: string, props?: any) => void }) {
  const router = useRouter();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) { setWishlistIds(new Set()); return; }
    void supabase.from('wishlists').select('product_id').eq('user_id', userId).then(({ data, error }) => {
      if (error) { console.warn('Unable to load wishlist:', error.message); return; }
      setWishlistIds(new Set((data ?? []).map((row: any) => String(row.product_id))));
    });
  }, [userId]);

  const toggleWishlist = async (product: StoreProduct) => {
    if (!userId) {
      Alert.alert('Sign in to save favourites', 'Create an account or sign in to keep products in your wishlist.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/(auth)/welcome') },
      ]);
      return;
    }
    const saved = wishlistIds.has(product.id);
    setWishlistIds((current) => { const next = new Set(current); saved ? next.delete(product.id) : next.add(product.id); return next; });
    const query = saved
      ? supabase.from('wishlists').delete().eq('user_id', userId).eq('product_id', product.id)
      : supabase.from('wishlists').insert({ user_id: userId, product_id: product.id });
    const { error } = await query;
    if (error) {
      setWishlistIds((current) => { const next = new Set(current); saved ? next.add(product.id) : next.delete(product.id); return next; });
      Alert.alert('Wishlist not updated', 'We could not save that change. Please check your connection and try again.');
    } else if (!saved) {
      posthog.capture('wishlist_item_added', {
        product_id: product.id,
        product_name: product.name,
        price_ngn: product.price,
      });
    }
  };

  return { wishlistIds, toggleWishlist };
}
