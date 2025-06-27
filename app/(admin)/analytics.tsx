import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign,
  Calendar,
  Package,
  CreditCard,
  Star
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageOrderValue: number;
  revenueGrowth: number;
  orderGrowth: number;
  customerGrowth: number;
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    amount?: number;
    timestamp: string;
    customerName?: string;
    orderNumber?: string;
  }>;
  monthlyRevenue: Array<{
    month: string;
    revenue: number;
    orders: number;
  }>;
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    averageOrderValue: 0,
    revenueGrowth: 0,
    orderGrowth: 0,
    customerGrowth: 0,
    topProducts: [],
    recentActivity: [],
    monthlyRevenue: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const generateOrderNumber = (id: string, isCustom: boolean = false) => {
    const prefix = isCustom ? 'CO' : 'OR';
    const shortId = id.slice(0, 8).toUpperCase();
    return `${prefix}-${shortId}`;
  };

  const fetchAnalytics = async () => {
    try {
      // Fetch orders data with customer info
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          payment_status,
          created_at,
          items,
          profiles!inner(full_name, email)
        `);

      // Fetch customers data
      const { data: customers } = await supabase
        .from('profiles')
        .select('created_at, full_name, email')
        .eq('role', 'customer');

      // Fetch custom requests data with customer info
      const { data: customRequests } = await supabase
        .from('custom_requests')
        .select(`
          id,
          title,
          created_at,
          profiles!inner(full_name, email),
          invoices(amount, status)
        `);

      if (orders && customers) {
        const paidOrders = orders.filter(order => order.payment_status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
        
        // Add custom order revenue
        let customRevenue = 0;
        if (customRequests) {
          customRequests.forEach(request => {
            if (request.invoices) {
              request.invoices.forEach((invoice: any) => {
                if (invoice.status === 'paid') {
                  customRevenue += invoice.amount;
                }
              });
            }
          });
        }

        const totalOrdersCount = paidOrders.length;
        const totalCustomersCount = customers.length;
        const averageOrderValue = totalOrdersCount > 0 ? (totalRevenue + customRevenue) / totalOrdersCount : 0;

        // Calculate growth rates (simplified - comparing last 30 days vs previous 30 days)
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        const recentOrders = paidOrders.filter(order => new Date(order.created_at) >= thirtyDaysAgo);
        const previousOrders = paidOrders.filter(order => 
          new Date(order.created_at) >= sixtyDaysAgo && new Date(order.created_at) < thirtyDaysAgo
        );

        const recentRevenue = recentOrders.reduce((sum, order) => sum + order.total, 0);
        const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total, 0);

        const revenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        const orderGrowth = previousOrders.length > 0 ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0;

        const recentCustomers = customers.filter(customer => new Date(customer.created_at) >= thirtyDaysAgo);
        const previousCustomers = customers.filter(customer => 
          new Date(customer.created_at) >= sixtyDaysAgo && new Date(customer.created_at) < thirtyDaysAgo
        );
        const customerGrowth = previousCustomers.length > 0 ? ((recentCustomers.length - previousCustomers.length) / previousCustomers.length) * 100 : 0;

        // Calculate top products
        const productSales: { [key: string]: { sales: number; revenue: number } } = {};
        paidOrders.forEach(order => {
          if (order.items) {
            order.items.forEach((item: any) => {
              if (!productSales[item.name]) {
                productSales[item.name] = { sales: 0, revenue: 0 };
              }
              productSales[item.name].sales += item.quantity;
              productSales[item.name].revenue += item.price * item.quantity;
            });
          }
        });

        const topProducts = Object.entries(productSales)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        // Generate recent activity with proper customer names and order numbers
        const recentActivity = [];

        // Add recent orders (limit to 5)
        const recentOrderActivity = recentOrders.slice(0, 5).map(order => ({
          type: 'order',
          description: `New order from ${order.profiles.full_name || order.profiles.email}`,
          amount: order.total,
          timestamp: order.created_at,
          customerName: order.profiles.full_name || order.profiles.email,
          orderNumber: generateOrderNumber(order.id, false),
        }));

        // Add recent custom requests (limit to 3)
        const recentCustomActivity = customRequests
          ?.filter(request => new Date(request.created_at) >= thirtyDaysAgo)
          .slice(0, 3)
          .map(request => ({
            type: 'custom_order',
            description: `Custom order request from ${request.profiles.full_name || request.profiles.email}`,
            timestamp: request.created_at,
            customerName: request.profiles.full_name || request.profiles.email,
            orderNumber: generateOrderNumber(request.id, true),
          })) || [];

        // Add recent customers (limit to 3)
        const recentCustomerActivity = recentCustomers.slice(0, 3).map(customer => ({
          type: 'customer',
          description: `New customer: ${customer.full_name || customer.email}`,
          timestamp: customer.created_at,
          customerName: customer.full_name || customer.email,
        }));

        // Combine and sort all activities, then limit to 10 most recent
        const allActivities = [
          ...recentOrderActivity,
          ...recentCustomActivity,
          ...recentCustomerActivity,
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
         .slice(0, 10);

        // Generate monthly revenue (last 6 months)
        const monthlyRevenue = [];
        for (let i = 5; i >= 0; i--) {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
          const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

          const monthOrders = paidOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= monthStart && orderDate <= monthEnd;
          });

          const monthRevenue = monthOrders.reduce((sum, order) => sum + order.total, 0);

          monthlyRevenue.push({
            month: date.toLocaleDateString('en-US', { month: 'short' }),
            revenue: monthRevenue,
            orders: monthOrders.length,
          });
        }

        setAnalytics({
          totalRevenue: totalRevenue + customRevenue,
          totalOrders: totalOrdersCount,
          totalCustomers: totalCustomersCount,
          averageOrderValue,
          revenueGrowth,
          orderGrowth,
          customerGrowth,
          topProducts,
          recentActivity: allActivities,
          monthlyRevenue,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getGrowthColor = (growth: number) => {
    return growth >= 0 ? '#10B981' : '#EF4444';
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return ShoppingBag;
      case 'custom_order':
        return Package;
      case 'customer':
        return Users;
      default:
        return Package;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'order':
        return '#3B82F6';
      case 'custom_order':
        return '#7C3AED';
      case 'customer':
        return '#10B981';
      default:
        return '#6B7280';
    }
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(analytics.totalRevenue),
      growth: analytics.revenueGrowth,
      icon: DollarSign,
      gradient: ['#10B981', '#047857'],
    },
    {
      title: 'Total Orders',
      value: analytics.totalOrders.toLocaleString(),
      growth: analytics.orderGrowth,
      icon: ShoppingBag,
      gradient: ['#3B82F6', '#1D4ED8'],
    },
    {
      title: 'Total Customers',
      value: analytics.totalCustomers.toLocaleString(),
      growth: analytics.customerGrowth,
      icon: Users,
      gradient: ['#8B5CF6', '#7C3AED'],
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(analytics.averageOrderValue),
      growth: 0,
      icon: TrendingUp,
      gradient: ['#F59E0B', '#D97706'],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <View style={styles.placeholder} />
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
                    {card.growth !== 0 && (
                      <Text style={[styles.growthText, { color: '#FFFFFF' }]}>
                        {formatGrowth(card.growth)}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statTitle}>{card.title}</Text>
                </View>
              </LinearGradient>
            ))}
          </View>
        </View>

        {/* Monthly Revenue Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Performance</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Revenue & Orders</Text>
              <Text style={styles.chartSubtitle}>Last 6 months</Text>
            </View>
            <View style={styles.chartContainer}>
              {analytics.monthlyRevenue.map((month, index) => {
                const maxRevenue = Math.max(...analytics.monthlyRevenue.map(m => m.revenue));
                const height = maxRevenue > 0 ? (month.revenue / maxRevenue) * 100 : 0;
                
                return (
                  <View key={index} style={styles.chartBar}>
                    <View style={styles.barContainer}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${height}%`, backgroundColor: '#7C3AED' }
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{month.month}</Text>
                    <Text style={styles.barValue}>{formatCurrency(month.revenue)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Top Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Products</Text>
          <View style={styles.topProductsCard}>
            {analytics.topProducts.length > 0 ? (
              analytics.topProducts.map((product, index) => (
                <View key={index} style={styles.productItem}>
                  <View style={styles.productRank}>
                    <Text style={styles.rankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productSales}>{product.sales} sold</Text>
                  </View>
                  <Text style={styles.productRevenue}>
                    {formatCurrency(product.revenue)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No product data available</Text>
            )}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.activityCard}>
            {analytics.recentActivity.length > 0 ? (
              analytics.recentActivity.map((activity, index) => {
                const IconComponent = getActivityIcon(activity.type);
                const iconColor = getActivityColor(activity.type);
                
                return (
                  <View key={index} style={styles.activityItem}>
                    <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
                      <IconComponent size={16} color={iconColor} />
                    </View>
                    <View style={styles.activityInfo}>
                      <Text style={styles.activityDescription}>
                        {activity.description}
                      </Text>
                      {activity.orderNumber && (
                        <Text style={styles.activityOrderNumber}>
                          Order: {activity.orderNumber}
                        </Text>
                      )}
                      <Text style={styles.activityTime}>
                        {formatDate(activity.timestamp)}
                      </Text>
                    </View>
                    {activity.amount && (
                      <Text style={styles.activityAmount}>
                        {formatCurrency(activity.amount)}
                      </Text>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyText}>No recent activity</Text>
            )}
          </View>
        </View>
      </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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
  growthText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartHeader: {
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  chartSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  barContainer: {
    height: 80,
    width: '80%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 4,
  },
  barValue: {
    fontSize: 8,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  topProductsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  productRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  productSales: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  productRevenue: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
  },
  activityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  activityOrderNumber: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  activityAmount: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: '#10B981',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
});