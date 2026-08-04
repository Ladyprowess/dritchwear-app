import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '@/lib/supabase';
import { calculateOrderTotal, type CommerceConfig } from '@/lib/fees';
import { buildPayLink } from '@/lib/pay-links';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import { logEvent } from '@/lib/analytics';
import type { CartItem, AppliedPromo } from '@/contexts/CartContext';
import type { Profile } from '@/lib/auth';
import { calculateDiscountNGN } from '../pricing';

// This module is the ONLY place allowed to call the Paystack SDK or write to
// orders / profiles.wallet_balance / transactions. Every function here is a
// verbatim, unreordered move from the original checkout.tsx - see the plan's
// checkout guardrails (pure-move-first, no "cleanup" of the sequential
// Supabase calls or the existing swallowed-error / posthog patterns).

interface UsePaymentOrchestrationArgs {
  user: { id: string; email?: string | null; user_metadata?: any } | null;
  profile: Profile | null;
  items: CartItem[];
  appliedPromo: AppliedPromo | null;
  userCurrency: string;
  config: CommerceConfig;
  deliveryAddress: string;
  deliveryState: string;
  deliveryCountry: string;
  contactPhone: string;
  orderNote: string;
  getSubtotalInNGN: () => number;
  getFullDeliveryAddress: () => string;
  getTotalItems: () => number;
  effectivePromoType: (promoType?: string) => string | undefined;
  refreshProfile: () => Promise<void>;
  refreshPoints: () => Promise<void>;
  clearCart: () => Promise<void>;
  showCheckoutNotice: (title: string, message: string) => void;
  setWebNotice: (notice: { title: string; message: string; onClose?: () => void } | null) => void;
}

