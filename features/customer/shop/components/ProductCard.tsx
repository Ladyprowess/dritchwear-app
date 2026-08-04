import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Star, Zap, Heart, Lock } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency, getItemPriceInUserCurrency } from '@/lib/currency';
import { getProductCategories, discountPercent, type StoreProduct } from '@/types/product';
import { colorToHex } from '@/lib/colors';
import { tierRankByName } from '@/lib/wardrobe';
import { BRAND_PURPLE, BRAND_GOLD } from '../constants';
import { styles } from '../styles';

interface ProductCardProps {
  product: StoreProduct;
  userCurrency: string;
  viewerRank: number;
  isWishlisted: boolean;
  onPress: (product: StoreProduct) => void;
  onToggleWishlist: (product: StoreProduct) => void;
  onLocked: (tier: string) => void;
}

export function ProductCard({ product, userCurrency, viewerRank, isWishlisted, onPress, onToggleWishlist, onLocked }: ProductCardProps) {
  const productPrice = getItemPriceInUserCurrency(product.price, userCurrency);
  const isSoldOut = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const hasReviews = !!product.total_reviews && product.total_reviews > 0;
  const lockedTier = product.min_tier && tierRankByName(product.min_tier) > viewerRank ? product.min_tier : null;

  return (
    <Pressable
      style={styles.productCard}
      onPress={() => (lockedTier ? onLocked(lockedTier) : onPress(product))}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        style={styles.wishlistButton}
        onPress={(event) => { event.stopPropagation(); void onToggleWishlist(product); }}
      >
        <Heart size={19} color={isWishlisted ? '#FFFFFF' : BRAND_PURPLE} fill={isWishlisted ? BRAND_PURPLE : 'transparent'} />
      </Pressable>
      {(product.is_on_sale || product.is_hot || product.is_featured) && (
        <View style={[styles.hotBadge, product.is_on_sale && styles.saleBadge]} pointerEvents="none">
          {!product.is_on_sale && <Zap size={11} color="#5A2D82" fill="#5A2D82" />}
          <Text style={[styles.hotBadgeText, product.is_on_sale && styles.saleBadgeText]}>
            {product.is_on_sale ? (product.sale_label || 'SALE') : product.is_featured ? 'FEATURED' : 'HOT'}
          </Text>
        </View>
      )}
      <View>
        <Image
          source={{ uri: optimizeImageUrl(product.image_url, { width: 600 }) as string }}
          style={[styles.productImage, isSoldOut && styles.productImageSoldOut]}
          resizeMode="cover"
        />
        {isSoldOut && (
          <View style={styles.soldOutOverlay} pointerEvents="none">
            <Text style={styles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
        {!!lockedTier && !isSoldOut && (
          <View style={styles.lockOverlay} pointerEvents="none">
            <Lock size={20} color="#FFFFFF" />
            <Text style={styles.lockText}>Members only</Text>
            <Text style={styles.lockSub}>Unlock at {lockedTier}</Text>
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {!!product.subtitle && (
          <Text style={styles.productSubtitle} numberOfLines={1}>
            {product.subtitle}
          </Text>
        )}

        {getProductCategories(product).length > 0 && (
          <View style={styles.categoriesRow}>
            {getProductCategories(product).map((cat, index) => (
              <Text key={index} style={styles.categoryBadge}>
                {cat}
              </Text>
            ))}
          </View>
        )}

        {Array.isArray(product.colors) && product.colors.length > 0 && (
          <View style={styles.swatchRow}>
            {product.colors.slice(0, 5).map((color, index) => (
              <View
                key={`${color}-${index}`}
                style={[styles.swatch, { backgroundColor: colorToHex(color) }]}
              />
            ))}
            {product.colors.length > 5 && (
              <Text style={styles.swatchMore}>+{product.colors.length - 5}</Text>
            )}
          </View>
        )}

        <View style={styles.productMeta}>
          <View style={styles.cardPriceRow}>
            <Text style={styles.productPrice}>
              {formatCurrency(productPrice, userCurrency)}
            </Text>
            {(() => {
              const pct = discountPercent(product);
              if (!pct || !product.compare_at_price) return null;
              const cmp = getItemPriceInUserCurrency(product.compare_at_price, userCurrency);
              return (
                <>
                  <Text style={styles.cardComparePrice}>{formatCurrency(cmp, userCurrency)}</Text>
                  <View style={styles.cardDiscountBadge}><Text style={styles.cardDiscountText}>-{pct}%</Text></View>
                </>
              );
            })()}
          </View>
          {hasReviews && (
            <View style={styles.ratingContainer}>
              <Star size={12} color={BRAND_GOLD} fill={BRAND_GOLD} />
              <Text style={styles.ratingText}>
                {`${product.average_rating?.toFixed(1)} (${product.total_reviews})`}
              </Text>
            </View>
          )}
        </View>

        {isLowStock && (
          <View style={styles.lowStockPill}>
            <Zap size={10} color="#B45309" fill="#B45309" />
            <Text style={styles.lowStockText}>Only {product.stock} left</Text>
          </View>
        )}
        {!isSoldOut && (
          <Text style={styles.rewardHint}>Earn points on every order</Text>
        )}
      </View>
    </Pressable>
  );
}
