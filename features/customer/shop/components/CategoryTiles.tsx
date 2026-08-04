import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { StoreProduct } from '@/types/product';
import { getProductCategories } from '@/types/product';
import { categories, smartCollections } from '../constants';
import { styles } from '../styles';

interface CategoryTilesProps {
  products: StoreProduct[];
  categoryImages: Record<string, string>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryTiles({ products, categoryImages, selectedCategory, onSelectCategory }: CategoryTilesProps) {
  // Category tile image: admin-set photo wins; otherwise a representative
  // product image ('All'/smart collections use any product).
  const categoryImage = (category: string): string | null => {
    if (categoryImages[category]) return categoryImages[category];
    const isMeta = category === 'All' || smartCollections.includes(category);
    const p = products.find((pr) => (isMeta ? true : getProductCategories(pr).includes(category)));
    return p?.image_url ?? null;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer} contentContainerStyle={styles.catTilesContent}>
      {categories.map((category) => {
        const img = categoryImage(category);
        const active = selectedCategory === category;
        return (
          <Pressable key={category} style={styles.catTile} onPress={() => onSelectCategory(category)}>
            <View style={[styles.catImgWrap, active && styles.catImgWrapActive]}>
              {img ? (
                <Image source={{ uri: optimizeImageUrl(img, { width: 140 }) as string }} style={styles.catImg} resizeMode="cover" />
              ) : (
                <View style={styles.catImgFallback}><Text style={styles.catImgFallbackText}>{category.charAt(0)}</Text></View>
              )}
            </View>
            <Text style={[styles.catLabel, active && styles.catLabelActive]} numberOfLines={1}>{category}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