export function usePaymentOrchestration({
  user,
  profile,
  items,
  appliedPromo,
  userCurrency,
  config,
  deliveryAddress,
  deliveryState,
  deliveryCountry,
  contactPhone,
  orderNote,
  getSubtotalInNGN,
  getFullDeliveryAddress,
  getTotalItems,
  effectivePromoType,
  refreshProfile,
  refreshPoints,
  clearCart,
  showCheckoutNotice,
  setWebNotice,
}: UsePaymentOrchestrationArgs) {
  const router = useRouter();
  const posthog = usePostHog();

  const [loading, setLoading] = useState(false);
  const [showPaystack, setShowPaystack] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [showPayLinkModal, setShowPayLinkModal] = useState(false);
  const [payLinkLoading, setPayLinkLoading] = useState(false);
  const [generatedPayLink, setGeneratedPayLink] = useState('');

  // Blocks checkout when the admin has closed the store or the cart is below the
  // configured minimum order. Returns true when a guard fired.
  const checkoutBlocked = (): boolean => {
    if (!config.storeOpen) {
      showCheckoutNotice('Store Closed', config.storeClosedMessage);
      return true;
    }
    if (getSubtotalInNGN() < config.minimumOrderNgn) {
      const minInUserCurrency = userCurrency === 'NGN'
        ? config.minimumOrderNgn
        : convertFromNGN(config.minimumOrderNgn, userCurrency);
      showCheckoutNotice(
        'Minimum Order Not Met',
        `Orders must be at least ${formatCurrency(minInUserCurrency, userCurrency)}. Please add more items to continue.`
      );
      return true;
    }
    return false;
  };

  const handlePayForMe = async () => {
    if (checkoutBlocked()) return;
    if (!deliveryAddress.trim() || !deliveryState.trim() || !deliveryCountry.trim()) {
      showCheckoutNotice('Delivery Address Required', 'Please enter your delivery address, state, and country before generating a payment link.');
      return;
    }
    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 10) {
      showCheckoutNotice('Phone Required', 'Please enter a valid contact phone number.');
      return;
    }
    if (!user || !profile) {
      showCheckoutNotice('Sign in required', 'Sign in before creating a Pay for Me link so the payment stays connected to your order.');
      return;
    }

    setPayLinkLoading(true);
    try {
      const subtotalNGN = getSubtotalInNGN();
      const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
      const discountedSubtotalNGN = subtotalNGN - discountNGN;
      const fullDeliveryAddress = getFullDeliveryAddress();
      const orderTotalsForLink = calculateOrderTotal(discountedSubtotalNGN, fullDeliveryAddress, 'NGN', 0, effectivePromoType(appliedPromo?.type), config);

      const orderItems = items.map(item => ({
        product_id: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        note: item.note ?? null,
        logo_url: item.logoUrl ?? null,
      }));

      // Create order with pending_payment status
      const { data: orderRecord, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          items: orderItems,
          subtotal: orderTotalsForLink.subtotal,
          service_fee: orderTotalsForLink.serviceFee,
          delivery_fee: orderTotalsForLink.deliveryFee,
          tax: orderTotalsForLink.tax,
          total: orderTotalsForLink.total,
          payment_method: 'pay_link',
          payment_status: 'pending_payment',
          order_status: 'pending_payment',
          delivery_address: fullDeliveryAddress,
          delivery_state: deliveryState.trim(),
          delivery_country: deliveryCountry.trim(),
          contact_phone: contactPhone.trim(),
          currency: 'NGN',
          promo_code: appliedPromo?.code || null,
          promo_code_id: appliedPromo?.promoId || null,
          discount_amount: discountNGN,
          notes: orderNote.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Generate a unique token
      const token = `${orderRecord.id.replace(/-/g, '').slice(0, 16)}`;
      const payLink = buildPayLink(token);

      // Store the link in payment_links table
      const { error: linkError } = await supabase
        .from('payment_links')
        .insert({
          order_id: orderRecord.id,
          user_id: user.id,
          token,
          amount_ngn: orderTotalsForLink.total,
          status: 'pending',
          requester_name: profile?.full_name || 'Someone',
          items: orderItems,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        });

      if (linkError) {
        await supabase.from('orders').delete().eq('id', orderRecord.id).eq('payment_status', 'pending_payment');
        throw linkError;
      }

      // Email + notify the customer that an order is awaiting payment (best-effort).
      supabase.functions.invoke('send-payment-reminder', {
        body: { orderId: orderRecord.id, source: 'initial' },
      }).then(({ error }) => {
        if (error) console.error('Initial payment reminder failed:', error.message);
      }).catch((error) => console.error('Initial payment reminder failed:', error));

      posthog.capture('pay_for_me_link_created', {
        order_id: orderRecord.id,
        amount_ngn: orderTotalsForLink.total,
        items_count: orderItems.length,
      });
      setGeneratedPayLink(payLink);
      setShowPayLinkModal(true);
    } catch (error: any) {
      showCheckoutNotice('Error', error.message || 'Could not generate payment link. Please try again.');
    } finally {
      setPayLinkLoading(false);
    }
  };

  const processWalletPayment = async (orderTotals: any, discountAmount: number) => {
    try {
      // Prepare order items for database
      const orderItems = items.map(item => ({
        product_id: item.productId,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        note: item.note ?? null,
        logo_url: item.logoUrl ?? null,
      }));

      const fullDeliveryAddress = getFullDeliveryAddress();

      // First validate stock availability using the database function
      const { error: stockValidationError } = await supabase.rpc('validate_stock_availability', {
        order_items: orderItems
      });

      if (stockValidationError) {
        throw new Error(`Stock validation failed: ${stockValidationError.message}`);
      }

      // Create order record with payment_status 'paid' to trigger stock reduction
      const { data: orderRecord, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user!.id,
          items: orderItems,
          subtotal: orderTotals.subtotal,
          service_fee: orderTotals.serviceFee,
          delivery_fee: orderTotals.deliveryFee,
          tax: orderTotals.tax,
          total: orderTotals.total,
          payment_method: 'wallet',
          payment_status: 'paid',
          order_status: 'pending',
          delivery_address: fullDeliveryAddress,
          delivery_state: deliveryState.trim(),
          delivery_country: deliveryCountry.trim(),
          contact_phone: contactPhone.trim(),
          currency: 'NGN',
          promo_code: appliedPromo?.code || null,
          promo_code_id: appliedPromo?.promoId || null,
          discount_amount: discountAmount,
          notes: orderNote.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      console.log('Order created successfully:', orderRecord.id);
      await logEvent('purchase', {
        transaction_id: orderRecord.id,
        currency: 'NGN',
        value: orderTotals.total,
      });

      posthog.capture('order_placed', {
        order_id: orderRecord.id,
        payment_method: 'wallet',
        currency: 'NGN',
        total: orderTotals.total,
        items_count: getTotalItems(),
        promo_code: appliedPromo?.code ?? null,
      });
      console.log('Promo used with ID:', appliedPromo?.promoId); // Debug log

      // Deduct from wallet
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: profile!.wallet_balance - orderTotals.total
        })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'debit',
          amount: orderTotals.total,
          description: `Order payment - ${getTotalItems()} items${appliedPromo ? ` (${appliedPromo.code} applied)` : ''}`,
          reference: orderRecord.id,
          status: 'completed'
        });

      if (transactionError) throw transactionError;

      await refreshProfile();

      await refreshPoints().catch(() => {});

      // CRITICAL: Clear cart immediately - this removes promo from context
      await clearCart();

      // back() pops checkout off the tab stack so swiping back from Orders
      // never returns to checkout. navigate() then switches to the Orders tab.
      const goToOrders = () => {
        router.back();
        router.navigate('/(customer)/orders');
      };
      if (Platform.OS === 'web') {
        // On web, Alert.alert is a no-op and navigating unmounts this screen
        // before any modal could show - so confirm first, navigate on dismiss.
        setWebNotice({
          title: '🎉 Order Placed Successfully',
          message: 'Your order has been confirmed!\n\n+5 loyalty points have been added to your account.',
          onClose: goToOrders,
        });
      } else {
        goToOrders();
        Alert.alert('🎉 Order Placed Successfully', 'Your order has been confirmed!\n\n+5 loyalty points have been added to your account.');
      }
    } catch (error) {
      console.error('Error processing wallet payment:', error);
      posthog.captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'processWalletPayment',
      });
      throw error;
    }
  };

  const handleOrder = async (paymentMethod: 'wallet' | 'card') => {
    if (checkoutBlocked()) return;
    if (!deliveryAddress.trim() || !deliveryState.trim() || !deliveryCountry.trim()) {
      showCheckoutNotice(
        'Delivery Address Required',
        'Please enter your delivery address, state, and country.'
      );
      return;
    }
    if (!contactPhone.trim() || contactPhone.replace(/\D/g, '').length < 10) {
      showCheckoutNotice('Phone Required', 'Please enter a valid contact phone number for delivery.');
      return;
    }

    if (!user || !profile) {
      showCheckoutNotice('Authentication Required', 'Please sign in to place an order');
      return;
    }

    setLoading(true);

    await logEvent('add_payment_info', {
      payment_method: paymentMethod,
    });

    try {
      // Calculate totals in NGN (our base currency) with discount applied
      const subtotalNGN = getSubtotalInNGN();
      const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
      const discountedSubtotalNGN = subtotalNGN - discountNGN;
      const fullDeliveryAddress = getFullDeliveryAddress();

      const orderTotals = calculateOrderTotal(discountedSubtotalNGN, fullDeliveryAddress, 'NGN', 0, effectivePromoType(appliedPromo?.type), config);

      // For wallet payment, check balance
      if (paymentMethod === 'wallet') {
        if (profile.wallet_balance < orderTotals.total) {
          const neededInUserCurrency = convertFromNGN(orderTotals.total, userCurrency);
          const balanceInUserCurrency = convertFromNGN(profile.wallet_balance, userCurrency);

          showCheckoutNotice(
            'Insufficient Balance',
            `Your wallet balance is ${formatCurrency(balanceInUserCurrency, userCurrency)}. You need ${formatCurrency(neededInUserCurrency, userCurrency)} to complete this order.`
          );
          setLoading(false);
          return;
        }

        // Process wallet payment immediately
        await processWalletPayment(orderTotals, discountNGN);
      } else {
        // Prepare for online payment
        const paymentCurrency = userCurrency;
        const paymentAmount = userCurrency === 'NGN' ?
          orderTotals.total :
          convertFromNGN(orderTotals.total, userCurrency);

        const orderInfo = {
          ...orderTotals,
          items: items.map(item => ({
            product_id: item.productId,
            name: item.productName,
            price: item.price,
            quantity: item.quantity,
            size: item.size,
            color: item.color,
            note: item.note ?? null,
            logo_url: item.logoUrl ?? null,
          })),
          delivery_address: fullDeliveryAddress,
          delivery_state: deliveryState.trim(),
          delivery_country: deliveryCountry.trim(),
          contact_phone: contactPhone.trim(),
          payment_method: paymentMethod,
          currency: paymentCurrency,
          original_amount: paymentAmount,
          appliedPromo,
          discountAmount: discountNGN,
          notes: orderNote.trim() || null,
          description: orderNote.trim() || null,
        };

        setOrderData(orderInfo);

        if (paymentMethod === 'card' && userCurrency === 'NGN') {
          setShowPaystack(true);
        }
      }
    } catch (error) {
      console.error('Error processing order:', error);
      showCheckoutNotice('Error', 'Failed to process order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const completeOnlinePayment = async (reference: string, provider: string) => {
    try {
      if (!orderData) throw new Error('Order data not found');

      // First validate stock availability using the database function
      const { error: stockValidationError } = await supabase.rpc('validate_stock_availability', {
        order_items: orderData.items
      });

      if (stockValidationError) {
        throw new Error(`Stock validation failed: ${stockValidationError.message}`);
      }

      // Create order record - stock will be automatically reduced by database trigger
      const { data: orderRecord, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user!.id,
          items: orderData.items,
          subtotal: orderData.subtotal,
          service_fee: orderData.serviceFee,
          delivery_fee: orderData.deliveryFee,
          tax: orderData.tax,
          total: orderData.total,
          payment_method: provider,
          payment_status: 'paid',
          order_status: 'pending',
          delivery_address: orderData.delivery_address,
          delivery_state: orderData.delivery_state,
          delivery_country: orderData.delivery_country,
          contact_phone: orderData.contact_phone || '',
          currency: orderData.currency,
          original_amount: orderData.original_amount,
          promo_code: orderData.appliedPromo?.code || null,
          promo_code_id: orderData.appliedPromo?.promoId || null,
          discount_amount: orderData.discountAmount || 0,
          notes: orderNote.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      console.log('Online payment order created successfully:', orderRecord.id);
      await logEvent('purchase', {
        transaction_id: orderRecord.id,
        currency: orderData.currency,
        value: orderData.total,
      });

      posthog.capture('order_placed', {
        order_id: orderRecord.id,
        payment_method: provider,
        currency: orderData.currency,
        total: orderData.total,
        items_count: getTotalItems(),
        promo_code: orderData.appliedPromo?.code ?? null,
      });
      console.log('Promo used with ID:', orderData.appliedPromo?.promoId); // Debug log

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'debit',
          amount: orderData.total,
          currency: orderData.currency,
          original_amount: orderData.original_amount,
          description: `Order payment - ${getTotalItems()} items${orderData.appliedPromo ? ` (${orderData.appliedPromo.code} applied)` : ''}`,
          reference: reference,
          status: 'completed',
          payment_provider: provider
        });

      if (transactionError) throw transactionError;

      await refreshPoints().catch(() => {});

      // CRITICAL: Clear cart immediately - this removes promo from context
      await clearCart();

      const goToOrders = () => {
        router.back();
        router.navigate('/(customer)/orders');
      };
      const successMessage = `Your payment of ${formatCurrency(orderData.original_amount, orderData.currency)} has been processed.\n\n+5 loyalty points added to your account!`;
      if (Platform.OS === 'web') {
        setWebNotice({ title: '🎉 Order Placed Successfully', message: successMessage, onClose: goToOrders });
      } else {
        goToOrders();
        Alert.alert('🎉 Order Placed Successfully', successMessage);
      }
    } catch (error) {
      console.error('Error completing online payment:', error);
      posthog.captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'completeOnlinePayment',
        provider,
      });
      // Critical: payment succeeded but the order failed. Must be visible on web.
      showCheckoutNotice('Error', 'Payment was successful but failed to create order. Please contact support.');
    }
  };

  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);
    await completeOnlinePayment(response.reference, 'paystack');
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
    setLoading(false);
    showCheckoutNotice('Payment Cancelled', 'Your payment was cancelled');
  };

  return {
    loading,
    showPaystack,
    orderData,
    showPayLinkModal,
    setShowPayLinkModal,
    payLinkLoading,
    generatedPayLink,
    handleOrder,
    handlePayForMe,
    handlePaystackSuccess,
    handlePaystackCancel,
  };
}
