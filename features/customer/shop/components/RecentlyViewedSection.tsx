import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency, getItemPriceInUserCurrency } from '@/lib/currency';
import type { StoreProduct } from '@/types/product';
import { styles } from '../styles';

interface RecentlyViewedSectionProps {
  products: StoreProduct[];
  userCurrency: string;
  onProductPress: (product: StoreProduct) => void;
}

export function RecentlyViewedSection({ products, userCurrency, onProductPress }: RecentlyViewedSectionProps) {
  if (products.length === 0) return null;

  return (
    <View style={styles.recentSection}>
      <Text style={styles.editorialTitle}>Recently viewed</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
        {products.map((p) => (
          <Pressable key={p.id} style={styles.recentCard} onPress={() => onProductPress(p)}>
            <Image source={{ uri: optimizeImageUrl(p.image_url, { width: 240 }) as string }} style={styles.recentImage} resizeMode="cover" />
            <Text style={styles.recentName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.recentPrice}>{formatCurrency(getItemPriceInUserCurrency(p.price, userCurrency), userCurrency)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
