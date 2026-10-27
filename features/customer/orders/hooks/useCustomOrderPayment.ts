import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { convertFromNGN, formatCurrency } from '@/lib/currency';
import { formatInvoiceAmount } from '@/lib/formatting';
import type { Profile } from '@/lib/auth';
import type { Order, Invoice } from '../types';

interface UseCustomOrderPaymentArgs {
  profile: Profile | null;
  userId: string | undefined;
  refreshProfile: () => Promise<void>;
  onNotice: (tone: 'error' | 'success' | 'info', message: string, actionLabel?: string, onAction?: () => void) => void;
  onPaymentComplete: () => Promise<void>;
}

export function useCustomOrderPayment({ profile, userId, refreshProfile, onNotice, onPaymentComplete }: UseCustomOrderPaymentArgs) {
  const router = useRouter();
  const [showPaystack, setShowPaystack] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<{ invoice: Invoice; order: Order } | null>(null);

  // Settles the invoice server-side (pay-invoice edge function): wallet
  // debit, ledger entry, invoice paid and request moved to payment_made all
  // happen in one DB transaction there, and Paystack charges are verified
  // before anything is marked paid.
  const payInvoice = async (body: Record<string, unknown>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (!jwt) throw new Error('Not signed in');

    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/pay-invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!result?.success) throw new Error(result?.error || 'The payment could not be processed.');
  };

  const completePayment = async (paymentMethod: string) => {
    // Only refresh profile for wallet payments
    if (paymentMethod === 'wallet') {
      await refreshProfile();
    }

    onNotice('success', 'Payment received. Your custom order can now move into production.');

    await onPaymentComplete();
  };

  const handleWalletPayment = async (invoice: Invoice, customRequest: Order) => {
    if (!profile) return;

    if (profile.wallet_balance < invoice.amount) {
      if (Platform.OS === 'web') {
        setPaymentChoice(null);
        onNotice('error', `Your wallet balance is too low for ${formatInvoiceAmount(invoice, profile.preferred_currency)}.`, 'Fund wallet', () => router.push('/(customer)/fund-wallet'));
        return;
      }
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance is ${formatCurrency(convertFromNGN(profile.wallet_balance, profile.preferred_currency || 'NGN'), profile.preferred_currency || 'NGN')}. You need ${formatInvoiceAmount(invoice, profile.preferred_currency)} to complete this payment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Fund Wallet', onPress: () => {
            // Navigate to fund wallet screen
          }}
        ]
      );
      return;
    }

    try {
      await payInvoice({ method: 'wallet', invoiceId: invoice.id });
      await completePayment('wallet');
    } catch (error) {
      console.error('Error processing wallet payment:', error);
      onNotice('error', error instanceof Error ? error.message : 'The payment could not be processed. Your order has not been updated.');
    }
  };

  const handleOnlinePayment = (invoice: Invoice, customRequest: Order) => {
    const isNaira = (invoice.currency || 'NGN') === 'NGN';

    if (isNaira) {
      if (!process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) {
        onNotice('error', 'Online payment is not configured. Use wallet payment or contact support.');
        return;
      }

      setPaymentInvoice(invoice);
      setPaymentOrder(customRequest);
      setShowPaystack(true);
    } else {
      onNotice('info', 'International card payments are unavailable. Fund your wallet in NGN and pay with Wallet.');
    }
  };

  const handlePayForCustomOrder = async (invoice: Invoice, customRequest: Order) => {
    if (!profile) {
      onNotice('error', 'Your profile information is not available yet. Refresh and try again.');
      return;
    }

    const displayAmount = formatInvoiceAmount(invoice, profile.preferred_currency);
    const isNaira = (invoice.currency || 'NGN') === 'NGN';

    if (Platform.OS === 'web') {
      setPaymentChoice({ invoice, order: customRequest });
      return;
    }

    Alert.alert(
      'Choose Payment Method',
      isNaira
        ? `Pay ${displayAmount} for your custom order`
        : `International payments are unavailable right now.\n\nPlease fund your wallet in NGN and pay with Wallet.\n\nPay ${displayAmount} for your custom order`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: `Wallet (${formatCurrency(convertFromNGN(profile.wallet_balance, profile.preferred_currency || 'NGN'), profile.preferred_currency || 'NGN')})`,
          onPress: () => handleWalletPayment(invoice, customRequest)
        },
        ...(isNaira
          ? [
              {
                text: 'Card/Bank Transfer',
                onPress: () => handleOnlinePayment(invoice, customRequest)
              }
            ]
          : [])
      ]
    );
  };

  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);

    if (!paymentInvoice || !paymentOrder) return;

    try {
      await payInvoice({ method: 'paystack', reference: response.reference });
      await completePayment('paystack');
    } catch (error) {
      console.error('Error processing Paystack payment:', error);
      onNotice('error', 'We\'re verifying your payment now. If the order doesn\'t update within a few minutes, contact support with your payment reference.');
    } finally {
      setPaymentInvoice(null);
      setPaymentOrder(null);
    }
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
    setPaymentInvoice(null);
    setPaymentOrder(null);
    onNotice('info', 'Payment was cancelled. No charge was recorded.');
  };

  return {
    showPaystack,
    paymentInvoice,
    paymentOrder,
    paymentChoice,
    setPaymentChoice,
    handlePayForCustomOrder,
    handleWalletPayment,
    handleOnlinePayment,
    handlePaystackSuccess,
    handlePaystackCancel,
  };
}
