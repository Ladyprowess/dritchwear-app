import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getOwnedPieceCount, tierIndexFor, tierRankByName } from '@/lib/wardrobe';
import type { StoreProduct } from '@/types/product';
import type { ProductImage, ReviewStats } from '../types';

// Data + derived view-state for whichever product is currently open in the
// modal: gallery images, review stats, and the tier-gate lock. All three are
// fetched/recomputed on the same trigger (visible && product changing).
export function useProductModalData(visible: boolean, product: StoreProduct | null, userId?: string) {
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ averageRating: 0, totalReviews: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [lockedTier, setLockedTier] = useState<string | null>(null);

  const fetchProductImages = async () => {
    if (!product) return;

    setImagesLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const ordered = [...data].sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return a.display_order - b.display_order;
        });
        setProductImages(ordered);
        setCurrentImageIndex(0);
      } else {
        setProductImages([{
          id: 'main',
          image_url: product.image_url,
          alt_text: product.name,
          display_order: 0,
          is_primary: true
        }]);
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
      setProductImages([{
        id: 'main',
        image_url: product.image_url,
        alt_text: product.name,
        display_order: 0,
        is_primary: true
      }]);
    } finally {
      setImagesLoading(false);
    }
  };

  const fetchReviewStats = async () => {
    if (!product) return;

    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('product_id', product.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / data.length;
        setReviewStats({
          averageRating: Math.round(averageRating * 10) / 10,
          totalReviews: data.length
        });
      } else {
        setReviewStats({ averageRating: 0, totalReviews: 0 });
      }
    } catch (error) {
      console.error('Error fetching review stats:', error);
      setReviewStats({ averageRating: 0, totalReviews: 0 });
    } finally {
      setReviewsLoading(false);
    }
  };

  // Tier-gate guard (defense-in-depth): whichever surface opens this modal, a
  // member-only product stays locked until the shopper reaches the tier.
  useEffect(() => {
    let active = true;
    if (!visible || !product?.min_tier) { setLockedTier(null); return; }
    const requiredRank = tierRankByName(product.min_tier);
    if (requiredRank <= 0) { setLockedTier(null); return; }
    const resolve = async () => {
      const rank = userId ? tierIndexFor(await getOwnedPieceCount(userId)) : 0;
      if (active) setLockedTier(requiredRank > rank ? (product.min_tier as string) : null);
    };
    void resolve();
    return () => { active = false; };
  }, [visible, product, userId]);

  // Fetch product images when modal opens
  useEffect(() => {
    if (visible && product) {
      fetchProductImages();
      fetchReviewStats();
    }
    // Fetches are keyed by the selected product and modal visibility.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, product]);

  const reset = () => {
    setCurrentImageIndex(0);
    setProductImages([]);
    setReviewStats({ averageRating: 0, totalReviews: 0 });
  };

  return {
    productImages,
    currentImageIndex,
    setCurrentImageIndex,
    imagesLoading,
    reviewStats,
    reviewsLoading,
    fetchReviewStats,
    lockedTier,
    reset,
  };
}
