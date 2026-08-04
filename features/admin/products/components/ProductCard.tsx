import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { CreditCard as Edit3, Trash2, Eye, EyeOff, Info } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { StoreProduct } from '@/types/product';
import type { FeaturedMap } from '../hooks/useFeaturedProducts';
import { styles } from '../styles';

interface ProductCardProps {
  product: StoreProduct;
  featured: FeaturedMap[string] | undefined;
  onOpenFeatured: (productId: string) => void;
  onRemoveFeatured: (productId: string) => void;
  onOpenDetails: (product: StoreProduct) => void;
  onEdit: (product: StoreProduct) => void;
  onDelete: (product: StoreProduct) => void;
  onToggleStatus: (product: StoreProduct) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(amount);

const getStockColor = (stock: number) => {
  if (stock === 0) return '#EF4444';
  if (stock <= 5) return '#F59E0B';
  if (stock <= 20) return '#3B82F6';
  return '#10B981';
};

function ProductCardBase({
  product,
  featured,
  onOpenFeatured,
  onRemoveFeatured,
  onOpenDetails,
  onEdit,
  onDelete,
  onToggleStatus,
}: ProductCardProps) {
  const stock = product.stock ?? 0;
  const productCategories = product.categories || [];

  return (
    <View style={styles.productCard}>
      <View style={styles.productHeader}>
        <Image
          key={`${product.id}-${product.image_url}-${product.updated_at || ''}`}
          source={{ uri: optimizeImageUrl(product.image_url, { width: 300 }) as string }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <View style={styles.productTitleRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {product.name}
            </Text>

            <View style={styles.productActions}>
              {featured ? (
                <Pressable
                  style={[styles.actionButton, styles.featuredOnButton]}
                  onPress={() => onRemoveFeatured(product.id)}
                >
                  <Text style={styles.featuredBadgeText}>#{featured.position}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.actionButton, styles.featuredOffButton]}
                  onPress={() => onOpenFeatured(product.id)}
                >
                  <Text style={styles.featuredBadgeText}>F</Text>
                </Pressable>
              )}
              <Pressable style={[styles.actionButton, styles.infoButton]} onPress={() => onOpenDetails(product)}>
                <Info size={14} color="#FFFFFF" />
              </Pressable>

              <Pressable style={[styles.actionButton, styles.editButton]} onPress={() => onEdit(product)}>
                <Edit3 size={14} color="#FFFFFF" />
              </Pressable>

              <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => onDelete(product)}>
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.productDescription} numberOfLines={2}>
            {product.description}
          </Text>

          <View style={styles.productMeta}>
            <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>

            <View style={styles.productCategoriesWrap}>
              {productCategories.map((cat, index) => (
                <Text key={`${product.id}-${cat}-${index}`} style={styles.productCategory}>
                  {cat}
                </Text>
              ))}
            </View>
          </View>

          <View style={styles.productDetails}>
            <View style={styles.stockContainer}>
              <Text style={[styles.productStock, { color: getStockColor(stock) }]}>Stock: {stock}</Text>

              {stock <= 5 && stock > 0 && (
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockText}>Low Stock</Text>
                </View>
              )}

              {stock === 0 && (
                <View style={styles.outOfStockBadge}>
                  <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
              )}
            </View>

            <Pressable
              style={[styles.statusButton, product.is_active ? styles.activeStatus : styles.inactiveStatus]}
              onPress={() => onToggleStatus(product)}
            >
              {product.is_active ? <Eye size={12} color="#10B981" /> : <EyeOff size={12} color="#EF4444" />}
              <Text style={[styles.statusText, { color: product.is_active ? '#10B981' : '#EF4444' }]}>
                {product.is_active ? 'Active' : 'Inactive'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

export const ProductCard = React.memo(ProductCardBase);
