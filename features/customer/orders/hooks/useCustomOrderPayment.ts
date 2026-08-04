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

  const completePayment = async (invoice: Invoice, customRequest: Order, paymentMethod: string) => {
    try {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Change custom request status to 'payment_made' instead of 'completed'
      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'payment_made' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      const { error: notifyError } = await supabase.rpc('notify_admins', {
        p_title: 'Payment Received',
        p_message: `Payment received for custom order "${customRequest.title}" - Amount: ${formatInvoiceAmount(invoice, profile?.preferred_currency)} via ${paymentMethod}`,
        p_type: 'order',
      });

      if (notifyError) {
        console.warn('notify_admins failed:', notifyError);
      }

      // Only refresh profile for wallet payments
      if (paymentMethod === 'wallet') {
        await refreshProfile();
      }

      onNotice('success', 'Payment received. Your custom order can now move into production.');

      await onPaymentComplete();
    } catch (error) {
      console.error('Error completing payment:', error);
      throw error;
    }
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
      // Only deduct from wallet for wallet payments
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: profile.wallet_balance - invoice.amount
        })
        .eq('id', userId!);

      if (walletError) throw walletError;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId!,
          type: 'debit',
          amount: invoice.amount,
          description: `Payment for custom order: ${customRequest.title}`,
          reference: invoice.id,
          status: 'completed',
          currency: invoice.currency || 'NGN',
          original_amount: invoice.original_amount,
          payment_provider: 'wallet'
        });

      if (transactionError) throw transactionError;

      await completePayment(invoice, customRequest, 'wallet');
    } catch (error) {
      console.error('Error processing wallet payment:', error);
      onNotice('error', 'The payment could not be processed. Your order has not been updated.');
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
      // For Paystack payments, DO NOT deduct from wallet - transaction record only
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId!,
          type: 'debit',
          amount: paymentInvoice.amount,
          description: `Payment for custom order: ${paymentOrder.title}`,
          reference: response.reference,
          status: 'completed',
          currency: paymentInvoice.currency || 'NGN',
          original_amount: paymentInvoice.original_amount,
          payment_provider: 'paystack'
        });

      if (transactionError) throw transactionError;

      await completePayment(paymentInvoice, paymentOrder, 'paystack');
    } catch (error) {
      console.error('Error processing Paystack payment:', error);
      onNotice('error', 'Payment succeeded, but the order update failed. Contact support with your payment reference.');
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
