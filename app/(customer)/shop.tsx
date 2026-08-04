import React, { useEffect, useState } from 'react';
import { Alert, Platform, useWindowDimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ProductModal from '@/features/customer/shared/productModal/components/ProductModal';
import EdgeToEdgeWrapper from '@/components/EdgeToEdgeWrapper';
import ResponsiveGrid from '@/components/ResponsiveGrid';
import { useEdgeToEdge } from '@/hooks/useEdgeToEdge';
import { logEvent } from '@/lib/analytics';
import { getProductCategories, type StoreProduct } from '@/types/product';
import { usePostHog } from 'posthog-react-native';
import { getOwnedPieceCount, tierIndexFor, TIERS } from '@/lib/wardrobe';
import { categories } from '@/features/customer/shop/constants';

import { useShopFilters } from '@/features/customer/shop/hooks/useShopFilters';
import { useShopProducts } from '@/features/customer/shop/hooks/useShopProducts';
import { useWishlist } from '@/features/customer/shop/hooks/useWishlist';
import { useSpecialOffer } from '@/features/customer/shop/hooks/useSpecialOffer';
import { useRecentlyViewed } from '@/features/customer/shop/hooks/useRecentlyViewed';
import { ProductCard } from '@/features/customer/shop/components/ProductCard';
import { CatalogHeader } from '@/features/customer/shop/components/CatalogHeader';
import { CatalogFooter } from '@/features/customer/shop/components/CatalogFooter';
import { OfferModal } from '@/features/customer/shop/components/OfferModal';
import { FilterModal } from '@/features/customer/shop/components/FilterModal';
import { LoadingOrEmptyState } from '@/features/customer/shop/components/LoadingOrEmptyState';

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 960;
  const { profile, user } = useAuth();
  const router = useRouter();
  const { insets } = useEdgeToEdge();
  const posthog = usePostHog();

  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [viewerRank, setViewerRank] = useState(0); // wardrobe-tier rank for gated drops
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});

  const filters = useShopFilters();
  const {
    products,
    visibleProducts,
    filteredProducts,
    loading,
    currentPage,
    setCurrentPage,
    totalPages,
    pageSize,
    fetchProducts,
  } = useShopProducts({
    selectedCategory: filters.selectedCategory,
    searchQuery: filters.searchQuery,
    selectedSizes: filters.selectedSizes,
    selectedColors: filters.selectedColors,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
  }, profile?.preferred_currency || 'NGN');
  const { wishlistIds, toggleWishlist } = useWishlist(user?.id, posthog);
  const { activeOffer, showOffer, dismissOffer } = useSpecialOffer();
  const { recentIds, recordView } = useRecentlyViewed(user?.id);

  // Viewer's wardrobe-tier rank, to gate member-only products.
  useEffect(() => {
    if (!user?.id) { setViewerRank(0); return; }
    let active = true;
    getOwnedPieceCount(user.id).then((c) => { if (active) setViewerRank(tierIndexFor(c)); });
    return () => { active = false; };
  }, [user?.id]);

  // Admin-set category tile images.
  useEffect(() => {
    let active = true;
    supabase.from('category_images').select('category, image_url').then(({ data }) => {
      if (!active || !data) return;
      const map: Record<string, string> = {};
      data.forEach((r: any) => { if (r.image_url) map[r.category] = r.image_url; });
      setCategoryImages(map);
    });
    return () => { active = false; };
  }, []);

  // Honour a ?category= deep link (e.g. from the wardrobe seasonal nudge).
  const routeParams = useLocalSearchParams<{ category?: string }>();
  useEffect(() => {
    const c = typeof routeParams.category === 'string' ? routeParams.category : undefined;
    if (c && categories.includes(c)) filters.setSelectedCategory(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.category]);

  const isNigerian = profile?.preferred_currency === 'NGN' || profile?.location?.toLowerCase().includes('nigeria');
  const userCurrency = profile?.preferred_currency || 'NGN';
  const recentProducts = recentIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is StoreProduct => !!p);

  const handleProductPress = (product: StoreProduct) => {
    void logEvent('view_item', {
      item_id: product.id,
      item_name: product.name,
      currency: 'NGN',
      value: product.price,
    });

    posthog.capture('product_viewed', {
      product_id: product.id,
      product_name: product.name,
      price_ngn: product.price,
      category: getProductCategories(product)[0] ?? null,
    });

    recordView(product.id);
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleOrderSuccess = () => {
    fetchProducts(); // Refresh products to update stock
  };

  const notifyLocked = (tier: string) => {
    const current = TIERS[viewerRank]?.name ?? 'Bronze';
    Alert.alert(
      'Members only',
      `This piece unlocks at ${tier}. You're currently ${current} - keep building your wardrobe to unlock it.`
    );
  };

  const hasActiveFilters = !!filters.searchQuery || filters.selectedCategory !== 'All';

  return (
    <EdgeToEdgeWrapper>
      <ResponsiveGrid
        data={loading ? [] : visibleProducts}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            userCurrency={userCurrency}
            viewerRank={viewerRank}
            isWishlisted={wishlistIds.has(item.id)}
            onPress={handleProductPress}
            onToggleWishlist={toggleWishlist}
            onLocked={notifyLocked}
          />
        )}
        keyExtractor={(item: StoreProduct) => item.id}
        defaultColumns={isDesktop ? 4 : width >= 700 ? 3 : 2}
        spacing={16}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom, width: '100%', maxWidth: 1280, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <CatalogHeader
            products={products}
            categoryImages={categoryImages}
            selectedCategory={filters.selectedCategory}
            onSelectCategory={filters.setSelectedCategory}
            searchQuery={filters.searchQuery}
            onSearchQueryChange={filters.setSearchQuery}
            onOpenFilterModal={() => filters.setShowFilterModal(true)}
            recentProducts={recentProducts}
            userCurrency={userCurrency}
            onProductPress={handleProductPress}
          />
        }
        ListEmptyComponent={
          <LoadingOrEmptyState loading={loading} hasActiveFilters={hasActiveFilters} />
        }
        ListFooterComponent={
          loading ? null : (
            <CatalogFooter
              totalFilteredCount={filteredProducts.length}
              pageSize={pageSize}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              isNigerian={!!isNigerian}
              isSignedIn={!!user}
            />
          )
        }
      />

      <OfferModal
        activeOffer={activeOffer}
        showOffer={showOffer}
        isDesktop={isDesktop}
        onDismiss={dismissOffer}
      />

      <FilterModal
        visible={filters.showFilterModal}
        onClose={() => filters.setShowFilterModal(false)}
        selectedSizes={filters.selectedSizes}
        onToggleSize={(size) => filters.setSelectedSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
        selectedColors={filters.selectedColors}
        onToggleColor={(color) => filters.setSelectedColors(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color])}
        minPrice={filters.minPrice}
        onMinPriceChange={filters.setMinPrice}
        maxPrice={filters.maxPrice}
        onMaxPriceChange={filters.setMaxPrice}
        preferredCurrency={userCurrency}
        onClearFilters={filters.clearFilters}
      />

      <ProductModal
        product={selectedProduct}
        visible={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(null);
        }}
        onOrderSuccess={handleOrderSuccess}
      />
    </EdgeToEdgeWrapper>
  );
}
