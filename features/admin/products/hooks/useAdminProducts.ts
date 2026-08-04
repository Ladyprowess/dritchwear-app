import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { StoreProduct } from '@/types/product';
import type { ProductFormData } from '../types';

export function useAdminProducts() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const productsRef = useRef<StoreProduct[]>([]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const fetchProducts = async () => {
    setLoading(productsRef.current.length === 0);

    const { data: rawProducts, error: productError } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (productError) {
      console.error('Error loading products:', productError.message);
      setLoading(false);
      return;
    }

    const { data: images, error: imageError } = await supabase
      .from('product_images')
      .select('product_id, image_url')
      .eq('is_primary', true);

    if (imageError) {
      console.error('Error loading images:', imageError.message);
      setLoading(false);
      return;
    }

    const productsWithImages: StoreProduct[] = (rawProducts || []).map((product: any) => {
      const primaryImage = (images || []).find((img: any) => img.product_id === product.id);

      return {
        ...product,
        image_url: primaryImage?.image_url || product.image_url,
        categories: Array.isArray(product.categories)
          ? product.categories
          : product.category
          ? [product.category]
          : [],
      };
    });

    setProducts(productsWithImages);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('all-products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload: any) => {
          if (payload.eventType === 'UPDATE') {
            setProducts((prev) => prev.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p)));
          } else if (payload.eventType === 'INSERT') {
            fetchProducts();
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const sub = supabase
      .channel('product-images-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_images' },
        () => {
          fetchProducts(); // refresh images immediately
        }
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const saveProduct = async (formData: ProductFormData, editingProduct: StoreProduct | null): Promise<boolean> => {
    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      subtitle: formData.subtitle.trim() || null,
      price: Number(formData.price),
      image_url: formData.image_url.trim(),
      categories: formData.categories,
      sizes: formData.sizes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      colors: formData.colors
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      stock: Number(formData.stock),
      is_active: formData.is_active,
      is_on_sale: formData.is_on_sale,
      sale_label: formData.is_on_sale ? (formData.sale_label.trim() || 'SALE') : null,
      min_tier: formData.min_tier || null,
      compare_at_price: formData.compare_at_price ? Number(formData.compare_at_price) : null,
      size_stock: Object.fromEntries(
        Object.entries(formData.size_stock)
          .filter(([, v]) => v !== '' && !Number.isNaN(Number(v)))
          .map(([k, v]) => [k, Number(v)])
      ),
      allow_logo_upload: formData.allow_logo_upload,
    };

    try {
      if (editingProduct) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingProduct.id);
        if (error) throw error;

        const { data: currentPrimary, error: primaryLookupError } = await supabase
          .from('product_images')
          .select('id')
          .eq('product_id', editingProduct.id)
          .eq('is_primary', true)
          .maybeSingle();
        if (primaryLookupError) throw primaryLookupError;

        if (currentPrimary) {
          const { error: imageUpdateError } = await supabase
            .from('product_images')
            .update({ image_url: productData.image_url })
            .eq('id', currentPrimary.id);
          if (imageUpdateError) throw imageUpdateError;
        } else {
          const { error: imageInsertError } = await supabase.from('product_images').insert({
            product_id: editingProduct.id,
            image_url: productData.image_url,
            alt_text: productData.name,
            display_order: 0,
            is_primary: true,
          });
          if (imageInsertError) throw imageInsertError;
        }
        Alert.alert('Success', 'Product updated successfully');
      } else {
        const { data: created, error } = await supabase.from('products').insert(productData).select('id').single();
        if (error) throw error;
        const { error: imageInsertError } = await supabase.from('product_images').insert({
          product_id: created.id,
          image_url: productData.image_url,
          alt_text: productData.name,
          display_order: 0,
          is_primary: true,
        });
        if (imageInsertError) throw imageInsertError;
        Alert.alert('Success', 'Product added successfully');
      }

      await fetchProducts();
      return true;
    } catch (e) {
      console.error('Save product error:', e);
      Alert.alert('Error', 'Failed to save product');
      return false;
    }
  };

  const deleteProduct = (product: StoreProduct) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${product.name}"? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('products').delete().eq('id', product.id);
            if (error) throw error;
            Alert.alert('Success', 'Product deleted successfully');
            fetchProducts();
          } catch (e) {
            console.error('Delete product error:', e);
            Alert.alert('Error', 'Failed to delete product');
          }
        },
      },
    ]);
  };

  const toggleProductStatus = async (product: StoreProduct) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;
      fetchProducts();
    } catch (e) {
      console.error('Toggle status error:', e);
      Alert.alert('Error', 'Failed to update product status');
    }
  };

  return {
    products,
    loading,
    fetchProducts,
    saveProduct,
    deleteProduct,
    toggleProductStatus,
  };
}
