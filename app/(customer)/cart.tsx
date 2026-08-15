import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { ArrowRight, Tag } from 'lucide-react-native';
import { getItemPriceInUserCurrency } from '@/lib/currency';
import { usePostHog } from 'posthog-react-native';
import { fetchCommerceConfig } from '@/lib/commerceSettings';
import { DEFAULT_COMMERCE_CONFIG } from '@/lib/fees';

import { usePromoCode } from '@/features/customer/cart/hooks/usePromoCode';
import { CartItemRow } from '@/features/customer/cart/components/CartItemRow';
import { PromoSection } from '@/features/customer/cart/components/PromoSection';
import { OrderSummary } from '@/features/customer/cart/components/OrderSummary';
import { EmptyCartView } from '@/features/customer/cart/components/EmptyCartView';
import { styles } from '@/features/customer/cart/styles';

export default function CartScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { items, updateQuantity, removeItem, clearCart, getTotalItems, appliedPromo, setAppliedPromo } = useCart();
  const posthog = usePostHog();
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(DEFAULT_COMMERCE_CONFIG.minimumOrderQuantity);

  const userCurrency = profile?.preferred_currency || 'NGN';

  useEffect(() => {
    posthog.capture('cart_viewed', { items_count: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    fetchCommerceConfig().then((c) => { if (active) setMinimumOrderQuantity(c.minimumOrderQuantity); });
    return () => { active = false; };
  }, []);

  const subtotalInUserCurrency = items.reduce((sum, item) => {
    const itemPrice = getItemPriceInUserCurrency(item.price, userCurrency);
    return sum + (itemPrice * item.quantity);
  }, 0);

  const {
    promoError,
    setPromoError,
    availablePromos,
    showPromoDropdown,
    setShowPromoDropdown,
    applyingPromo,
    validatingPromo,
    checkPromoUsage,
    handleSelectPromo,
    handleRemovePromo,
  } = usePromoCode({
    profileId: profile?.id,
    userCurrency,
    subtotalInUserCurrency,
    totalItems: getTotalItems(),
    appliedPromo,
    setAppliedPromo,
  });

  const handleUpdateQuantity = async (index: number, change: number) => {
    const newQuantity = items[index].quantity + change;
    await updateQuantity(index, newQuantity);
  };

  const handleRemoveItem = async (index: number) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this item from your cart?')) await removeItem(index);
      return;
    }
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(index) }
      ]
    );
  };

  const handleClearCart = async () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Remove every item from your cart?')) {
        await clearCart();
        setPromoError('');
      }
      return;
    }
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearCart(); // This now clears both cart and promo
            setPromoError('');
          }
        }
      ]
    );
  };

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;
    return subtotalInUserCurrency * appliedPromo.discount;
  };

  const getFinalTotal = () => {
    return subtotalInUserCurrency - calculateDiscount();
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('Empty Cart', 'Your cart is empty. Add some items before checkout.');
      return;
    }
    if (getTotalItems() < minimumOrderQuantity) {
      Alert.alert(
        'Minimum Order Not Met',
        `We require at least ${minimumOrderQuantity} items per order. Add ${minimumOrderQuantity - getTotalItems()} more item${minimumOrderQuantity - getTotalItems() === 1 ? '' : 's'} to continue.`
      );
      return;
    }
    if (!user) {
      router.push('/(auth)/welcome');
      return;
    }

    // Re-validate promo before checkout
    if (appliedPromo && profile?.id) {
      const hasUsed = await checkPromoUsage(appliedPromo.promoId, profile.id);
      if (hasUsed) {
        await setAppliedPromo(null);
        Alert.alert(
          'Promo Code Invalid',
          'The promo code has already been used and has been removed from your cart.'
        );
        return;
      }
    }

    // Navigate to checkout with cart data and promo info (only if promo is valid)
    router.push({
      pathname: '/(customer)/checkout',
      params: {
        cartData: JSON.stringify(items)
      }
    });
  };

  if (items.length === 0) {
    return <EmptyCartView onShopPress={() => router.push('/(customer)/shop')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <Pressable onPress={handleClearCart}>
          <Text style={styles.clearText}>Clear All</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsContainer}>
          <Text style={styles.itemsTitle}>
            {getTotalItems()} {getTotalItems() === 1 ? 'Item' : 'Items'}
          </Text>

          {items.map((item, index) => (
            <CartItemRow
              key={`${item.productId}-${item.size}-${item.color}-${item.note ?? ''}`}
              item={item}
              itemPriceInUserCurrency={getItemPriceInUserCurrency(item.price, userCurrency)}
              userCurrency={userCurrency}
              onIncrement={() => handleUpdateQuantity(index, 1)}
              onDecrement={() => handleUpdateQuantity(index, -1)}
              onRemove={() => handleRemoveItem(index)}
            />
          ))}
        </View>

        <View style={styles.cartMomentumCard}>
          <View style={styles.cartMomentumIcon}>
            <Tag size={17} color="#FDB813" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cartMomentumTitle}>Your picks are waiting</Text>
            <Text style={styles.cartMomentumText}>
              Check out now to lock in your order, earn loyalty points, and grab any active % offer before it's gone.
            </Text>
          </View>
        </View>

        <PromoSection
          validatingPromo={validatingPromo}
          appliedPromo={appliedPromo}
          availablePromos={availablePromos}
          showPromoDropdown={showPromoDropdown}
          applyingPromo={applyingPromo}
          promoError={promoError}
          onToggleDropdown={() => { setShowPromoDropdown(v => !v); setPromoError(''); }}
          onSelectPromo={handleSelectPromo}
          onRemovePromo={handleRemovePromo}
        />

        <OrderSummary
          subtotal={subtotalInUserCurrency}
          discount={calculateDiscount()}
          finalTotal={getFinalTotal()}
          appliedPromo={appliedPromo}
          userCurrency={userCurrency}
        />
      </ScrollView>

      <View style={styles.checkoutSection}>
        {getTotalItems() < minimumOrderQuantity && (
          <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: '#B45309', textAlign: 'center', marginBottom: 10 }}>
            Add {minimumOrderQuantity - getTotalItems()} more item{minimumOrderQuantity - getTotalItems() === 1 ? '' : 's'} to meet our {minimumOrderQuantity}-item minimum order
          </Text>
        )}
        <Pressable
          style={[styles.checkoutButton, getTotalItems() < minimumOrderQuantity && { opacity: 0.5 }]}
          onPress={handleCheckout}
          disabled={getTotalItems() < minimumOrderQuantity}
        >
          <Text style={styles.checkoutButtonText}>
            Proceed to Checkout
          </Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
