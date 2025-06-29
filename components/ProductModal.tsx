import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShoppingCart, Star, Plus, Minus, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useRouter } from 'expo-router';
import { convertFromNGN, formatCurrency } from '@/lib/currency';

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

interface ProductModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
  onOrderSuccess: () => void;
}

export default function ProductModal({ product, visible, onClose, onOrderSuccess }: ProductModalProps) {
  const { profile } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!product) return null;

  const resetModal = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setQuantity(1);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const toggleSize = (size: string) => {
    setSelectedSizes(prev => 
      prev.includes(size) 
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const handleAddToCart = async () => {
    if (selectedSizes.length === 0 || selectedColors.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one size and one color');
      return;
    }

    setLoading(true);

    try {
      // Create all combinations of selected sizes and colors
      const newItems = [];
      selectedSizes.forEach(size => {
        selectedColors.forEach(color => {
          newItems.push({
            productId: product.id,
            productName: product.name,
            productImage: product.image_url,
            price: product.price,
            size,
            color,
            quantity
          });
        });
      });

      await addToCart(newItems);
      
      const totalAdded = selectedSizes.length * selectedColors.length;
      Alert.alert(
        'Added to Cart', 
        `Added ${totalAdded} item${totalAdded > 1 ? 's' : ''} to your cart`,
        [
          { text: 'Continue Shopping', onPress: handleClose },
          { text: 'View Cart', onPress: () => {
            handleClose();
            router.push('/cart'); // Fixed path
          }}
        ]
      );
      
      resetModal();
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add items to cart. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get user's preferred currency
  const userCurrency = profile?.preferred_currency || 'NGN';
  
  // Convert product price to user's currency for display
  const getProductPriceInUserCurrency = () => {
    if (userCurrency === 'NGN') {
      return product.price;
    }
    return convertFromNGN(product.price, userCurrency);
  };

  const productPriceInUserCurrency = getProductPriceInUserCurrency();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Product Details</Text>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#1F2937" />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Product Image */}
          <Image
            source={{ uri: product.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productPrice}>
              {formatCurrency(productPriceInUserCurrency, userCurrency)}
            </Text>
            
            <View style={styles.ratingContainer}>
              <Star size={16} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>4.8 (124 reviews)</Text>
            </View>

            <Text style={styles.productDescription}>{product.description}</Text>
            <Text style={styles.stockText}>
              {product.stock > 0 ? `${product.stock} items in stock` : 'Out of stock'}
            </Text>
          </View>

          {/* Size Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.selectionTitle}>
              Select Sizes ({selectedSizes.length} selected)
            </Text>
            <View style={styles.optionsGrid}>
              {product.sizes.map((size) => (
                <Pressable
                  key={size}
                  style={[
                    styles.optionButton,
                    selectedSizes.includes(size) && styles.optionButtonActive
                  ]}
                  onPress={() => toggleSize(size)}
                >
                  {selectedSizes.includes(size) && (
                    <Check size={16} color="#FFFFFF" style={styles.checkIcon} />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      selectedSizes.includes(size) && styles.optionTextActive
                    ]}
                  >
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Color Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.selectionTitle}>
              Select Colors ({selectedColors.length} selected)
            </Text>
            <View style={styles.optionsGrid}>
              {product.colors.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.optionButton,
                    selectedColors.includes(color) && styles.optionButtonActive
                  ]}
                  onPress={() => toggleColor(color)}
                >
                  {selectedColors.includes(color) && (
                    <Check size={16} color="#FFFFFF" style={styles.checkIcon} />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      selectedColors.includes(color) && styles.optionTextActive
                    ]}
                  >
                    {color}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Quantity Selection */}
          <View style={styles.selectionSection}>
            <Text style={styles.selectionTitle}>Quantity</Text>
            <View style={styles.quantityContainer}>
              <Pressable
                style={styles.quantityButton}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
              >
                <Minus size={20} color="#7C3AED" />
              </Pressable>
              <Text style={styles.quantityText}>{quantity}</Text>
              <Pressable
                style={styles.quantityButton}
                onPress={() => setQuantity(quantity + 1)}
              >
                <Plus size={20} color="#7C3AED" />
              </Pressable>
            </View>
          </View>

          {/* Selection Summary */}
          {(selectedSizes.length > 0 || selectedColors.length > 0) && (
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Selection Summary</Text>
              <Text style={styles.summaryText}>
                {selectedSizes.length * selectedColors.length} combinations will be added to cart
              </Text>
              <Text style={styles.summaryPrice}>
                Total: {formatCurrency(
                  productPriceInUserCurrency * quantity * selectedSizes.length * selectedColors.length, 
                  userCurrency
                )}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Add to Cart Button */}
        <View style={styles.bottomSection}>
          <Pressable
            style={[
              styles.addToCartButton,
              (selectedSizes.length === 0 || selectedColors.length === 0 || loading) && styles.addToCartButtonDisabled
            ]}
            onPress={handleAddToCart}
            disabled={selectedSizes.length === 0 || selectedColors.length === 0 || loading}
          >
            <ShoppingCart size={20} color="#FFFFFF" />
            <Text style={styles.addToCartText}>
              {loading ? 'Adding...' : `Add to Cart (${selectedSizes.length * selectedColors.length} items)`}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  productImage: {
    width: '100%',
    height: 300,
  },
  productInfo: {
    padding: 20,
  },
  productName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  productDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 12,
  },
  stockText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
  },
  selectionSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  selectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    minWidth: 80,
    alignItems: 'center',
    position: 'relative',
  },
  optionButtonActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    minWidth: 40,
    textAlign: 'center',
  },
  summarySection: {
    marginHorizontal: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  summaryPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  bottomSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  addToCartButtonDisabled: {
    opacity: 0.5,
  },
  addToCartText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});