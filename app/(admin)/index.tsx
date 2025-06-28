import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Users, Package, DollarSign, TrendingUp, Eye, MoreHorizontal } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import OrderDetailsModal from '@/components/OrderDetailsModal';
import { formatCurrency } from '@/lib/currency';

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
}

interface RecentOrder {
  id: string;
  user_id: string;
  total: number;
  order_status: string;
  created_at: string;
  currency?: string;
  profiles: {
    full_name: string;
    email: string;
    preferred_currency?: string;
  };
  // Custom order fields
  title?: string;
  description?: string;
  quantity?: number;
  budget_range?: string;
  status?: string;
}

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const fetchDashboardData = async () => {
    try {
      // Fetch user count
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'customer');

      // Fetch order stats
      const { data: orders } = await supabase
        .from('orders')
        .select('total, order_status, payment_status, currency');

      // Fetch custom requests stats
      const { data: customRequests } = await supabase
        .from('custom_requests')
        .select('status');

      // Fetch recent orders with user info (limit to 2)
      const { data: recentOrdersData } = await supabase
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
          profiles!inner(full_name, email, wallet_balance, preferred_currency)
        `)
        .order('created_at', { ascending: false })
        .limit(2);

      // Fetch recent custom requests (limit to 1)
      const { data: recentCustomData } = await supabase
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
          profiles!inner(full_name, email, wallet_balance, preferred_currency)
        `)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orders) {
        const totalRevenue = orders
          .filter(order => order.payment_status === 'paid')
          .reduce((sum, order) => sum + order.total, 0);
        
        const pendingOrders = orders.filter(
          order => order.order_status === 'pending'
        ).length;

        const totalOrdersCount = orders.length + (customRequests?.length || 0);

        setStats({
          totalUsers: userCount || 0,
          totalOrders: totalOrdersCount,
          totalRevenue,
          pendingOrders,
        });
      }

      // Combine recent orders and custom requests (max 3 total)
      const combinedRecent = [
        ...(recentOrdersData || []),
        ...(recentCustomData || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 3);

      setRecentOrders(combinedRecent);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const handleOrderPress = (order: RecentOrder) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  const isCustomOrder = (order: RecentOrder) => {
    return !!order.title; // Custom orders have title field
  };

  const formatOrderAmount = (order: RecentOrder) => {
    // Use the order's currency if available, otherwise use NGN
    const currency = order.currency || 'NGN';
    
    if (isCustomOrder(order)) {
      return order.budget_range || '';
    } else {
      return formatCurrency(order.total, currency);
    }
  };

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: '#3B82F6',
      gradient: ['#3B82F6', '#1D4ED8'],
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders.toLocaleString(),
      icon: Package,
      color: '#10B981',
      gradient: ['#10B981', '#047857'],
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats.totalRevenue, 'NGN'),
      icon: DollarSign,
      color: '#F59E0B',
      gradient: ['#F59E0B', '#D97706'],
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders.toLocaleString(),
      icon: TrendingUp,
      color: '#EF4444',
      gradient: ['#EF4444', '#DC2626'],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.adminName}>{profile?.full_name || 'Admin'}</Text>
        </View>
        <Pressable 
          style={styles.viewAllButton}
          onPress={() => router.push('/(admin)/orders')}
        >
          <Eye size={16} color="#7C3AED" />
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            {statCards.map((card, index) => (
              <LinearGradient
                key={index}
                colors={card.gradient}
                style={styles.statCard}
              >
                <View style={styles.statCardContent}>
                  <View style={styles.statCardHeader}>
                    <card.icon size={24} color="#FFFFFF" />
                    <Text style={styles.statValue}>{card.value}</Text>
                  </View>
                  <Text style={styles.statTitle}>{card.title}</Text>
                </View>
              </LinearGradient>
            ))}
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.recentOrdersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <Pressable onPress={() => router.push('/(admin)/orders')}>
              <Text style={styles.seeAllText}>See All</Text>
            </Pressable>
          </View>

          <View style={styles.ordersCard}>
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <Pressable 
                  key={order.id} 
                  style={styles.orderItem}
                  onPress={() => handleOrderPress(order)}
                >
                  <View style={styles.orderInfo}>
                    {isCustomOrder(order) && (
                      <View style={styles.customOrderBadge}>
                        <Text style={styles.customOrderText}>Custom Order</Text>
                      </View>
                    )}
                    <Text style={styles.orderCustomer}>
                      {order.profiles.full_name || order.profiles.email}
                    </Text>
                    <Text style={styles.orderId}>
                      {isCustomOrder(order) ? order.title : `#${order.id.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.orderDate}>
                      {formatDate(order.created_at)}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderAmount}>
                      {formatOrderAmount(order)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${getStatusColor(isCustomOrder(order) ? order.status! : order.order_status)}20` }
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(isCustomOrder(order) ? order.status! : order.order_status) }
                        ]}
                      >
                        {(isCustomOrder(order) ? order.status! : order.order_status).charAt(0).toUpperCase() + 
                         (isCustomOrder(order) ? order.status! : order.order_status).slice(1).replace('_', ' ')}
                      </Text>
                    </View>
                    <Pressable style={styles.orderActions}>
                      <MoreHorizontal size={16} color="#9CA3AF" />
                    </Pressable>
                  </View>
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyOrders}>
                <Text style={styles.emptyText}>No recent orders</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/products')}
            >
              <Package size={24} color="#7C3AED" />
              <Text style={styles.actionText}>Manage Products</Text>
            </Pressable>
            
            <Pressable 
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/users')}
            >
              <Users size={24} color="#10B981" />
              <Text style={styles.actionText}>View Users</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Order Details Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        visible={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        onOrderUpdate={fetchDashboardData}
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
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  adminName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  viewAllText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardContent: {
    alignItems: 'flex-start',
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  recentOrdersContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  ordersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  orderCustomer: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  orderId: {
    fontSize: 12,
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
    gap: 4,
  },
  orderAmount: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  orderActions: {
    padding: 4,
  },
  emptyOrders: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
});