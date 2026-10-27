import { useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { supabase } from '@/lib/supabase';
import { fetchCommerceConfig } from '@/lib/commerceSettings';
import { calculateOrderTotal, calculateCustomizationFeeTotal, type CommerceConfig } from '@/lib/fees';
import { buildPayLink } from '@/lib/pay-links';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import { logEvent } from '@/lib/analytics';
import type { CartItem, AppliedPromo } from '@/contexts/CartContext';
import type { Profile } from '@/lib/auth';
import { calculateDiscountNGN } from '../pricing';

// This module is the ONLY place allowed to call the Paystack SDK or start
// an order. Orders are created server-side by the place-order edge function
// (prices, fees, promo and wallet debit all decided there); the totals
// computed here are only for display and the pre-checks below.

interface PlaceOrderTotals {
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  discountAmount: number;
  customizationFee: number;
  total: number;
}

interface PlaceOrderResult {
  success: boolean;
  error?: string;
  code?: string;
  orderId?: string;
  token?: string;
  totals?: PlaceOrderTotals;
}

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
  // Set synchronously on the first tap, before any await, so a double tap
  // can't start two orders (or two wallet debits) while state catches up.
  const inFlight = useRef(false);

  const placeOrder = async (
    paymentMethod: 'paystack' | 'pay_link' | 'wallet',
    expectedTotal: number
  ): Promise<PlaceOrderResult> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (!jwt) return { success: false, error: 'Please sign in again to place your order.' };

    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/place-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({
        payment_method: paymentMethod,
        items: items.map(item => ({
          product_id: item.productId,
          image: item.productImage ?? null,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          note: item.note ?? null,
          logo_url: item.logoUrl ?? null,
        })),
        delivery_address: deliveryAddress.trim(),
        delivery_state: deliveryState.trim(),
        delivery_country: deliveryCountry.trim(),
        contact_phone: contactPhone.trim(),
        notes: orderNote.trim() || null,
        promo_code_id: appliedPromo?.promoId || null,
        expected_total: expectedTotal,
      }),
    }).catch(() => null);

    const result = response ? await response.json().catch(() => null) : null;
    if (!result) return { success: false, error: 'Could not reach checkout. Please check your connection and try again.' };
    return result as PlaceOrderResult;
  };

  const placeOrderErrorMessage = (result: PlaceOrderResult) =>
    result.code === 'price_changed' && result.totals
      ? `${result.error}\n\nNew total: ${formatCurrency(result.totals.total, 'NGN')}`
      : result.error || 'Could not place your order. Please try again.';

  // Blocks checkout when the admin has closed the store or the cart is below the
  // configured minimum order. Returns true when a guard fired.
  //
  // Re-fetches commerce config fresh (bypassing the 60s cache) instead of
  // trusting the `config` prop, which was only fetched once when checkout.tsx
  // mounted - if an admin changes the minimum order settings while a
  // customer already has checkout open, the stale in-memory value would
  // otherwise let a payment through that the new settings should block.
  const checkoutBlocked = async (): Promise<boolean> => {
    const liveConfig = await fetchCommerceConfig(true).catch(() => config);

    if (!liveConfig.storeOpen) {
      showCheckoutNotice('Store Closed', liveConfig.storeClosedMessage);
      return true;
    }
    if (getSubtotalInNGN() < liveConfig.minimumOrderNgn) {
      const minInUserCurrency = userCurrency === 'NGN'
        ? liveConfig.minimumOrderNgn
        : convertFromNGN(liveConfig.minimumOrderNgn, userCurrency);
      showCheckoutNotice(
        'Minimum Order Not Met',
        `Orders must be at least ${formatCurrency(minInUserCurrency, userCurrency)}. Please add more items to continue.`
      );
      return true;
    }
    // Safety net for the same rule enforced (and normally already caught) at
    // the cart screen - covers checkout being reached another way, e.g. a
    // saved link or the items being trimmed after arriving here.
    if (getTotalItems() < liveConfig.minimumOrderQuantity) {
      showCheckoutNotice(
        'Minimum Order Not Met',
        `We require at least ${liveConfig.minimumOrderQuantity} items per order. Please add ${liveConfig.minimumOrderQuantity - getTotalItems()} more item${liveConfig.minimumOrderQuantity - getTotalItems() === 1 ? '' : 's'} to continue.`
      );
      return true;
    }
    return false;
  };

  const handlePayForMe = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPayLinkLoading(true);
    try {
      if (await checkoutBlocked()) return;
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

      const subtotalNGN = getSubtotalInNGN();
      const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
      const customizationFeeTotal = calculateCustomizationFeeTotal(items, config);
      const displayedTotals = calculateOrderTotal(subtotalNGN - discountNGN, getFullDeliveryAddress(), 'NGN', 0, effectivePromoType(appliedPromo?.type), config, customizationFeeTotal);

      const result = await placeOrder('pay_link', displayedTotals.total);
      if (!result.success || !result.orderId || !result.token) {
        showCheckoutNotice('Error', placeOrderErrorMessage(result));
        return;
      }

      // Email + notify the customer that an order is awaiting payment (best-effort).
      supabase.functions.invoke('send-payment-reminder', {
        body: { orderId: result.orderId, source: 'initial' },
      }).then(({ error }) => {
        if (error) console.error('Initial payment reminder failed:', error.message);
      }).catch((error) => console.error('Initial payment reminder failed:', error));

      posthog.capture('pay_for_me_link_created', {
        order_id: result.orderId,
        amount_ngn: result.totals?.total ?? null,
        items_count: items.length,
      });
      setGeneratedPayLink(buildPayLink(result.token));
      setShowPayLinkModal(true);
    } catch (error: any) {
      showCheckoutNotice('Error', error.message || 'Could not generate payment link. Please try again.');
    } finally {
      inFlight.current = false;
      setPayLinkLoading(false);
    }
  };

  const processWalletPayment = async (expectedTotal: number) => {
    try {
      // Debit, paid order and ledger entry happen in one DB transaction on
      // the server, so a failure can never leave a debit without an order.
      const result = await placeOrder('wallet', expectedTotal);
      if (!result.success || !result.orderId) {
        showCheckoutNotice(
          result.code === 'insufficient_balance' ? 'Insufficient Balance' : 'Order not placed',
          placeOrderErrorMessage(result)
        );
        return;
      }
      const total = result.totals?.total ?? expectedTotal;

      console.log('Order created successfully:', result.orderId);
      await logEvent('purchase', {
        transaction_id: result.orderId,
        currency: 'NGN',
        value: total,
      });

      posthog.capture('order_placed', {
        order_id: result.orderId,
        payment_method: 'wallet',
        currency: 'NGN',
        total,
        items_count: getTotalItems(),
        promo_code: appliedPromo?.code ?? null,
      });

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
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    // Stays true while the Paystack popup is open; released on success/cancel.
    let paystackOpened = false;

    try {
      if (await checkoutBlocked()) return;
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

      if (paymentMethod === 'card' && userCurrency !== 'NGN') {
        showCheckoutNotice('Card payment unavailable', 'International card payments are unavailable right now. Switch your currency to NGN or pay with your wallet.');
        return;
      }

      await logEvent('add_payment_info', {
        payment_method: paymentMethod,
      });

      // Totals as displayed at checkout (NGN, discount applied). place-order
      // recomputes them from the database and refuses to charge more.
      const subtotalNGN = getSubtotalInNGN();
      const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
      const customizationFeeTotal = calculateCustomizationFeeTotal(items, config);
      const orderTotals = calculateOrderTotal(subtotalNGN - discountNGN, getFullDeliveryAddress(), 'NGN', 0, effectivePromoType(appliedPromo?.type), config, customizationFeeTotal);

      if (paymentMethod === 'wallet') {
        if (profile.wallet_balance < orderTotals.total) {
          const neededInUserCurrency = convertFromNGN(orderTotals.total, userCurrency);
          const balanceInUserCurrency = convertFromNGN(profile.wallet_balance, userCurrency);

          showCheckoutNotice(
            'Insufficient Balance',
            `Your wallet balance is ${formatCurrency(balanceInUserCurrency, userCurrency)}. You need ${formatCurrency(neededInUserCurrency, userCurrency)} to complete this order.`
          );
          return;
        }

        await processWalletPayment(orderTotals.total);
        return;
      }

      // Card: the order is created as pending_payment BEFORE Paystack opens,
      // so there's always a row for the webhook/reconciliation job to settle
      // even if this browser/app never calls back after a successful charge.
      const result = await placeOrder('paystack', orderTotals.total);
      if (!result.success || !result.orderId || !result.totals) {
        showCheckoutNotice('Error', placeOrderErrorMessage(result));
        return;
      }

      // Fire the same "complete your payment" email pay-for-me links
      // already send on creation - best-effort, doesn't block opening
      // Paystack. Covers the case where the customer closes the popup
      // before paying: they still get a reminder immediately rather
      // than only if/when an admin later notices and sends one manually.
      supabase.functions.invoke('send-payment-reminder', {
        body: { orderId: result.orderId, source: 'initial' },
      }).then(({ error }) => {
        if (error) console.error('Initial payment reminder failed:', error.message);
      }).catch((error) => console.error('Initial payment reminder failed:', error));

      setOrderData({
        ...result.totals,
        id: result.orderId,
        appliedPromo,
        original_amount: result.totals.total,
        currency: 'NGN',
      });
      paystackOpened = true;
      setShowPaystack(true);
    } catch (error) {
      console.error('Error processing order:', error);
      showCheckoutNotice('Error', 'Failed to process order. Please try again.');
    } finally {
      if (!paystackOpened) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  };

  const completeOnlinePayment = async (reference: string, provider: string) => {
    try {
      if (!orderData?.id) throw new Error('Order data not found');

      // Verify + settle server-side (needs the Paystack secret key, which
      // never touches the client) via the same confirmCheckoutOrder logic
      // paystack-webhook and reconcile-pending-payments use - so this order
      // gets settled exactly once no matter which path notices first.
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;
      if (!jwt) throw new Error('Not signed in');

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/confirm-order-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ orderId: orderData.id, reference }),
      });
      const result = await response.json().catch(() => ({} as any));
      if (!result?.success) {
        throw new Error(result?.error || 'Payment could not be confirmed');
      }

      console.log('Online payment confirmed:', orderData.id);
      await logEvent('purchase', {
        transaction_id: orderData.id,
        currency: orderData.currency,
        value: orderData.total,
      });

      posthog.capture('order_placed', {
        order_id: orderData.id,
        payment_method: provider,
        currency: orderData.currency,
        total: orderData.total,
        items_count: getTotalItems(),
        promo_code: orderData.appliedPromo?.code ?? null,
      });

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
      // Unlike before, a failure here does NOT mean the payment is lost: the
      // order was already created as pending_payment before Paystack opened,
      // and paystack-webhook / reconcile-pending-payments will settle it
      // independently of this client call within minutes if Paystack
      // actually captured the charge.
      showCheckoutNotice('Confirming your payment', 'We\'re verifying your payment now. If it doesn\'t appear in your Orders within a few minutes, please contact support.');
    }
  };

  const handlePaystackSuccess = async (response: any) => {
    // The popup can report success more than once; the order only needs
    // confirming once (the server side is idempotent, analytics isn't).
    if (!inFlight.current) return;
    setShowPaystack(false);
    try {
      await completeOnlinePayment(response.reference, 'paystack');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
    inFlight.current = false;
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
