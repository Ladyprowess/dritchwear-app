import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, User, Mail, Phone, MapPin, Wallet, Calendar, Shield, ShoppingBag } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  wallet_balance: number;
  role: 'customer' | 'admin';
  created_at: string;
}

interface UserDetailsModalProps {
  user: UserProfile | null;
  visible: boolean;
  onClose: () => void;
}

interface UserStats {
  totalOrders: number;
  totalSpent: number;
}

interface OrderSummary {
  id: string;
  total: number;
  order_status: string;
  payment_status: string;
  created_at: string;
  items: any;
}

export default function UserDetailsModal({ user, visible, onClose }: UserDetailsModalProps) {
  const [userStats, setUserStats] = useState<UserStats>({ totalOrders: 0, totalSpent: 0 });
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && visible) {
      fetchUserStats();
    }
  }, [user, visible]);

  const fetchUserStats = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch regular orders with full details
      const { data: orderData } = await supabase
        .from('orders')
        .select('id, total, payment_status, order_status, created_at, items')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch custom requests with paid invoices
      const { data: customRequests } = await supabase
        .from('custom_requests')
        .select(`
          invoices(amount, status)
        `)
        .eq('user_id', user.id);

      let totalOrders = 0;
      let totalSpent = 0;

      // Calculate from regular orders
      if (orderData) {
        setOrders(orderData);
        totalOrders += orderData.length;
        totalSpent += orderData
          .filter(order => order.payment_status === 'paid')
          .reduce((sum, order) => sum + order.total, 0);
      }

      // Calculate from custom requests
      if (customRequests) {
        const paidCustomOrders = customRequests.filter(request =>
          request.invoices && request.invoices.some((invoice: any) => invoice.status === 'paid')
        );

        totalOrders += paidCustomOrders.length;

        paidCustomOrders.forEach(request => {
          if (request.invoices) {
            request.invoices.forEach((invoice: any) => {
              if (invoice.status === 'paid') {
                totalSpent += invoice.amount;
              }
            });
          }
        });
      }

      setUserStats({ totalOrders, totalSpent });
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? '#5A2D82' : '#10B981';
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>User Details</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#1F2937" />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* User Profile */}
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.userName}>
                {user.full_name || 'No name provided'}
              </Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${getRoleBadgeColor(user.role)}20` }
                ]}
              >
                <Shield size={14} color={getRoleBadgeColor(user.role)} />
                <Text
                  style={[
                    styles.roleText,
                    { color: getRoleBadgeColor(user.role) }
                  ]}
                >
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Mail size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  <Text style={styles.infoValue}>{user.email}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Phone size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  <Text style={styles.infoValue}>
                    {user.phone || 'Not provided'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <MapPin size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Location</Text>
                  <Text style={styles.infoValue}>
                    {user.location || 'Not provided'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Wallet Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wallet Information</Text>
            
            <View style={styles.walletCard}>
              <View style={styles.walletHeader}>
                <Wallet size={24} color="#5A2D82" />
                <Text style={styles.walletLabel}>Current Balance</Text>
              </View>
              <Text style={styles.walletBalance}>
                {formatCurrency(user.wallet_balance)}
              </Text>
            </View>
          </View>

          {/* Account Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <User size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>User ID</Text>
                  <Text style={styles.infoValue}>#{user.id.slice(0, 8)}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Shield size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Account Type</Text>
                  <Text style={styles.infoValue}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Calendar size={20} color="#6B7280" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Member Since</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(user.created_at)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Stats</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <ShoppingBag size={20} color="#3B82F6" />
                <Text style={styles.statValue}>
                  {loading ? '...' : userStats.totalOrders}
                </Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>

              <View style={styles.statCard}>
                <Wallet size={20} color="#10B981" />
                <Text style={styles.statValue}>
                  {loading ? '...' : formatCurrency(userStats.totalSpent)}
                </Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
            </View>
          </View>

          {/* Order History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order History</Text>
            {loading ? (
              <Text style={styles.emptyText}>Loading orders...</Text>
            ) : orders.length === 0 ? (
              <Text style={styles.emptyText}>No orders yet</Text>
            ) : (
              orders.map((order) => {
                const items: any[] = Array.isArray(order.items) ? order.items : [];
                const statusColor =
                  order.order_status === 'delivered' ? '#10B981' :
                  order.order_status === 'cancelled' ? '#EF4444' :
                  order.order_status === 'shipped'   ? '#3B82F6' :
                  '#F59E0B';
                return (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderCardHeader}>
                      <Text style={styles.orderIdText}>#{order.id.slice(0, 8).toUpperCase()}</Text>
                      <View style={[styles.orderStatusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <Text style={[styles.orderStatusText, { color: statusColor }]}>
                          {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                    {items.map((item: any, i: number) => (
                      <Text key={i} style={styles.orderItemText}>
                        • {item.productName ?? item.name ?? 'Item'} × {item.quantity ?? 1}
                        {item.size ? `  |  Size: ${item.size}` : ''}
                        {item.color ? `  |  ${item.color}` : ''}
                      </Text>
                    ))}
                    <Text style={styles.orderTotal}>{formatCurrency(order.total)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
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
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  roleText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
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
  infoCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  walletCard: {
    backgroundColor: '#5A2D82',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  walletLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  walletBalance: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
  orderCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  orderStatusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  orderDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  orderItemText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 3,
  },
  orderTotal: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#5A2D82',
    marginTop: 8,
  },
});