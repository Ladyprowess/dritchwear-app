import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Package, Filter, Search, MoreHorizontal, CheckCircle, XCircle, X } from 'lucide-react-native';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { formatCurrency } from '@/lib/currency';

interface Order {
  id: string;
  user_id: string;
  total: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  currency?: string;
  original_amount?: number;
  profiles: {
    full_name: string;
    email: string;
    preferred_currency?: string;
  };
}

interface CustomRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  quantity: number;
  budget_range: string;
  status: string;
  created_at: string;
  currency?: string;
  profiles: {
    full_name: string;
    email: string;
    preferred_currency?: string;
  };
}

const statusFilters = ['All', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Custom Orders'];

export default function AdminOrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<(Order | CustomRequest)[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | CustomRequest | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const fetchOrders = async () => {
    try {
      // Fetch regular orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          items,
          subtotal,
          service_fee,
          delivery_fee,
          total,
          payment_method,
          payment_status,
          order_status,
          delivery_address,
          created_at,
          currency,
          original_amount,
          profiles!inner(full_name, email, wallet_balance, preferred_currency)
        `)
        .order('created_at', { ascending: false });

      // Fetch custom requests with invoices
      const { data: customData } = await supabase
  .from('custom_requests')
  .select(`
    id,
    user_id,
    title,
    description,
    quantity,
    budget_range,
    status,
    created_at,
    currency,
    logo_url,
    profiles!inner(full_name, email, wallet_balance, preferred_currency),
    invoices(*)
  `)
        .order('created_at', { ascending: false });

      if (ordersData) setOrders(ordersData);
      if (customData) setCustomRequests(customData);

      // Combine and filter
      const allItems = [
        ...(ordersData || []),
        ...(customData || [])
      ];
      
      filterOrders(allItems, selectedStatus, searchQuery);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = (ordersList: (Order | CustomRequest)[], filter: string, search: string) => {
    let filtered = [...ordersList];

    // Apply status filter
    if (filter === 'Custom Orders') {
      filtered = filtered.filter(item => !('order_status' in item));
    } else if (filter !== 'All') {
      filtered = filtered.filter(item => {
        if ('order_status' in item) {
          return item.order_status.toLowerCase() === filter.toLowerCase();
        } else {
          return item.status.toLowerCase() === filter.toLowerCase();
        }
      });
    }

    // Apply search filter
    if (search) {
      filtered = filtered.filter(item => {
        const searchLower = search.toLowerCase();
        if ('order_status' in item) {
          return (
            item.id.toLowerCase().includes(searchLower) ||
            item.profiles.full_name?.toLowerCase().includes(searchLower) ||
            item.profiles.email.toLowerCase().includes(searchLower)
          );
        } else {
          return (
            item.id.toLowerCase().includes(searchLower) ||
            item.title.toLowerCase().includes(searchLower) ||
            item.profiles.full_name?.toLowerCase().includes(searchLower) ||
            item.profiles.email.toLowerCase().includes(searchLower)
          );
        }
      });
    }

    setFilteredOrders(filtered);
  };

  const handleFilterChange = (filter: string) => {
    setSelectedStatus(filter);
    const allItems = [...orders, ...customRequests];
    filterOrders(allItems, filter, searchQuery);
    setShowFilterModal(false);
  };

  const handleSearchChange = (search: string) => {
    setSearchQuery(search);
    const allItems = [...orders, ...customRequests];
    filterOrders(allItems, selectedStatus, search);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // FIXED: Show actual payment currency for admin
  const formatCurrencyForAdmin = (item: Order | CustomRequest) => {
    // For custom orders, just return the budget range
    if (isCustomRequest(item)) {
      return item.budget_range;
    }

    // CRITICAL FIX: Use the actual payment currency from the order
    const paymentCurrency = item.currency || 'NGN'; // Default to NGN if no currency stored
    
    // If we have the original amount in the payment currency, use it
    if (item.original_amount && item.currency) {
      return formatCurrency(item.original_amount, paymentCurrency);
    }
    
    // Otherwise, the total is stored in NGN, so display as NGN
    return formatCurrency(item.total, 'NGN');
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

  const handleOrderPress = (order: Order | CustomRequest) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const isCustomRequest = (item: Order | CustomRequest): item is CustomRequest => {
    return !('order_status' in item);
  };

  const renderOrderItem = (item: Order | CustomRequest) => {
    const isCustom = isCustomRequest(item);
    const status = isCustom ? item.status : item.order_status;
    const statusColor = getStatusColor(status);

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
              {isCustom ? item.title : `#${item.id.slice(0, 8)}`}
            </Text>
            <Text style={styles.customerName}>
              {item.profiles.full_name || item.profiles.email}
            </Text>
            <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          </View>
          
          <View style={styles.orderRight}>
            <Text style={styles.orderAmount}>
              {formatCurrencyForAdmin(item)}
            </Text>
            {/* Show payment currency indicator for regular orders */}
            {!isCustom && item.currency && item.currency !== 'NGN' && (
              <Text style={styles.currencyIndicator}>
                Paid in {item.currency}
              </Text>
            )}
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
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.orderActions}>
          <View style={styles.orderMeta}>
            <Text style={styles.orderMetaText}>
              {isCustom ? `Qty: ${item.quantity}` : `Payment: ${item.payment_status}`}
            </Text>
          </View>
          
          <View style={styles.actionButtons}>
            <Text style={styles.viewDetails}>Tap to manage</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders Management</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Search size={20} color="#6B7280" />
          </Pressable>
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Filter size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {/* Active Filters Display */}
      {(selectedStatus !== 'All' || searchQuery) && (
        <View style={styles.activeFilters}>
          {selectedStatus !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{selectedStatus}</Text>
              <Pressable onPress={() => handleFilterChange('All')}>
                <X size={16} color="#7C3AED" />
              </Pressable>
            </View>
          )}
          {searchQuery && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>"{searchQuery}"</Text>
              <Pressable onPress={() => handleSearchChange('')}>
                <X size={16} color="#7C3AED" />
              </Pressable>
            </View>
          )}
        </View>
      )}

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
              {searchQuery || selectedStatus !== 'All' 
                ? 'No orders match your search criteria'
                : 'No orders have been placed yet'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Orders</Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <X size={24} color="#1F2937" />
              </Pressable>
            </View>
            
            <View style={styles.filterOptions}>
              {statusFilters.map((filter) => (
                <Pressable
                  key={filter}
                  style={[
                    styles.filterOption,
                    selectedStatus === filter && styles.filterOptionActive
                  ]}
                  onPress={() => handleFilterChange(filter)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedStatus === filter && styles.filterOptionTextActive
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Orders</Text>
              <Pressable onPress={() => setShowSearchModal(false)}>
                <X size={24} color="#1F2937" />
              </Pressable>
            </View>
            
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search by order ID, customer name, or email..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>

            <Pressable
              style={styles.searchButton}
              onPress={() => setShowSearchModal(false)}
            >
              <Text style={styles.searchButtonText}>Apply Search</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
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
    marginBottom: 2,
  },
  customerName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
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
    marginBottom: 4,
  },
  currencyIndicator: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#7C3AED',
    fontStyle: 'italic',
    marginBottom: 4,
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
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  orderMeta: {
    flex: 1,
  },
  orderMetaText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  actionButtons: {
    alignItems: 'flex-end',
  },
  viewDetails: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
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
  filterOptions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  filterOptionActive: {
    backgroundColor: '#7C3AED',
  },
  filterOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  searchButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});