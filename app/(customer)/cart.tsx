import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Plus, Minus, Trash2, ArrowRight, Tag } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { supabase } from '@/lib/supabase';

export default function CartScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, getTotalItems, getSubtotal } = useCart();
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{code: string, discount: number, description: string} | null>(null);
  const [promoError, setPromoError] = useState('');
  const [availablePromos, setAvailablePromos] = useState<any[]>([]);
  const [loadingPromo, setLoadingPromo] = useState(false);

  const userCurrency = profile?.preferred_currency || 'NGN';

  useEffect(() => {
    const fetchPromos = async () => {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('is_active', true);

      if (!error) setAvailablePromos(data || []);
    };

    fetchPromos();
  }, []);

  const handleUpdateQuantity = async (index: number, change: number) => {
    const newQuantity = items[index].quantity + change;
    await updateQuantity(index, newQuantity);
  };

  const handleRemoveItem = async (index: number) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(index) }
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            clearCart();
            setAppliedPromo(null);
            setPromoCode('');
          }
        }
      ]
    );
  };

  const getItemPriceInUserCurrency = (priceInNGN: number) => {
    if (userCurrency === 'NGN') {
      return priceInNGN;
    }
    return convertFromNGN(priceInNGN, userCurrency);
  };

  const getSubtotalInUserCurrency = () => {
    return items.reduce((sum, item) => {
      const itemPrice = getItemPriceInUserCurrency(item.price);
      return sum + (itemPrice * item.quantity);
    }, 0);
  };

  const handleApplyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
  
    if (!code) {
      setPromoError('Please enter a promo code');
      return;
    }

    setLoadingPromo(true);
    setPromoError('');
  
    try {
      // Fetch the promo code from the database
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();
  
      if (error || !data) {
        setPromoError('Invalid or expired promo code');
        setLoadingPromo(false);
        return;
      }
  
      // Check usage limits
      if (data.max_uses !== null && data.current_uses >= data.max_uses) {
        setPromoError('This promo code has reached its usage limit');
        setLoadingPromo(false);
        return;
      }
  
      // Check date validity
      const now = new Date();
      if (data.start_date && new Date(data.start_date) > now) {
        setPromoError('This promo code is not active yet');
        setLoadingPromo(false);
        return;
      }
      
      if (data.end_date && new Date(data.end_date) < now) {
        setPromoError('This promo code has expired');
        setLoadingPromo(false);
        return;
      }
  
      // Check minimum order amount
      if (data.min_order_amount && getSubtotalInUserCurrency() < convertFromNGN(data.min_order_amount, userCurrency)) {
        setPromoError(`Minimum order of ${formatCurrency(convertFromNGN(data.min_order_amount, userCurrency), userCurrency)} required`);
        setLoadingPromo(false);
        return;
      }
  
      // Apply the promo code
      setAppliedPromo({
        code: data.code,
        discount: data.discount_percentage / 100,
        description: data.description
      });
  
      setPromoCode('');
      Alert.alert('Promo Applied!', `${data.description} has been applied to your order.`);
    } catch (error) {
      console.error('Error applying promo code:', error);
      setPromoError('Error applying promo code. Please try again.');
    } finally {
      setLoadingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError('');
  };

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;
    return getSubtotalInUserCurrency() * appliedPromo.discount;
  };

  const getFinalTotal = () => {
    return getSubtotalInUserCurrency() - calculateDiscount();
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Add some items before checkout.');
      return;
    }
    
    // Navigate to checkout with cart data and promo info
    const checkoutData = {
      items,
      appliedPromo,
      subtotal: getSubtotalInUserCurrency(),
      discount: calculateDiscount(),
      finalSubtotal: getFinalTotal()
    };
    
    router.push({
      pathname: '/(customer)/checkout',
      params: { 
        cartData: JSON.stringify(items),
        promoData: appliedPromo ? JSON.stringify(appliedPromo) : undefined
      }
    });
  };

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
        </View>
        
        <View style={styles.emptyContainer}>
          <ShoppingCart size={80} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add some items to your cart to get started
          </Text>
          <Pressable 
            style={styles.shopButton}
            onPress={() => router.push('/(customers)/shop')}
          >
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <Pressable onPress={handleClearCart}>
          <Text style={styles.clearText}>Clear All</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>
            {getTotalItems()} {getTotalItems() === 1 ? 'Item' : 'Items'}
          </Text>
          
          {items.map((item, index) => (
            <View key={`${item.productId}-${item.size}-${item.color}`} style={styles.cartItem}>
              <Image
                source={{ uri: item.productImage }}
                style={styles.itemImage}
                resizeMode="cover"
              />
              
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemVariant}>
                  Size: {item.size} • Color: {item.color}
                </Text>
                <Text style={styles.itemPrice}>
                  {formatCurrency(getItemPriceInUserCurrency(item.price), userCurrency)}
                </Text>
              </View>
              
              <View style={styles.itemActions}>
                <View style={styles.quantityControls}>
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => handleUpdateQuantity(index, -1)}
                  >
                    <Minus size={16} color="#7C3AED" />
                  </Pressable>
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                  <Pressable
                    style={styles.quantityButton}
                    onPress={() => handleUpdateQuantity(index, 1)}
                  >
                    <Plus size={16} color="#7C3AED" />
                  </Pressable>
                </View>
                
                <Pressable
                  style={styles.removeButton}
                  onPress={() => handleRemoveItem(index)}
                >
                  <Trash2 size={16} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        {/* Promo Code Section */}
        <View style={styles.promoSection}>
          <Text style={styles.promoTitle}>Promo Code</Text>
          
          {appliedPromo ? (
            <View style={styles.appliedPromoCard}>
              <View style={styles.appliedPromoInfo}>
                <Tag size={16} color="#10B981" />
                <View style={styles.appliedPromoText}>
                  <Text style={styles.appliedPromoCode}>{appliedPromo.code}</Text>
                  <Text style={styles.appliedPromoDescription}>{appliedPromo.description}</Text>
                </View>
              </View>
              <Pressable style={styles.removePromoButton} onPress={handleRemovePromo}>
                <Text style={styles.removePromoText}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.promoContainer}>
              <TextInput
                style={[styles.promoInput, promoError && styles.promoInputError]}
                value={promoCode}
                onChangeText={(text) => {
                  setPromoCode(text);
                  if (promoError) setPromoError('');
                }}
                placeholder="Enter promo code"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
              <Pressable 
                style={[styles.promoButton, loadingPromo && styles.promoButtonDisabled]} 
                onPress={handleApplyPromo}
                disabled={loadingPromo}
              >
                <Text style={styles.promoButtonText}>
                  {loadingPromo ? 'Applying...' : 'Apply'}
                </Text>
              </Pressable>
            </View>
          )}
          
          {promoError ? (
            <Text style={styles.promoError}>{promoError}</Text>
          ) : null}
          
          {!appliedPromo && availablePromos.length > 0 && (
            <View style={styles.promoHint}>
              <Text style={styles.promoHintText}>
                
                {availablePromos.length > 3 ? ' and more' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Order Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(getSubtotalInUserCurrency(), userCurrency)}
            </Text>
          </View>
          
          {appliedPromo && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount ({appliedPromo.code})</Text>
              <Text style={styles.discountValue}>
                -{formatCurrency(calculateDiscount(), userCurrency)}
              </Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryNote}>Calculated at checkout</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Fee</Text>
            <Text style={styles.summaryNote}>Calculated at checkout</Text>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(getFinalTotal(), userCurrency)}+
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View style={styles.checkoutSection}>
        <Pressable style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>
            Proceed to Checkout
          </Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </Pressable>
      </View>
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
  clearText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  shopButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  shopButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  itemsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  itemsTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  promoSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  promoTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  promoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  promoInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  promoInputError: {
    borderColor: '#EF4444',
  },
  promoButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  promoButtonDisabled: {
    opacity: 0.6,
  },
  promoButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  promoError: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 6,
  },
  promoHint: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  promoHintText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  appliedPromoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  appliedPromoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appliedPromoText: {
    marginLeft: 8,
    flex: 1,
  },
  appliedPromoCode: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  appliedPromoDescription: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#059669',
  },
  removePromoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  removePromoText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  summarySection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  discountValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  summaryNote: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  checkoutSection: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  checkoutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});