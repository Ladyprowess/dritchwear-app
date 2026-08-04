import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { convertToNGN } from '@/lib/currency';
import type { CartItem } from '@/contexts/CartContext';
import type { Order } from '@/lib/orders/types';
import { getActualPaymentCurrency, isCustomOrder } from '../helpers';

interface InvoiceFormData {
  amount: string;
  description: string;
}

export function useOrderDetailsActions(
  order: Order | null,
  onOrderUpdate: () => void,
  onClose: () => void,
  addToCart: (items: CartItem[]) => Promise<void>
) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [givingCredit, setGivingCredit] = useState(false);

  const downloadImage = async (imageUrl: string) => {
    try {
      const fileName = imageUrl.split('/').pop() || `logo_${Date.now()}.png`;

      if (Platform.OS === 'web') {
        // Browser download - creates a temporary <a> and clicks it (works in
        // Chrome, Firefox, Safari, Edge on desktop and mobile)
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      // Native path - lazy-load so these modules never touch the web bundle
      const FileSystem = await import('expo-file-system/legacy');
      const Sharing = await import('expo-sharing');

      const fileUri = (FileSystem as any).documentDirectory + fileName;
      const downloaded = await (FileSystem as any).downloadAsync(imageUrl, fileUri);

      const canShare = await (Sharing as any).isAvailableAsync();
      if (canShare) {
        await (Sharing as any).shareAsync(downloaded.uri);
        return;
      }

      Alert.alert('Saved', 'Logo saved to your device.');
    } catch (error) {
      console.error('Download failed:', error);
      Alert.alert('Download failed', 'Could not download the logo. Please try again.');
    }
  };

  const handleRepeatOrder = async () => {
    if (!order?.items || order.items.length === 0) return;
    const cartItems: CartItem[] = order.items.map((it) => ({
      productId: it.product_id ?? '',
      productName: it.name ?? 'Product',
      productImage: '',
      price: it.price ?? 0,
      size: it.size ?? '',
      color: it.color ?? '',
      quantity: it.quantity ?? 1,
      note: typeof it.note === 'string' && it.note.trim() ? it.note.trim() : undefined,
    }));
    await addToCart(cartItems);
    onClose();
    if (Platform.OS === 'web') { router.push('/(customer)/cart'); return; }
    Alert.alert('Added to cart', 'Items from this order have been added to your cart.', [
      { text: 'Keep shopping', style: 'cancel' },
      { text: 'Go to cart', onPress: () => router.push('/(customer)/cart') },
    ]);
  };

  const handleRefund = async () => {
    if (!order?.profiles) return;

    const { error: walletError } = await supabase
      .from('profiles')
      .update({
        wallet_balance: (order.profiles.wallet_balance ?? 0) + (order.total ?? 0)
      })
      .eq('id', order.user_id);

    if (walletError) throw walletError;

    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: order.user_id,
        type: 'credit',
        amount: order.total,
        description: `Refund for cancelled order #${order.id.toString().substring(0, 8)}`,
        reference: order.id,
        status: 'completed'
      });

    if (transactionError) throw transactionError;

    const { error: paymentError } = await supabase
      .from('orders')
      .update({ payment_status: 'refunded' })
      .eq('id', order.id);

    if (paymentError) throw paymentError;
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const table = isCustomOrder(order) ? 'custom_requests' : 'orders';
      const statusField = isCustomOrder(order) ? 'status' : 'order_status';

      if (newStatus === 'cancelled' && !isCustomOrder(order) && order.payment_status === 'paid') {
        await handleRefund();
      }

      const { error } = await supabase
        .from(table)
        .update({ [statusField]: newStatus })
        .eq('id', order.id);

      if (error) throw error;

      // In-app notification + push are handled by a DB trigger on this
      // update (customer_order_alerts, see 202608020004 migration).

      Alert.alert('Success', 'Order status updated successfully');
      onOrderUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const handleShipWithTracking = async (trackingNumber: string, trackingLink: string): Promise<boolean> => {
    if (!order) return false;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          order_status: 'shipped',
          tracking_number: trackingNumber,
          tracking_link: trackingLink || null,
        })
        .eq('id', order.id);

      if (error) throw error;

      Alert.alert('Success', 'Order marked as shipped. The customer has been emailed the tracking details.');
      onOrderUpdate();
      onClose();
      return true;
    } catch (error) {
      console.error('Error marking order as shipped:', error);
      Alert.alert('Error', 'Failed to update order status');
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const handleGiveLateDeliveryCredit = () => {
    if (!order) return;
    Alert.alert(
      'Give ₦1,000 Credit',
      "Credit ₦1,000 to this customer's wallet for a late delivery?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Give Credit',
          style: 'destructive',
          onPress: async () => {
            setGivingCredit(true);
            try {
              const { error: creditError } = await supabase.rpc('credit_wallet', {
                p_user_id: order.user_id,
                p_amount: 1000,
                p_description: `Late delivery credit for order #${order.id.toString().substring(0, 8)}`,
                p_reference: order.id,
              });
              if (creditError) throw creditError;

              const { error: flagError } = await supabase
                .from('orders')
                .update({ late_delivery_credit_at: new Date().toISOString() })
                .eq('id', order.id);
              if (flagError) throw flagError;

              Alert.alert('Success', "₦1,000 has been credited to the customer's wallet.");
              onOrderUpdate();
            } catch (error) {
              console.error('Error giving late delivery credit:', error);
              Alert.alert('Error', 'Could not credit the wallet. Please try again.');
            } finally {
              setGivingCredit(false);
            }
          },
        },
      ]
    );
  };

  const handleSendPaymentReminder = async () => {
    if (!order) return;
    setSendingReminder(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-payment-reminder', {
        body: { orderId: order.id, source: 'manual' },
      });
      if (error || (data as any)?.error) {
        Alert.alert('Reminder failed', (data as any)?.error || error?.message || 'Could not send the reminder.');
      } else if ((data as any)?.skipped === 'not_pending') {
        Alert.alert('Payment already updated', 'This order is no longer awaiting payment.');
      } else if ((data as any)?.alreadySent) {
        Alert.alert('Reminder already sent', 'A reminder was already sent for this order recently.');
      } else {
        Alert.alert('Reminder sent', 'The customer has been reminded to complete payment.');
      }
    } catch (error) {
      Alert.alert('Reminder failed', error instanceof Error ? error.message : 'Could not send the reminder.');
    } finally {
      setSendingReminder(false);
    }
  };

  // Duplicate-invoice guard is a data-integrity check against order/server
  // state, not form validation - kept here rather than in SendInvoiceModal.
  const sendInvoice = async (invoiceData: InvoiceFormData): Promise<boolean> => {
    if (!order) return false;
    if (order.invoice_sent) {
      Alert.alert(
        'Invoice Already Sent',
        'An invoice has already been sent for this custom order. Only one invoice can be sent per order.',
        [{ text: 'OK' }]
      );
      return false;
    }

    if (order.invoices && order.invoices.length > 0) {
      Alert.alert(
        'Invoice Already Exists',
        'An invoice already exists for this custom order.',
        [{ text: 'OK' }]
      );
      return false;
    }

    const actualPaymentCurrency = getActualPaymentCurrency(order);

    try {
      const amountInCustomerCurrency = parseFloat(invoiceData.amount);
      const amountInNGN = actualPaymentCurrency === 'NGN' ?
        amountInCustomerCurrency :
        convertToNGN(amountInCustomerCurrency, actualPaymentCurrency);

      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          custom_request_id: order.id,
          user_id: order.user_id,
          amount: amountInNGN, // Store in NGN
          original_amount: amountInCustomerCurrency, // Store original amount
          currency: actualPaymentCurrency, // Store customer's currency
          description: invoiceData.description,
          status: 'sent'
        });

      if (invoiceError) {
        if (invoiceError.code === '23505' && invoiceError.message.includes('unique_invoice_per_custom_request')) {
          Alert.alert(
            'Invoice Already Exists',
            'An invoice has already been sent for this custom order. Only one invoice can be sent per order.',
            [{ text: 'OK' }]
          );
          return false;
        }
        throw invoiceError;
      }

      const { error: statusError } = await supabase
        .from('custom_requests')
        .update({
          status: 'quoted',
          invoice_sent: true
        })
        .eq('id', order.id);

      if (statusError) throw statusError;

      await supabase
        .from('notifications')
        .insert({
          user_id: order.user_id,
          title: 'Invoice Received',
          message: `You've received an invoice for your custom order "${order.title}". Please review and respond.`,
          type: 'custom',
          is_read: false
        });

      Alert.alert('Success', `Invoice sent successfully in ${actualPaymentCurrency}`);
      onOrderUpdate();
      return true;
    } catch (error) {
      console.error('Error sending invoice:', error);
      Alert.alert('Error', 'Failed to send invoice');
      return false;
    }
  };

  return {
    updating,
    sendingReminder,
    givingCredit,
    downloadImage,
    handleRepeatOrder,
    handleStatusUpdate,
    handleShipWithTracking,
    handleGiveLateDeliveryCredit,
    handleSendPaymentReminder,
    sendInvoice,
  };
}
