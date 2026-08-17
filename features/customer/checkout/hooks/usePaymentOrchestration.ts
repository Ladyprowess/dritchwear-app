import { useState } from 'react';
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

    setPayLinkLoading(true);
    try {
      const subtotalNGN = getSubtotalInNGN();
      const discountNGN = calculateDiscountNGN(items, appliedPromo, subtotalNGN);
      const discountedSubtotalNGN = subtotalNGN - discountNGN;
      const fullDeliveryAddress = getFullDeliveryAddress();
      const customizationFeeTotal = calculateCustomizationFeeTotal(items, config);
      const orderTotalsForLink = calculateOrderTotal(discountedSubtotalNGN, fullDeliveryAddress, 'NGN', 0, effectivePromoType(appliedPromo?.type), config, customizationFeeTotal);

      const orderItems = items.map(item => ({
        product_id: item.productId,
        image: item.productImage ?? null,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        note: item.note ?? null,
        logo_url: item.logoUrl ?? null,
        has_customization_fee: item.hasCustomizationFee ?? false,
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
          customization_fee: orderTotalsForLink.customizationFee,
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
        image: item.productImage ?? null,
        name: item.productName,
        price: item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        note: item.note ?? null,
        logo_url: item.logoUrl ?? null,
        has_customization_fee: item.hasCustomizationFee ?? false,
      }));

      const fullDeliveryAddress = getFullDeliveryAddress();

      // First validate stock availability using the database function
      const { error: stockValidationError } = await supabase.rpc('validate_stock_availability', {
        order_items: orderItems
      });

      if (stockValidationError) {
        throw new Error(`Stock validation failed: ${stockValidationError.message}`);
      }

      // Debit the wallet BEFORE creating a paid order. deduct_wallet() checks
      // and deducts atomically under a row lock, so it's immune to the stale
      // client-side balance read and to two concurrent orders both passing a
      // "sufficient balance" check. Doing this first means a failure here
      // never leaves a paid order with no payment behind it.
      const { data: debited, error: walletError } = await supabase.rpc('deduct_wallet', {
        uid: user!.id,
        amount: orderTotals.total,
      });
      if (walletError) throw walletError;
      if (!debited) {
        throw new Error('Insufficient wallet balance. Please refresh and try again.');
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
          customization_fee: orderTotals.customizationFee,
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

      if (orderError) {
        // Wallet was already debited - refund it since no order exists to
        // charge for. Uses the same atomic credit_wallet the late-delivery
        // guarantee uses, so this can't race with anything else touching the balance.
        try {
          const { error: refundError } = await supabase.rpc('credit_wallet', {
            p_user_id: user!.id,
            p_amount: orderTotals.total,
            p_description: 'Refund: order could not be created after wallet debit',
            p_reference: null,
          });
          if (refundError) throw refundError;
        } catch (refundError) {
          console.error('CRITICAL: wallet debited but refund-on-failure also failed', refundError);
          posthog.captureException(refundError instanceof Error ? refundError : new Error(String(refundError)), {
            context: 'processWalletPayment_refund_failed',
          });
        }
        throw orderError;
      }

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
      const customizationFeeTotal = calculateCustomizationFeeTotal(items, config);

      const orderTotals = calculateOrderTotal(discountedSubtotalNGN, fullDeliveryAddress, 'NGN', 0, effectivePromoType(appliedPromo?.type), config, customizationFeeTotal);

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

        const orderItems = items.map(item => ({
          product_id: item.productId,
          image: item.productImage ?? null,
          name: item.productName,
          price: item.price,
          quantity: item.quantity,
          size: item.size,
          color: item.color,
          note: item.note ?? null,
          logo_url: item.logoUrl ?? null,
          has_customization_fee: item.hasCustomizationFee ?? false,
        }));

        if (paymentMethod === 'card' && userCurrency === 'NGN') {
          // Create the order BEFORE opening Paystack, as pending_payment -
          // exactly like handlePayForMe does. Without this, the order used
          // to be created only after Paystack reported success client-side,
          // so a dropped connection at that point meant the customer was
          // charged with no order and nothing on our side to reconcile
          // against. Now there's always a row for the webhook/reconciliation
          // job to settle even if this browser/app never calls back.
          const { error: stockValidationError } = await supabase.rpc('validate_stock_availability', {
            order_items: orderItems
          });
          if (stockValidationError) {
            showCheckoutNotice('Error', `Some items are no longer available: ${stockValidationError.message}`);
            setLoading(false);
            return;
          }

          const { data: orderRecord, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: user.id,
              items: orderItems,
              subtotal: orderTotals.subtotal,
              service_fee: orderTotals.serviceFee,
              delivery_fee: orderTotals.deliveryFee,
              tax: orderTotals.tax,
              customization_fee: orderTotals.customizationFee,
              total: orderTotals.total,
              payment_method: 'paystack',
              payment_status: 'pending_payment',
              order_status: 'pending_payment',
              delivery_address: fullDeliveryAddress,
              delivery_state: deliveryState.trim(),
              delivery_country: deliveryCountry.trim(),
              contact_phone: contactPhone.trim(),
              currency: 'NGN',
              original_amount: paymentAmount,
              promo_code: appliedPromo?.code || null,
              promo_code_id: appliedPromo?.promoId || null,
              discount_amount: discountNGN,
              notes: orderNote.trim() || null,
              description: orderNote.trim() || null,
            })
            .select()
            .single();

          if (orderError) {
            showCheckoutNotice('Error', 'Could not start checkout. Please try again.');
            setLoading(false);
            return;
          }

          // Fire the same "complete your payment" email pay-for-me links
          // already send on creation - best-effort, doesn't block opening
          // Paystack. Covers the case where the customer closes the popup
          // before paying: they still get a reminder immediately rather
          // than only if/when an admin later notices and sends one manually.
          supabase.functions.invoke('send-payment-reminder', {
            body: { orderId: orderRecord.id, source: 'initial' },
          }).then(({ error }) => {
            if (error) console.error('Initial payment reminder failed:', error.message);
          }).catch((error) => console.error('Initial payment reminder failed:', error));

          setOrderData({
            ...orderTotals,
            id: orderRecord.id,
            appliedPromo,
            discountAmount: discountNGN,
            original_amount: paymentAmount,
            currency: paymentCurrency,
          });
          setShowPaystack(true);
        } else {
          // Non-NGN "card" checkout has no payment provider wired up yet -
          // preserved as-is (pre-existing behavior), just staging the data.
          setOrderData({
            ...orderTotals,
            items: orderItems,
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
          });
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
