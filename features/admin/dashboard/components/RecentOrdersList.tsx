import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MoreHorizontal } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import { getOrderStatusColor } from '@/lib/admin/orderStatus';
import { formatDate } from '@/lib/admin/formatting';
import type { RecentOrder } from '../types';
import { styles } from '../styles';

interface RecentOrdersListProps {
  recentOrders: RecentOrder[];
  onOrderPress: (order: RecentOrder) => void;
  onSeeAll: () => void;
}

const isCustomOrder = (order: RecentOrder) => !!order.title;

const formatCurrencyForAdmin = (order: RecentOrder) => {
  if (isCustomOrder(order)) return order.budget_range || 'N/A';
  if (order.original_amount && order.currency)
    return formatCurrency(order.original_amount, order.currency);
  return formatCurrency(order.total, 'NGN');
};

function RecentOrdersListBase({ recentOrders, onOrderPress, onSeeAll }: RecentOrdersListProps) {
  return (
    <View style={styles.recentOrdersContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See All</Text>
        </Pressable>
      </View>

      <View style={styles.ordersCard}>
        {recentOrders.length > 0 ? (
          recentOrders.map((order) => (
            <Pressable
              key={order.id}
              style={styles.orderItem}
              onPress={() => onOrderPress(order)}
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
                <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderAmount}>{formatCurrencyForAdmin(order)}</Text>
                {!isCustomOrder(order) && order.currency && order.currency !== 'NGN' && (
                  <Text style={styles.currencyIndicator}>Paid in {order.currency}</Text>
                )}
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: `${getOrderStatusColor(
                        isCustomOrder(order) ? order.status! : order.order_status
                      )}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: getOrderStatusColor(
                          isCustomOrder(order) ? order.status! : order.order_status
                        ),
                      },
                    ]}
                  >
                    {(isCustomOrder(order) ? order.status! : order.order_status)
                      .charAt(0)
                      .toUpperCase() +
                      (isCustomOrder(order) ? order.status! : order.order_status)
                        .slice(1)
                        .replace('_', ' ')}
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
  );
}

export const RecentOrdersList = React.memo(RecentOrdersListBase);
