import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ShoppingCart, Plus, Minus, Star, Wallet, CreditCard } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal } from '@/lib/fees';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import PaystackPayment from '@/components/PaystackPayment';
import PayPalPayment from '@/components/PayPalPayment';

// import PayPalPayment from '@/components/PayPalPayment'; // You'll need to create this component

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
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card'>('wallet');
  const [processingOrder, setProcessingOrder] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Get user's preferred currency
  const userCurrency = profile?.preferred_currency || 'NGN';
  const isNairaCurrency = userCurrency === 'NGN';

  React.useEffect(() => {
    if (product) {
      setSelectedSize(product.sizes[0] || 'One Size');
      setSelectedColor(product.colors[0] || 'Default');
      setQuantity(1);
      setPaymentMethod('wallet');
      setProcessingOrder(false);
      setShowPaymentModal(false);
    }
  }, [product]);

  if (!product) return null;

  // Convert product price to user's preferred currency
  const getProductPriceInUserCurrency = (priceInNGN: number) => {
    if (userCurrency === 'NGN') {
      return priceInNGN;
    }
    return convertFromNGN(priceInNGN, userCurrency);
  };

  const productPrice = getProductPriceInUserCurrency(product.price);

  const calculateTotal = () => {
    const subtotal = productPrice * quantity;
    const location = profile?.location || 'Lagos, Nigeria';
    
    // For non-NGN currencies, we might need to adjust the fee calculation
    if (userCurrency !== 'NGN') {
      // Convert fees from NGN to user currency
      const ngnSubtotal = product.price * quantity;
      const ngnFees = calculateOrderTotal(ngnSubtotal, location);
      
      return {
        subtotal,
        serviceFee: convertFromNGN(ngnFees.serviceFee, userCurrency),
        deliveryFee: convertFromNGN(ngnFees.deliveryFee, userCurrency),
        total: subtotal + convertFromNGN(ngnFees.serviceFee, userCurrency) + convertFromNGN(ngnFees.deliveryFee, userCurrency)
      };
    }
    
    return calculateOrderTotal(subtotal, location);
  };

  const { subtotal, serviceFee, deliveryFee, total } = calculateTotal();

  // Convert wallet balance to user's preferred currency for display
  const walletBalanceInUserCurrency = userCurrency === 'NGN' 
    ? (profile?.wallet_balance || 0)
    : convertFromNGN(profile?.wallet_balance || 0, userCurrency);

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

    // For wallet payments, always convert to NGN since wallet balance is stored in NGN
    const totalInNGN = userCurrency === 'NGN' ? total : (product.price * quantity + calculateOrderTotal(product.price * quantity, profile.location || 'Lagos, Nigeria').serviceFee + calculateOrderTotal(product.price * quantity, profile.location || 'Lagos, Nigeria').deliveryFee);

    // Check wallet balance (always in NGN)
    if ((profile.wallet_balance || 0) < totalInNGN) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance is ${formatCurrency(walletBalanceInUserCurrency, userCurrency)}. You need ${formatCurrency(total, userCurrency)} to complete this order.`,
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
    await processOrder('wallet', totalInNGN);
  };

  const handleCardPayment = () => {
    if (!user || !profile) {
      Alert.alert('Authentication Required', 'Please log in to place an order');
      return;
    }

    // Check if payment gateway is configured
    const hasPaystackKey = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY;
    const hasPayPalKey = process.env.EXPO_PUBLIC_PAYPAL_CLIENT_ID;

    if (isNairaCurrency && !hasPaystackKey) {
      Alert.alert(
        'Payment Not Available',
        'Paystack payment is not configured. Please use wallet payment or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isNairaCurrency && !hasPayPalKey) {
      Alert.alert(
        'Payment Not Available',
        'PayPal payment is not configured. Please use wallet payment or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    console.log(`Opening ${isNairaCurrency ? 'Paystack' : 'PayPal'} modal for payment...`);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async (response: any) => {
    console.log(`${isNairaCurrency ? 'Paystack' : 'PayPal'} payment successful:`, response);
    setShowPaymentModal(false);
    setProcessingOrder(true);
    
    // For card payments, always use the amount in the original currency
    const totalForOrder = userCurrency === 'NGN' ? total : (product.price * quantity + calculateOrderTotal(product.price * quantity, profile?.location || 'Lagos, Nigeria').serviceFee + calculateOrderTotal(product.price * quantity, profile?.location || 'Lagos, Nigeria').deliveryFee);
    
    await processOrder('card', totalForOrder, response.reference || response.id);
  };

  const handlePaymentCancel = () => {
    console.log(`${isNairaCurrency ? 'Paystack' : 'PayPal'} payment cancelled`);
    setShowPaymentModal(false);
    Alert.alert('Payment Cancelled', 'Your payment was cancelled');
  };

  const processOrder = async (method: 'wallet' | 'card', orderTotal: number, reference?: string) => {
    try {
      if (!user || !profile) {
        throw new Error('User not authenticated');
      }

      console.log('Processing order with method:', method);

      // Create order - store amounts in the original currency but convert to NGN for backend
      const orderData = {
        user_id: user.id,
        items: [{
          product_id: product.id,
          name: product.name,
          price: product.price, // Always store original NGN price
          quantity,
          size: selectedSize,
          color: selectedColor,
        }],
        subtotal: userCurrency === 'NGN' ? subtotal : product.price * quantity,
        service_fee: userCurrency === 'NGN' ? serviceFee : calculateOrderTotal(product.price * quantity, profile.location || 'Lagos, Nigeria').serviceFee,
        delivery_fee: userCurrency === 'NGN' ? deliveryFee : calculateOrderTotal(product.price * quantity, profile.location || 'Lagos, Nigeria').deliveryFee,
        total: userCurrency === 'NGN' ? total : orderTotal,
        payment_method: method === 'wallet' ? 'wallet' : (isNairaCurrency ? 'paystack' : 'paypal'),
        payment_status: 'paid',
        order_status: 'pending',
        delivery_address: profile.location || 'Lagos, Nigeria',
        currency: userCurrency, // Store the currency used for the order
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Handle wallet operations only for wallet payments
      if (method === 'wallet') {
        console.log('Processing wallet payment - deducting from wallet');
        
        // Deduct from wallet (always in NGN)
        const { error: walletError } = await supabase
          .from('profiles')
          .update({
            wallet_balance: (profile.wallet_balance || 0) - orderTotal
          })
          .eq('id', user.id);

        if (walletError) throw walletError;

        // Create wallet transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'debit',
            amount: orderTotal,
            description: `Order payment - ${product.name}`,
            reference: order.id,
            status: 'completed',
            currency: 'NGN' // Wallet transactions are always in NGN
          });

        if (transactionError) throw transactionError;

        // Refresh profile to get updated wallet balance
        await refreshProfile();
        
      } else if (method === 'card') {
        console.log(`Processing ${isNairaCurrency ? 'Paystack' : 'PayPal'} payment - NO wallet deduction`);
        
        // For card payments - ONLY create transaction record, DO NOT touch wallet
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'debit',
            amount: orderTotal,
            description: `Order payment via ${isNairaCurrency ? 'Paystack' : 'PayPal'} - ${product.name}`,
            reference: reference || order.id,
            status: 'completed',
            currency: userCurrency
          });

        if (transactionError) throw transactionError;
        
        console.log(`${isNairaCurrency ? 'Paystack' : 'PayPal'} payment processed - wallet balance unchanged`);
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
      handleCardPayment();
    }
  };

  const isOutOfStock = product.stock === 0;
  const isOrderDisabled = isOutOfStock || processingOrder;
  const hasInsufficientBalance = paymentMethod === 'wallet' && walletBalanceInUserCurrency < total;

  const getOrderButtonText = () => {
    if (processingOrder) return 'Processing...';
    if (isOutOfStock) return 'Out of Stock';
    if (paymentMethod === 'wallet') {
      if (hasInsufficientBalance) {
        return 'Insufficient Balance';
      }
      return `Pay ${formatCurrency(total, userCurrency)} from Wallet`;
    }
    return `Pay ${formatCurrency(total, userCurrency)} with ${isNairaCurrency ? 'Card' : 'PayPal'}`;
  };

  const getPaymentMethodTitle = () => {
    if (isNairaCurrency) {
      return 'Card/Bank Transfer';
    }
    return 'PayPal';
  };

  const getPaymentMethodSubtitle = () => {
    if (isNairaCurrency) {
      return 'Pay securely with Paystack';
    }
    return 'Pay securely with PayPal';
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
                <Text style={styles.productPrice}>{formatCurrency(productPrice, userCurrency)}</Text>
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
                  <Text style={styles.summaryValue}>{formatCurrency(subtotal, userCurrency)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service Fee (2%)</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(serviceFee, userCurrency)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(deliveryFee, userCurrency)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Currency</Text>
                  <Text style={styles.summaryValue}>{userCurrency}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery to</Text>
                  <Text style={styles.summaryValue}>{profile?.location || 'Lagos, Nigeria'}</Text>
                </View>
                <View style={[styles.summaryRow, styles.summaryTotal]}>
                  <Text style={styles.summaryTotalLabel}>Total</Text>
                  <Text style={styles.summaryTotalValue}>{formatCurrency(total, userCurrency)}</Text>
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
                      Balance: {formatCurrency(walletBalanceInUserCurrency, userCurrency)}
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
                    paymentMethod === 'card' && styles.paymentMethodActive
                  ]}
                  onPress={() => setPaymentMethod('card')}
                >
                  <CreditCard size={20} color={paymentMethod === 'card' ? '#7C3AED' : '#6B7280'} />
                  <View style={styles.paymentMethodInfo}>
                    <Text style={[
                      styles.paymentMethodTitle,
                      paymentMethod === 'card' && styles.paymentMethodTitleActive
                    ]}>
                      {getPaymentMethodTitle()}
                    </Text>
                    <Text style={styles.paymentMethodBalance}>
                      {getPaymentMethodSubtitle()}
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

      {/* Payment Modal */}
      <Modal
  visible={showPaymentModal}
  animationType="slide"
  presentationStyle="pageSheet"
  onRequestClose={handlePaymentCancel}
>
  <SafeAreaView style={styles.paystackModalContainer}>
    <View style={styles.paystackModalHeader}>
      <Text style={styles.paystackModalTitle}>
        Complete Payment - {formatCurrency(total, userCurrency)}
      </Text>
      <Pressable style={styles.closeButton} onPress={handlePaymentCancel}>
        <X size={24} color="#1F2937" />
      </Pressable>
    </View>

    {/* ✅ Correctly rendered condition */}
    {showPaymentModal && user && profile && (
      <>
        {isNairaCurrency ? (
          <PaystackPayment
            email={user.email || profile.email}
            amount={total}
            publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
            customerName={profile.full_name || user.user_metadata?.full_name || 'Customer'}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        ) : (
          <PayPalPayment
            email={user.email || profile.email}
            amount={total}
            currency={userCurrency}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
          />
        )}
      </>
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