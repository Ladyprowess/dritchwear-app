import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Search, Sparkles } from 'lucide-react-native';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import type { StoreProduct } from '@/types/product';

import { useAdminProducts } from '@/features/admin/products/hooks/useAdminProducts';
import { useFeaturedProducts } from '@/features/admin/products/hooks/useFeaturedProducts';
import { ProductsList } from '@/features/admin/products/components/ProductsList';
import { ProductFormModal } from '@/features/admin/products/components/ProductFormModal';
import { FeaturedPositionModal } from '@/features/admin/products/components/FeaturedPositionModal';
import { categories } from '@/features/admin/products/constants';
import { styles } from '@/features/admin/products/styles';

const allCategories = ['All', ...categories];

export default function AdminProductsScreen() {
  const { width } = useWindowDimensions();
  const isTabletOrWeb = Platform.OS === 'web' && width >= 700;
  const router = useRouter();

  const {
    products,
    loading,
    fetchProducts,
    saveProduct,
    deleteProduct,
    toggleProductStatus,
  } = useAdminProducts();

  const { featuredMap, makeFeatured, removeFeatured } = useFeaturedProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filteredProducts, setFilteredProducts] = useState<StoreProduct[]>([]);

  useEffect(() => {
    let filtered = products;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter((product) => (product.categories || []).includes(selectedCategory));
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(q) ||
          product.description.toLowerCase().includes(q) ||
          (product.categories || []).some((cat) => cat.toLowerCase().includes(q))
      );
    }

    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  const [featuredProductId, setFeaturedProductId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const openEditModal = (product: StoreProduct) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  const openDetailsModal = (product: StoreProduct) => {
    setSelectedProduct(product);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedProduct(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.looksButton} onPress={() => router.push('/(admin)/outfits')}>
            <Sparkles size={18} color="#5A2D82" />
            <Text style={styles.looksButtonText}>Looks</Text>
          </Pressable>
          <Pressable style={styles.addButton} onPress={openAddModal}>
            <Plus size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Product</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScroll}
          contentContainerStyle={styles.categoriesContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {allCategories.map((category) => (
            <Pressable
              key={category}
              style={[styles.categoryChip, selectedCategory === category && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ProductsList
          products={filteredProducts}
          featuredMap={featuredMap}
          loading={loading}
          searchQuery={searchQuery}
          selectedCategory={selectedCategory}
          onOpenFeatured={setFeaturedProductId}
          onRemoveFeatured={removeFeatured}
          onOpenDetails={openDetailsModal}
          onEdit={openEditModal}
          onDelete={deleteProduct}
          onToggleStatus={toggleProductStatus}
        />
      </ScrollView>

      <ProductDetailsModal
        product={selectedProduct}
        visible={showDetailsModal}
        onClose={closeDetailsModal}
        onImagesChange={async (primaryImageUrl) => {
          if (primaryImageUrl) {
            setSelectedProduct((current) => current ? { ...current, image_url: primaryImageUrl } : current);
          }
          await fetchProducts();
        }}
      />

      <FeaturedPositionModal
        productId={featuredProductId}
        onClose={() => setFeaturedProductId(null)}
        onSave={makeFeatured}
      />

      <ProductFormModal
        visible={showModal}
        editingProduct={editingProduct}
        isTabletOrWeb={isTabletOrWeb}
        onClose={closeModal}
        onSave={saveProduct}
      />
    </SafeAreaView>
  );
}
