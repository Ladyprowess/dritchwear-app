import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Package, Filter, Search, MoreHorizontal, CheckCircle, XCircle, X } from 'lucide-react-native';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import PaystackPayment from '@/components/PaystackPayment';

interface Order {
  id: string;
  user_id: string;
  items?: any[];
  subtotal?: number;
  service_fee?: number;
  delivery_fee?: number;
  total: number;
  payment_method?: string;
  payment_status?: string;
  order_status?: string;
  delivery_address?: string;
  created_at: string;
  // Custom order fields
  title?: string;
  description?: string;
  quantity?: number;
  budget_range?: string;
  status?: string;
  invoices?: Invoice[];
}

interface Invoice {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
}

const statusFilters = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Custom Orders'];

export default function CustomerOrdersScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [processingInvoice, setProcessingInvoice] = useState<string | null>(null);
  const [showPaystack, setShowPaystack] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      // Fetch regular orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch custom requests with invoices
      const { data: customData } = await supabase
        .from('custom_requests')
        .select(`
          *,
          invoices(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ordersData) setOrders(ordersData);
      if (customData) setCustomRequests(customData);

      // Combine and filter
      const allItems = [
        ...(ordersData || []),
        ...(customData || [])
      ];
      
      filterOrders(allItems, selectedStatus);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = (ordersList: Order[], filter: string) => {
    let filtered = [...ordersList];

    if (filter === 'Custom Orders') {
      filtered = filtered.filter(item => !item.items);
    } else if (filter !== 'All') {
      filtered = filtered.filter(item => {
        if (item.items) {
          return item.order_status?.toLowerCase() === filter.toLowerCase();
        } else {
          return item.status?.toLowerCase() === filter.toLowerCase();
        }
      });
    }

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  useEffect(() => {
    const allItems = [...orders, ...customRequests];
    filterOrders(allItems, selectedStatus);
  }, [orders, customRequests, selectedStatus]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#10B981';
      case 'processing': return '#3B82F6';
      case 'shipped': return '#8B5CF6';
      case 'delivered': return '#059669';
      case 'cancelled': return '#EF4444';
      case 'under_review': return '#3B82F6';
      case 'quoted': return '#F59E0B';
      case 'accepted': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'completed': return '#059669';
      default: return '#6B7280';
    }
  };

  const handleOrderPress = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const handleAcceptInvoice = async (invoice: Invoice, customRequest: Order) => {
    setProcessingInvoice(invoice.id);
    
    try {
      // Update invoice status to accepted
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'accepted' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;
      

      // Update custom request status to accepted
      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'accepted' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      // Send notification to admin
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: null, // Broadcast to all admins
          title: 'Invoice Accepted',
          message: `Customer has accepted invoice for "${customRequest.title}" - Amount: ${formatCurrency(invoice.amount)}`,
          type: 'custom'
        });

      if (notificationError) throw notificationError;

      Alert.alert(
        'Invoice Accepted',
        'You have accepted the invoice. You can now proceed with payment.',
        [{ text: 'OK' }]
      );

      // Refresh orders to show updated status
      await fetchOrders();
    } catch (error) {
      console.error('Error accepting invoice:', error);
      Alert.alert('Error', 'Failed to accept invoice. Please try again.');
    } finally {
      setProcessingInvoice(null);
    }
  };

  const handleRejectInvoice = async (invoice: Invoice, customRequest: Order) => {
    setProcessingInvoice(invoice.id);
    
    try {
      // Update invoice status to rejected
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'rejected' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Update custom request status to rejected
      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'rejected' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      // Send notification to admin
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: null, // Broadcast to all admins
          title: 'Invoice Rejected',
          message: `Customer has rejected invoice for "${customRequest.title}" - Amount: ${formatCurrency(invoice.amount)}`,
          type: 'custom'
        });

      if (notificationError) throw notificationError;

      Alert.alert(
        'Invoice Rejected',
        'You have rejected the invoice. The custom order has been cancelled.',
        [{ text: 'OK' }]
      );

      // Refresh orders to show updated status
      await fetchOrders();
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      Alert.alert('Error', 'Failed to reject invoice. Please try again.');
    } finally {
      setProcessingInvoice(null);
    }
  };

  const handlePayForCustomOrder = async (invoice: Invoice, customRequest: Order) => {
    if (!profile) {
      Alert.alert('Error', 'Unable to load profile information');
      return;
    }

    Alert.alert(
      'Choose Payment Method',
      `Pay ${formatCurrency(invoice.amount)} for your custom order`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: `Wallet (${formatCurrency(profile.wallet_balance)})`,
          onPress: () => handleWalletPayment(invoice, customRequest)
        },
        {
          text: 'Card/Bank Transfer',
          onPress: () => handlePaystackPayment(invoice, customRequest)
        }
      ]
    );
  };

  const handleWalletPayment = async (invoice: Invoice, customRequest: Order) => {
    if (!profile) return;

    if (profile.wallet_balance < invoice.amount) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance is ${formatCurrency(profile.wallet_balance)}. You need ${formatCurrency(invoice.amount)} to complete this payment.`,
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
      // CRITICAL FIX: Only deduct from wallet for wallet payments
      console.log('Processing wallet payment for custom order - deducting from wallet');
      
      // Deduct from wallet
      const { error: walletError } = await supabase
        .from('profiles')
        .update({
          wallet_balance: profile.wallet_balance - invoice.amount
        })
        .eq('id', user!.id);

      if (walletError) throw walletError;

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'debit',
          amount: invoice.amount,
          description: `Payment for custom order: ${customRequest.title}`,
          reference: invoice.id,
          status: 'completed'
        });

      if (transactionError) throw transactionError;

      await completePayment(invoice, customRequest, 'wallet');
    } catch (error) {
      console.error('Error processing wallet payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  const handlePaystackPayment = (invoice: Invoice, customRequest: Order) => {
    if (!process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY) {
      Alert.alert(
        'Payment Not Available',
        'Online payment is not configured. Please use wallet payment or contact support.',
        [{ text: 'OK' }]
      );
      return;
    }

    setPaymentInvoice(invoice);
    setPaymentOrder(customRequest);
    setShowPaystack(true);
  };

  const handlePaystackSuccess = async (response: any) => {
    setShowPaystack(false);
    
    if (!paymentInvoice || !paymentOrder) return;

    try {
      // CRITICAL FIX: For Paystack payments, DO NOT deduct from wallet
      console.log('Processing Paystack payment for custom order - NO wallet deduction');
      
      // Create transaction record ONLY - DO NOT touch wallet
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          type: 'debit',
          amount: paymentInvoice.amount,
          description: `Payment for custom order: ${paymentOrder.title}`,
          reference: response.reference,
          status: 'completed'
        });

      if (transactionError) throw transactionError;

      await completePayment(paymentInvoice, paymentOrder, 'paystack');
    } catch (error) {
      console.error('Error processing Paystack payment:', error);
      Alert.alert('Error', 'Payment was successful but failed to update order. Please contact support.');
    } finally {
      setPaymentInvoice(null);
      setPaymentOrder(null);
    }
  };

  const handlePaystackCancel = () => {
    setShowPaystack(false);
    setPaymentInvoice(null);
    setPaymentOrder(null);
    Alert.alert('Payment Cancelled', 'Your payment was cancelled');
  };

  const completePayment = async (invoice: Invoice, customRequest: Order, paymentMethod: string) => {
    try {
      // Update invoice status to paid
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Update custom request status to completed
      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'completed' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      // Send notification to admin
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: null, // Broadcast to all admins
          title: 'Payment Received',
          message: `Payment received for custom order "${customRequest.title}" - Amount: ${formatCurrency(invoice.amount)} via ${paymentMethod}`,
          type: 'order'
        });

      if (notificationError) throw notificationError;

      // CRITICAL: Only refresh profile for wallet payments
      if (paymentMethod === 'wallet') {
        await refreshProfile();
      }

      Alert.alert(
        'Payment Successful',
        'Your payment has been processed successfully. Your custom order is now in production!',
        [{ text: 'OK' }]
      );

      // Refresh orders to show updated status
      await fetchOrders();
    } catch (error) {
      console.error('Error completing payment:', error);
      throw error;
    }
  };

  const isCustomRequest = (item: Order): boolean => {
    return !item.items;
  };

  const generateOrderNumber = (id: string, isCustom: boolean = false) => {
    const prefix = isCustom ? 'CO' : 'OR';
    const shortId = id.slice(0, 8).toUpperCase();
    return `${prefix}-${shortId}`;
  };

  const renderOrderItem = (item: Order) => {
    const isCustom = isCustomRequest(item);
    const status = isCustom ? item.status : item.order_status;
    const statusColor = getStatusColor(status || '');
    const orderNumber = generateOrderNumber(item.id, isCustom);

    return (
      <Pressable 
        key={item.id} 
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
      >
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            {isCustom && (
              <View style={styles.customOrderBadge}>
                <Text style={styles.customOrderText}>Custom Order</Text>
              </View>
            )}
            <Text style={styles.orderId}>
              {isCustom ? item.title : orderNumber}
            </Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          
          <View style={styles.orderRight}>
            <Text style={styles.orderAmount}>
              {isCustom ? item.budget_range : formatCurrency(item.total)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${statusColor}20` }
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: statusColor }
                ]}
              >
                {status?.charAt(0).toUpperCase() + status?.slice(1).replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        {/* Show invoice actions for custom orders */}
        {isCustom && item.invoices && item.invoices.length > 0 && (
          <View style={styles.invoiceActions}>
            {item.invoices.map((invoice) => (
              <View key={invoice.id} style={styles.invoiceItem}>
                <View style={styles.invoiceHeader}>
                  <Text style={styles.invoiceAmount}>
                    {formatCurrency(invoice.amount)}
                  </Text>
                  <Text style={[
                    styles.invoiceStatus,
                    { color: getStatusColor(invoice.status) }
                  ]}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Text>
                </View>
                <Text style={styles.invoiceDescription}>{invoice.description}</Text>
                
                {/* Show Accept/Reject buttons only for 'sent' status */}
                {invoice.status === 'sent' && (
                  <View style={styles.invoiceButtons}>
                    <Pressable
                      style={[styles.acceptButton, processingInvoice === invoice.id && styles.buttonDisabled]}
                      onPress={() => handleAcceptInvoice(invoice, item)}
                      disabled={processingInvoice === invoice.id}
                    >
                      <CheckCircle size={16} color="#FFFFFF" />
                      <Text style={styles.acceptButtonText}>
                        {processingInvoice === invoice.id ? 'Processing...' : 'Accept'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.rejectButton, processingInvoice === invoice.id && styles.buttonDisabled]}
                      onPress={() => handleRejectInvoice(invoice, item)}
                      disabled={processingInvoice === invoice.id}
                    >
                      <XCircle size={16} color="#FFFFFF" />
                      <Text style={styles.rejectButtonText}>
                        {processingInvoice === invoice.id ? 'Processing...' : 'Reject'}
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* Show Pay Now button for 'accepted' status */}
                {invoice.status === 'accepted' && item.status !== 'rejected' && (
                  <Pressable
                    style={styles.payNowButton}
                    onPress={() => handlePayForCustomOrder(invoice, item)}
                  >
                    <Text style={styles.payNowButtonText}>
                      Pay Now - {formatCurrency(invoice.amount)}
                    </Text>
                  </Pressable>
                )}

              </View>
            ))}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Orders</Text>
      </View>

      {/* Status Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {statusFilters.map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterChip,
              selectedStatus === status && styles.filterChipActive
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.filterText,
                selectedStatus === status && styles.filterTextActive
              ]}
            >
              {status}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : filteredOrders.length > 0 ? (
          <View style={styles.ordersContainer}>
            {filteredOrders.map(renderOrderItem)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Package size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedStatus !== 'All' 
                ? `No ${selectedStatus.toLowerCase()} orders found`
                : 'You haven\'t placed any orders yet'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        visible={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        onOrderUpdate={fetchOrders}
      />

      {/* Paystack Payment Modal */}
      <Modal
        visible={showPaystack}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePaystackCancel}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complete Payment</Text>
            <Pressable style={styles.closeButton} onPress={handlePaystackCancel}>
              <XCircle size={24} color="#1F2937" />
            </Pressable>
          </View>
          
          {showPaystack && paymentInvoice && user && (
            <PaystackPayment
              email={user.email || ''}
              amount={paymentInvoice.amount}
              publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
              customerName={user.user_metadata?.full_name || 'Customer'}
              onSuccess={handlePaystackSuccess}
              onCancel={handlePaystackCancel}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  filtersContainer: {
    maxHeight: 48,
    marginBottom: 16,
  },
  
  filtersContent: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // or use marginRight if you're not using gap
  },
  
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // fallback if you're not using gap
  },
  
    
  filterChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  ordersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  customOrderBadge: {
    backgroundColor: '#7C3AED20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  customOrderText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  orderId: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  orderRight: {
    alignItems: 'flex-end',
  },
  orderAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  invoiceActions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  invoiceItem: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  invoiceAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  invoiceStatus: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  invoiceDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  invoiceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  payNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  payNowButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
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
})