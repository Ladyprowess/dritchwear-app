import React, { useEffect, useRef, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useCart, CartItem } from '@/contexts/CartContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import OrderDetailsModal from '@/features/shared/orderDetails/components/OrderDetailsModal';

import type { Order, OrderNotice as OrderNoticeType } from '@/features/customer/orders/types';
import { useCustomerOrders } from '@/features/customer/orders/hooks/useCustomerOrders';
import { useInvoiceResponse } from '@/features/customer/orders/hooks/useInvoiceResponse';
import { useCustomOrderPayment } from '@/features/customer/orders/hooks/useCustomOrderPayment';
import { OrderNotice } from '@/features/customer/orders/components/OrderNotice';
import { OrderFilters } from '@/features/customer/orders/components/OrderFilters';
import { OrdersList } from '@/features/customer/orders/components/OrdersList';
import { PaystackPaymentModal } from '@/features/customer/orders/components/PaystackPaymentModal';
import { PaymentChoiceModal } from '@/features/customer/orders/components/PaymentChoiceModal';
import { styles } from '@/features/customer/orders/styles';

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function CustomerOrdersScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const params = useLocalSearchParams();
  const deepLinkOrderId = firstParam(params.orderId as string | string[] | undefined);
  const openedDeepLinkRef = useRef(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderNotice, setOrderNotice] = useState<OrderNoticeType | null>(null);

  const showOrderNotice = (tone: 'error' | 'success' | 'info', message: string, actionLabel?: string, onAction?: () => void) => {
    setOrderNotice({ tone, message, actionLabel, onAction });
  };

  const {
    filteredOrders,
    selectedStatus,
    setSelectedStatus,
    loading,
    refreshing,
    onRefresh,
    fetchOrders,
  } = useCustomerOrders(user?.id, (message) => showOrderNotice('error', message));

  const { processingInvoice, handleAcceptInvoice, handleRejectInvoice } = useInvoiceResponse(
    profile?.preferred_currency,
    fetchOrders,
    (message) => showOrderNotice('error', message)
  );

  const {
    showPaystack,
    paymentInvoice,
    paymentChoice,
    setPaymentChoice,
    handlePayForCustomOrder,
    handleWalletPayment,
    handleOnlinePayment,
    handlePaystackSuccess,
    handlePaystackCancel,
  } = useCustomOrderPayment({
    profile,
    userId: user?.id,
    refreshProfile,
    onNotice: showOrderNotice,
    onPaymentComplete: fetchOrders,
  });

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  // Supports emailed links like /orders?orderId=<id> (payment reminders,
  // status updates) opening straight into that order instead of dropping the
  // customer on the bare list. Only fires once per link, even if
  // filteredOrders updates again later (e.g. a realtime refresh).
  useEffect(() => {
    if (!deepLinkOrderId || openedDeepLinkRef.current) return;
    const match = filteredOrders.find((order) => order.id === deepLinkOrderId);
    if (!match) return;
    openedDeepLinkRef.current = true;
    handleOrderPress(match);
    router.setParams({ orderId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkOrderId, filteredOrders]);

  const handleRepeatOrder = async (order: Order) => {
    if (!order.items || order.items.length === 0) return;

    const cartItems: CartItem[] = order.items.map((item: any) => ({
      productId:    item.product_id ?? item.productId ?? '',
      productName:  item.name ?? item.productName ?? 'Product',
      productImage: item.image ?? item.productImage ?? '',
      price:        item.price ?? 0,
      size:         item.size ?? '',
      color:        item.color ?? '',
      quantity:     item.quantity ?? 1,
      note:         typeof item.note === 'string' && item.note.trim()
        ? item.note.trim()
        : undefined,
      logoUrl:      typeof item.logo_url === 'string' && item.logo_url ? item.logo_url : undefined,
    }));

    await addToCart(cartItems);
    if (Platform.OS === 'web') {
      showOrderNotice('success', 'Items from this order were added to your cart.', 'Go to cart', () => router.push('/(customer)/cart'));
      return;
    }
    Alert.alert(
      'Added to Cart',
      'Items from this order have been added to your cart.',
      [
        { text: 'Continue Shopping', style: 'cancel' },
        { text: 'Go to Cart', onPress: () => router.push('/(customer)/cart') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      <OrderNotice notice={orderNotice} onDismiss={() => setOrderNotice(null)} />

      <OrderFilters selectedStatus={selectedStatus} onSelectStatus={setSelectedStatus} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <OrdersList
          orders={filteredOrders}
          loading={loading}
          selectedStatus={selectedStatus}
          preferredCurrency={profile?.preferred_currency}
          processingInvoice={processingInvoice}
          onOrderPress={handleOrderPress}
          onRepeatOrder={handleRepeatOrder}
          onAcceptInvoice={handleAcceptInvoice}
          onRejectInvoice={handleRejectInvoice}
          onPayForCustomOrder={handlePayForCustomOrder}
        />
      </ScrollView>

      <OrderDetailsModal
        order={selectedOrder}
        visible={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        onOrderUpdate={fetchOrders}
      />

      <PaystackPaymentModal
        visible={showPaystack}
        paymentInvoice={paymentInvoice}
        userEmail={user?.email}
        customerName={user?.user_metadata?.full_name}
        onSuccess={handlePaystackSuccess}
        onCancel={handlePaystackCancel}
      />

      <PaymentChoiceModal
        paymentChoice={paymentChoice}
        preferredCurrency={profile?.preferred_currency}
        onClose={() => setPaymentChoice(null)}
        onPayWithWallet={handleWalletPayment}
        onPayOnline={handleOnlinePayment}
      />
    </SafeAreaView>
  );
}
