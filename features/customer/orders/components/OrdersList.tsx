import React from 'react';
import { Text, View } from 'react-native';
import { Package } from 'lucide-react-native';
import type { Order, Invoice } from '../types';
import { OrderCard } from './OrderCard';
import { styles } from '../styles';

interface OrdersListProps {
  orders: Order[];
  loading: boolean;
  selectedStatus: string;
  preferredCurrency: string | null | undefined;
  processingInvoice: string | null;
  onOrderPress: (order: Order) => void;
  onRepeatOrder: (order: Order) => void;
  onAcceptInvoice: (invoice: Invoice, order: Order) => void;
  onRejectInvoice: (invoice: Invoice, order: Order) => void;
  onPayForCustomOrder: (invoice: Invoice, order: Order) => void;
}

export function OrdersList({
  orders,
  loading,
  selectedStatus,
  preferredCurrency,
  processingInvoice,
  onOrderPress,
  onRepeatOrder,
  onAcceptInvoice,
  onRejectInvoice,
  onPayForCustomOrder,
}: OrdersListProps) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
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
    );
  }

  return (
    <View style={styles.ordersContainer}>
      {orders.map((item) => (
        <OrderCard
          key={item.id}
          item={item}
          preferredCurrency={preferredCurrency}
          processingInvoice={processingInvoice}
          onPress={onOrderPress}
          onRepeatOrder={onRepeatOrder}
          onAcceptInvoice={onAcceptInvoice}
          onRejectInvoice={onRejectInvoice}
          onPayForCustomOrder={onPayForCustomOrder}
        />
      ))}
    </View>
  );
}
