import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Star, Truck, RotateCcw, ShieldCheck, ChevronRight as ChevronRightIcon } from 'lucide-react-native';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import { discountPercent, type StoreProduct } from '@/types/product';
import type { ReviewStats } from '../types';
import { styles, BRAND_PURPLE } from '../styles';

interface ProductInfoSectionProps {
  product: StoreProduct;
  userCurrency: string;
  productPriceInUserCurrency: number;
  reviewStats: ReviewStats;
  reviewsLoading: boolean;
  lowStock: boolean;
  urgencyPillStyle: any;
  onOpenReturns: () => void;
}

function renderStarRating(rating: number) {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;

  for (let i = 0; i < fullStars; i++) {
    stars.push(<Star key={i} size={16} color="#F59E0B" fill="#F59E0B" />);
  }

  if (hasHalfStar) {
    stars.push(<Star key="half" size={16} color="#F59E0B" fill="#F59E0B" opacity={0.5} />);
  }

  const emptyStars = 5 - Math.ceil(rating);
  for (let i = 0; i < emptyStars; i++) {
    stars.push(<Star key={`empty-${i}`} size={16} color="#E5E7EB" fill="#E5E7EB" />);
  }

  return stars;
}

export function ProductInfoSection({
  product,
  userCurrency,
  productPriceInUserCurrency,
  reviewStats,
  reviewsLoading,
  lowStock,
  urgencyPillStyle,
  onOpenReturns,
}: ProductInfoSectionProps) {
  return (
    <View style={styles.productInfo}>
      <Text style={styles.productName}>{product.name}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.productPrice}>
          {formatCurrency(productPriceInUserCurrency, userCurrency)}
        </Text>
        {(() => {
          const pct = discountPercent(product);
          if (!pct || !product.compare_at_price) return null;
          const cmp = userCurrency === 'NGN' ? product.compare_at_price : convertFromNGN(product.compare_at_price, userCurrency);
          return (
            <>
              <Text style={styles.comparePrice}>{formatCurrency(cmp, userCurrency)}</Text>
              <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>-{pct}%</Text></View>
            </>
          );
        })()}
      </View>

      <View style={styles.ratingContainer}>
        {reviewsLoading ? (
          <Text style={styles.ratingText}>Loading reviews…</Text>
        ) : reviewStats.totalReviews > 0 ? (
          <>
            <View style={styles.starRating}>
              {renderStarRating(reviewStats.averageRating)}
            </View>
            <Text style={styles.ratingText}>
              {reviewStats.averageRating} ({reviewStats.totalReviews} review{reviewStats.totalReviews !== 1 ? 's' : ''})
            </Text>
          </>
        ) : (
          <>
            <Star size={16} color="#E5E7EB" fill="#E5E7EB" />
            <Text style={styles.ratingText}>No reviews yet</Text>
          </>
        )}
        {!!product.sales_count && product.sales_count > 0 && (
          <Text style={styles.soldText}>
            · {product.sales_count >= 1000 ? `${(product.sales_count / 1000).toFixed(1)}k` : product.sales_count} sold
          </Text>
        )}
      </View>

      <Text style={styles.productDescription}>{product.description}</Text>
      {product.stock === 0 ? (
        <Text style={styles.stockText}>Out of stock</Text>
      ) : lowStock ? (
        <Animated.View style={[styles.urgencyPill, urgencyPillStyle]}>
          <Text style={styles.urgencyPillText}>🔥 Only {product.stock} left - order before it sells out</Text>
        </Animated.View>
      ) : (
        <Text style={styles.stockText}>{product.stock} items in stock</Text>
      )}

      {product.stock > 0 && (
        <View style={styles.rewardNudge}>
          <View style={styles.rewardNudgeDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rewardNudgeTitle}>Order now, get rewarded</Text>
            <Text style={styles.rewardNudgeText}>
              Add to cart and check out to lock in your size and colour - and stack loyalty points while you're at it.
            </Text>
          </View>
        </View>
      )}

      {/* Trust & delivery details */}
      <View style={styles.trustCard}>
        <View style={styles.trustRow}>
          <Truck size={17} color={BRAND_PURPLE} />
          <Text style={styles.trustText}>Fast delivery - 2–7 days across Nigeria</Text>
        </View>
        <Pressable style={styles.trustRow} onPress={onOpenReturns}>
          <RotateCcw size={17} color={BRAND_PURPLE} />
          <Text style={styles.trustText}>Easy returns &amp; exchanges</Text>
          <ChevronRightIcon size={16} color="#9CA3AF" />
        </Pressable>
        <View style={[styles.trustRow, styles.trustRowLast]}>
          <ShieldCheck size={17} color={BRAND_PURPLE} />
          <Text style={styles.trustText}>Secure checkout · buyer protection</Text>
        </View>
      </View>
    </View>
  );
}
