import React from 'react';
import { Text, View } from 'react-native';
import { Package } from 'lucide-react-native';
import type { StoreProduct } from '@/types/product';
import type { FeaturedMap } from '../hooks/useFeaturedProducts';
import { ProductCard } from './ProductCard';
import { styles } from '../styles';

interface ProductsListProps {
  products: StoreProduct[];
  featuredMap: FeaturedMap;
  loading: boolean;
  searchQuery: string;
  selectedCategory: string;
  onOpenFeatured: (productId: string) => void;
  onRemoveFeatured: (productId: string) => void;
  onOpenDetails: (product: StoreProduct) => void;
  onEdit: (product: StoreProduct) => void;
  onDelete: (product: StoreProduct) => void;
  onToggleStatus: (product: StoreProduct) => void;
}

export function ProductsList({
  products,
  featuredMap,
  loading,
  searchQuery,
  selectedCategory,
  onOpenFeatured,
  onRemoveFeatured,
  onOpenDetails,
  onEdit,
  onDelete,
  onToggleStatus,
}: ProductsListProps) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  if (products.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Package size={64} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>No Products Found</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery || selectedCategory !== 'All'
            ? 'No products match your search criteria'
            : 'Start by adding your first product'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.productsContainer}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          featured={featuredMap[product.id]}
          onOpenFeatured={onOpenFeatured}
          onRemoveFeatured={onRemoveFeatured}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </View>
  );
}
