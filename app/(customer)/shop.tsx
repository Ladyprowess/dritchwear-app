import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, TextInput, FlatList, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Search, Filter, Star, ShoppingCart } from 'lucide-react-native';
import ProductModal from '@/components/ProductModal';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  sizes: string[];
  colors: string[];
  stock: number;
}

const categories = ['All', 'T-Shirts', 'Hoodies', 'Polos', 'Joggers', 'Casuals'];

export default function ShopScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number | null>(null);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (data) {
      setProducts(data);
      setFilteredProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    let filtered = [...products];
  
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
  
    if (searchQuery) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  
    if (selectedSizes.length > 0) {
      filtered = filtered.filter(p => p.sizes.some(size => selectedSizes.includes(size)));
    }
  
    if (selectedColors.length > 0) {
      filtered = filtered.filter(p => p.colors.some(color => selectedColors.includes(color)));
    }

    if (minPrice !== null) {
      filtered = filtered.filter(p => p.price >= minPrice);
    }
    if (maxPrice !== null) {
      filtered = filtered.filter(p => p.price <= maxPrice);
    }    
  
    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery, selectedSizes, selectedColors, maxPrice, minPrice]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleProductPress = (product: Product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleOrderSuccess = () => {
    fetchProducts(); // Refresh products to update stock
  };

  const renderProduct = ({ item: product }: { item: Product }) => (
    <Pressable 
      style={styles.productCard}
      onPress={() => handleProductPress(product)}
    >
      <Image
        source={{ uri: product.image_url }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {product.description}
        </Text>
        <View style={styles.productMeta}>
          <Text style={styles.productPrice}>
            {formatCurrency(product.price)}
          </Text>
          <View style={styles.ratingContainer}>
            <Star size={12} color="#F59E0B" fill="#F59E0B" />
            <Text style={styles.ratingText}>4.8</Text>
          </View>
        </View>
        <View style={styles.productVariants}>
          <View style={styles.sizesContainer}>
            {product.sizes.slice(0, 3).map((size, index) => (
              <Text key={index} style={styles.sizeText}>{size}</Text>
            ))}
            {product.sizes.length > 3 && (
              <Text style={styles.moreText}>+{product.sizes.length - 3}</Text>
            )}
          </View>
          <View style={styles.stockInfo}>
            <Text style={styles.stockText}>
              {product.stock > 0 ? `${product.stock} left` : 'Out of stock'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shop</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Filter size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {/* Search Bar */}
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

      {/* Categories */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((category) => (
          <Pressable
            key={category}
            style={[
              styles.categoryChip,
              selectedCategory === category && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive
              ]}
            >
              {category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.productsContainer}
        columnWrapperStyle={styles.productRow}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'All' 
                ? 'No products found matching your criteria' 
                : 'No products available'
              }
            </Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Products</Text>
            
            {/* Size Filter */}
            <Text style={styles.filterLabel}>Filter by Size</Text>
            <View style={styles.filterOptions}>
              {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map(size => (
                <Pressable
                  key={size}
                  onPress={() =>
                    setSelectedSizes(prev =>
                      prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
                    )
                  }
                  style={[
                    styles.filterChip,
                    selectedSizes.includes(size) && styles.filterChipActive
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedSizes.includes(size) && styles.filterChipTextActive
                  ]}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Color Filter */}
            <Text style={[styles.filterLabel, { marginTop: 16 }]}>Filter by Color</Text>
            <View style={styles.filterOptions}>
              {['Black', 'White', 'Navy', 'Grey', 'Beige', 'Brown'].map(color => (
                <Pressable
                  key={color}
                  onPress={() =>
                    setSelectedColors(prev =>
                      prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]
                    )
                  }
                  style={[
                    styles.filterChip,
                    selectedColors.includes(color) && styles.filterChipActive
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedColors.includes(color) && styles.filterChipTextActive
                  ]}>
                    {color}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Price Range Filter */}
            <Text style={[styles.filterLabel, { marginTop: 16 }]}>Price Range (₦)</Text>
            <View style={styles.priceInputs}>
              <TextInput
                placeholder="Min"
                keyboardType="numeric"
                style={[styles.priceInput]}
                value={minPrice !== null ? minPrice.toString() : ''}
                onChangeText={(text) => {
                  const parsed = parseInt(text);
                  setMinPrice(isNaN(parsed) ? null : parsed);
                }}
              />
              <TextInput
                placeholder="Max"
                keyboardType="numeric"
                style={[styles.priceInput]}
                value={maxPrice !== null ? maxPrice.toString() : ''}
                onChangeText={(text) => {
                  const parsed = parseInt(text);
                  setMaxPrice(isNaN(parsed) ? null : parsed);
                }}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.applyButton}
                onPress={() => setShowFilterModal(false)}
              >
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </Pressable>

              <Pressable
                style={styles.clearButton}
                onPress={() => {
                  setSelectedSizes([]);
                  setSelectedColors([]);
                  setMaxPrice(null);
                  setMinPrice(null);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear Filter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        visible={showProductModal}
        onClose={() => {
          setShowProductModal(false);
          setSelectedProduct(null);
        }}
        onOrderSuccess={handleOrderSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  categoriesContainer: {
    marginBottom: 12,
    zIndex: 1,
    paddingTop: 4,
    paddingBottom: 50,
    backgroundColor: '#F9FAFB', // ✅ Optional: to ensure layering works
  },
  
  categoriesContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 70,
    height: 30,  
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
    height: 30,  
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  productsContainer: {
    paddingTop: 40, // ✅ Extra space to push content below categories
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productImage: {
    width: '100%',
    height: 140,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 18,
  },
  productDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 16,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  productVariants: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  sizeText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
  },
  addToCartButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  cartSummary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cartSummaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#1F2937',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
  },
  modalContent: {
    marginTop: 60,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
  } ,
  chip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  
  cartSummaryText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  checkoutButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});