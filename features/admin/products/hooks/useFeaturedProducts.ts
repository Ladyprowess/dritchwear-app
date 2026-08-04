import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';

export type FeaturedMap = Record<string, { position: number; is_active: boolean }>;

export function useFeaturedProducts() {
  const [featuredMap, setFeaturedMap] = useState<FeaturedMap>({});
  const [featuredLoading, setFeaturedLoading] = useState(false);

  const fetchFeatured = async () => {
    setFeaturedLoading(true);

    const { data, error } = await supabase
      .from('featured_products')
      .select('product_id, position, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('Error loading featured:', error.message);
      setFeaturedMap({}); // prevents stale featured UI
      setFeaturedLoading(false);
      return;
    }

    const map: FeaturedMap = {};
    (data || []).forEach((row: any) => {
      map[row.product_id] = { position: row.position, is_active: row.is_active };
    });

    setFeaturedMap(map);
    setFeaturedLoading(false);
  };

  useEffect(() => {
    fetchFeatured();
  }, []);

  useEffect(() => {
    const sub = supabase
      .channel('featured-products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'featured_products' },
        () => {
          fetchFeatured(); // simplest + safe
        }
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const makeFeatured = async (productId: string, position: number) => {
    try {
      const { error } = await supabase
        .from('featured_products')
        .upsert({ product_id: productId, position, is_active: true }, { onConflict: 'product_id' });

      if (error) throw error;

      await fetchFeatured();
      Alert.alert('Success', `Product is now featured at position ${position}.`);
    } catch (e: any) {
      console.error('makeFeatured error:', e);
      Alert.alert('Error', e?.message || 'Failed to feature product');
    }
  };

  const removeFeatured = async (productId: string) => {
    try {
      const { error } = await supabase
        .from('featured_products')
        .update({ is_active: false })
        .eq('product_id', productId);

      if (error) throw error;

      await fetchFeatured();
      Alert.alert('Removed', 'Product removed from featured.');
    } catch (e: any) {
      console.error('removeFeatured error:', e);
      Alert.alert('Error', e?.message || 'Failed to remove featured product');
    }
  };

  return { featuredMap, featuredLoading, fetchFeatured, makeFeatured, removeFeatured };
}
