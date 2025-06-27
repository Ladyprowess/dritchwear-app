import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShoppingCart, Plus, Minus, Star, Wallet, CreditCard } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal } from '@/lib/fees';
import PaystackPayment from '@/components/PaystackPayment';

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
  onOrderSuccess?: () => void;
}

export default function ProductModal({ product, visible, onClose, onOrderSuccess }: ProductModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'paystack'>('wallet');
  const [processingOrder, setProcessingOrder] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);

  React.useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] || 'One Size');
      setSelectedColor(product.colors[0] || 'Default');
      setQuantity(1);
      setPaymentMethod('wallet');
      setProcessingOrder(false);
      setShowPaystack(false);
    }
  }, [product]);

  if (!product) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const calculateTotal = () => {
    const subtotal = product.price * quantity;
    const location = profile?.location || 'Lagos, Nigeria';
    
    return calculateOrderTotal(subtotal, location);
  };

  const { subtotal, serviceFee, deliveryFee, total } = calculateTotal();

  const handleQuantityChange = (change: number) => {
    const newQuantity = quantity + change;
    if (newQuantity >= 1 && newQuantity <= product.stock) {
      setQuantity(newQuantity);
    }
  };

  const handleWalletPayment = async () => {
    if (!user || !profile) {
      Alert.alert('Authentication Required', 'Please log in to place an order');
      return;
    }

    // Check wallet balance
    if ((profile.wallet_balance || 0) < total) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance is ${formatCurrency(profile.wallet_balance || 0)}. You need ${formatCurrency(total)} to complete this order.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => {
            onClose();
            router.push('/(customer)/fund-wallet');
          }}
        ]
      );
      return;
    }

    setProcessingOrder(true);
    await processOrder('wallet');
  };

  const handlePaystackPayment = () => {
    if (!user || !profile) {
      Alert.alert('Authentication Required', 'Please log in to place an order');
      return;
    }

    if (!process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      Alert.alert(
        'Payment Not Available',
        'Online payment is not configured. Please use wallet payment or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log('Opening Paystack modal for payment...');
    setShowPaystack(true);
  };

  const handlePaystackSuccess = async (response: any) => {
    console.log('Paystack payment successful:', response);
    setShowPaystack(false);
    setProcessingOrder(true);
    await processOrder('paystack', response.reference);
  };

  const handlePaystackCancel = () => {
    console.log('Paystack payment cancelled');
    setShowPaystack(false);
    Alert.alert('Payment Cancelled', 'Your payment was cancelled');
  };

  const processOrder = async (method: 'wallet' | 'paystack', reference?: string) => {
    try {
      if (!user || !profile) {
        throw new Error('User not authenticated');
      }

      console.log('Processing order with method:', method);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          items: [{
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity,
            size: selectedSize,
            color: selectedColor,
          }],
          subtotal,
          service_fee: serviceFee,
          delivery_fee: deliveryFee,
          total,
          payment_method: method,
          payment_status: 'paid',
          order_status: 'pending',
          delivery_address: profile.location || 'Lagos, Nigeria',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Handle payment method specific operations
      if (method === 'wallet') {
        // For wallet payment - deduct from wallet
        const { error: walletError } = await supabase
          .from('profiles')
          .update({
            wallet_balance: (profile.wallet_balance || 0) - total
          })
          .eq('id', user.id);

        if (walletError) throw walletError;

        // Create wallet transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'debit',
            amount: total,
            description: `Order payment - ${product.name}`,
            reference: order.id,
            status: 'completed'
          });

        if (transactionError) throw transactionError;

        // Refresh profile to get updated wallet balance
        await refreshProfile();
      } else if (method === 'paystack') {
        // For Paystack payment - DO NOT deduct from wallet, just create transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'debit',
            amount: total,
            description: `Order payment via Paystack - ${product.name}`,
            reference: reference || order.id,
            status: 'completed'
          });

        if (transactionError) throw transactionError;
        
        // No wallet balance update needed for Paystack payments
        console.log('Paystack payment processed - wallet balance unchanged');
      }

      // Update product stock
      const { error: stockError } = await supabase
        .from('products')
        .update({
          stock: Math.max(0, product.stock - quantity)
        })
        .eq('id', product.id);

      if (stockError) throw stockError;

      Alert.alert(
        'Order Placed Successfully!',
        `Your order for ${product.name} has been placed successfully!`,
        [{ 
          text: 'View Orders', 
          onPress: () => {
            onClose();
            onOrderSuccess?.();
            router.push('/(customer)/orders');
          }
        }]
      );

    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleOrderPress = () => {
    if (product.stock === 0) {
      Alert.alert('Out of Stock', 'This product is currently out of stock');
      return;
    }

    if (processingOrder) return;
    
    if (paymentMethod === 'wallet') {
      handleWalletPayment();
    } else {
      handlePaystackPayment();
    }
  };

  const isOutOfStock = product.stock === 0;
  const isOrderDisabled = isOutOfStock || processingOrder;
  const hasInsufficientBalance = paymentMethod === 'wallet' && (profile?.wallet_balance || 0) < total;

  const getOrderButtonText = () => {
    if (processingOrder) return 'Processing...';
    if (isOutOfStock) return 'Out of Stock';
    if (paymentMethod === 'wallet') {
      if (hasInsufficientBalance) {
        return 'Insufficient Balance';
      }
      return `Pay ${formatCurrency(total)} from Wallet`;
    }
    return `Pay ${formatCurrency(total)} with Card`;
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Product Details</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
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
              <View style={styles.productHeader}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
              </View>

              <View style={styles.ratingContainer}>
                <Star size={16} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.ratingText}>4.8 (124 reviews)</Text>
              </View>

              <Text style={styles.productDescription}>{product.description}</Text>

              <View style={styles.stockInfo}>
                <Text style={[
                  styles.stockText,
                  { color: isOutOfStock ? '#EF4444' : '#10B981' }
                ]}>
                  {isOutOfStock ? 'Out of stock' : `${product.stock} in stock`}
                </Text>
                <Text style={styles.categoryText}>{product.category}</Text>
              </View>
            </View>

            {/* Size Selection */}
            {product.sizes.length > 1 && (
              <View style={styles.selectionSection}>
                <Text style={styles.selectionTitle}>Size</Text>
                <View style={styles.optionsContainer}>
                  {product.sizes.map((size) => (
                    <Pressable
                      key={size}
                      style={[
                        styles.optionChip,
                        selectedSize === size && styles.optionChipActive
                      ]}
                      onPress={() => setSelectedSize(size)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedSize === size && styles.optionTextActive
                        ]}
                      >
                        {size}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Color Selection */}
            {product.colors.length > 1 && (
              <View style={styles.selectionSection}>
                <Text style={styles.selectionTitle}>Color</Text>
                <View style={styles.optionsContainer}>
                  {product.colors.map((color) => (
                    <Pressable
                      key={color}
                      style={[
                        styles.optionChip,
                        selectedColor === color && styles.optionChipActive
                      ]}
                      onPress={() => setSelectedColor(color)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedColor === color && styles.optionTextActive
                        ]}
                      >
                        {color}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Quantity Selection */}
            <View style={styles.selectionSection}>
              <Text style={styles.selectionTitle}>Quantity</Text>
              <View style={styles.quantityContainer}>
                <Pressable
                  style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                  onPress={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                >
                  <Minus size={16} color={quantity <= 1 ? "#9CA3AF" : "#1F2937"} />
                </Pressable>
                <Text style={styles.quantityText}>{quantity}</Text>
                <Pressable
                  style={[styles.quantityButton, quantity >= product.stock && styles.quantityButtonDisabled]}
                  onPress={() => handleQuantityChange(1)}
                  disabled={quantity >= product.stock}
                >
                  <Plus size={16} color={quantity >= product.stock ? "#9CA3AF" : "#1F2937"} />
                </Pressable>
              </View>
            </View>

            {/* Order Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.selectionTitle}>Order Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal ({quantity} item{quantity !== 1 ? 's' : ''})</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service Fee (2%)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(serviceFee)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(deliveryFee)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery to</Text>
                  <Text style={styles.summaryValue}>{profile?.location || 'Lagos, Nigeria'}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>{formatCurrency(total)}</Text>
                </View>
              </View>
            </View>

            {/* Payment Method Selection */}
            <View style={styles.selectionSection}>
              <Text style={styles.selectionTitle}>Payment Method</Text>
              <View style={styles.paymentMethods}>
                <Pressable
                  style={[
                    styles.paymentMethod,
                    paymentMethod === 'wallet' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('wallet')}
                >
                  <Wallet size={20} color={paymentMethod === 'wallet' ? '#7C3AED' : '#6B7280'} />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodTitle,
                      paymentMethod === 'wallet' && styles.paymentMethodTitleActive
                    ]}>
                      Wallet
                    </Text>
                    <Text style={[
                      styles.paymentMethodBalance,
                      hasInsufficientBalance && { color: '#EF4444' }
                    ]}>
                      Balance: {formatCurrency(profile?.wallet_balance || 0)}
                      {hasInsufficientBalance && ' (Insufficient)'}
                    </Text>
                  </View>
                  {hasInsufficientBalance && (
                    <Pressable
                      style={styles.fundWalletButton}
                      onPress={() => {
                        onClose();
                        router.push('/(customer)/fund-wallet');
                      }}
                    >
                      <Text style={styles.fundWalletText}>Fund</Text>
                    </Pressable>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.paymentMethod,
                    paymentMethod === 'paystack' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('paystack')}
                >
                  <CreditCard size={20} color={paymentMethod === 'paystack' ? '#7C3AED' : '#6B7280'} />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodTitle,
                      paymentMethod === 'paystack' && styles.paymentMethodTitleActive
                    ]}>
                      Card/Bank Transfer
                    </Text>
                    <Text style={styles.paymentMethodBalance}>
                      Pay securely with Paystack
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          {/* Order Button */}
          <View style={styles.orderContainer}>
            <Pressable
              style={[
                styles.orderButton, 
                (isOrderDisabled || (paymentMethod === 'wallet' && hasInsufficientBalance)) && styles.orderButtonDisabled
              ]}
              onPress={handleOrderPress}
              disabled={isOrderDisabled || (paymentMethod === 'wallet' && hasInsufficientBalance)}
            >
              <ShoppingCart size={20} color="#FFFFFF" />
              <Text style={styles.orderButtonText}>
                {getOrderButtonText()}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Paystack Payment Modal */}
      <Modal
        visible={showPaystack}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePaystackCancel}
      >
        <SafeAreaView style={styles.paystackModalContainer}>
          <View style={styles.paystackModalHeader}>
            <Text style={styles.paystackModalTitle}>Complete Payment</Text>
            <Pressable style={styles.closeButton} onPress={handlePaystackCancel}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>
          
          {showPaystack && user && profile && (
            <PaystackPayment
              email={user.email || profile.email}
              amount={total}
              publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
              customerName={profile.full_name || user.user_metadata?.full_name || 'Customer'}
              onSuccess={handlePaystackSuccess}
              onCancel={handlePaystackCancel}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
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
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  productName: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginRight: 16,
  },
  productPrice: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
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
    marginBottom: 16,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  optionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityButtonDisabled: {
    opacity: 0.5,
  },
  quantityText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    minWidth: 40,
    textAlign: 'center',
  },
  summarySection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 8,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  summaryTotalValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  paymentMethods: {
    gap: 12,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentMethodActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FEFBFF',
  },
  paymentMethodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  paymentMethodTitleActive: {
    color: '#7C3AED',
  },
  paymentMethodBalance: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  fundWalletButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fundWalletText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  orderContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  orderButtonDisabled: {
    opacity: 0.6,
  },
  orderButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  paystackModalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  paystackModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  paystackModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
});