import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { usePostHog } from 'posthog-react-native';
import type { StoreProduct } from '@/types/product';
import { BRAND_GOLD, BRAND_PURPLE } from '../constants';
import { styles } from '../styles';

import { HeroBanner } from './HeroBanner';
import { SearchBar } from './SearchBar';
import { TrustStrip } from './TrustStrip';
import { SalesMomentumBanner } from './SalesMomentumBanner';
import { CategoryTiles } from './CategoryTiles';
import { RecentlyViewedSection } from './RecentlyViewedSection';

interface CatalogHeaderProps {
  products: StoreProduct[];
  categoryImages: Record<string, string>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchQueryChange: (text: string) => void;
  onOpenFilterModal: () => void;
  recentProducts: StoreProduct[];
  userCurrency: string;
  onProductPress: (product: StoreProduct) => void;
}

export function CatalogHeader({
  products,
  categoryImages,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchQueryChange,
  onOpenFilterModal,
  recentProducts,
  userCurrency,
  onProductPress,
}: CatalogHeaderProps) {
  const router = useRouter();
  const posthog = usePostHog();

  return (
    <View>
      <View style={styles.catalogTop}>
        <HeroBanner
          onFilterPress={onOpenFilterModal}
          onCustomOrderPress={() => router.push('/corporate' as any)}
          onStyleMePress={() => router.push('/(customer)/looks')}
        />

        <SearchBar
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          onSearchCommitted={(text) => {
            if (text.trim()) posthog.capture('product_searched', { search_query: text.trim() });
          }}
        />

        <TrustStrip />

        <SalesMomentumBanner />

        <CategoryTiles
          products={products}
          categoryImages={categoryImages}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      </View>

      <Pressable style={styles.styleMeBanner} onPress={() => router.push('/(customer)/looks')}>
        <View style={styles.styleMeIcon}><Sparkles size={20} color={BRAND_GOLD} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.styleMeTitle}>Where are you going?</Text>
          <Text style={styles.styleMeCopy}>Tell us the occasion - we'll style the full fit for you.</Text>
        </View>
        <ChevronRight size={20} color={BRAND_PURPLE} />
      </Pressable>

      {selectedCategory === 'All' && !searchQuery && (
        <RecentlyViewedSection
          products={recentProducts}
          userCurrency={userCurrency}
          onProductPress={onProductPress}
        />
      )}
    </View>
  );
}
