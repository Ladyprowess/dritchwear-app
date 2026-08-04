import React from 'react';
import { Text, View } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import type { Order } from '../../types';
import { getActualPaymentCurrency } from '../../helpers';
import { styles } from '../../styles';

interface PaymentInfoSectionProps {
  order: Order;
}

export function PaymentInfoSection({ order }: PaymentInfoSectionProps) {
  const actualPaymentCurrency = getActualPaymentCurrency(order);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Payment Information</Text>
      <View style={styles.paymentCard}>
        <View style={styles.paymentRow}>
          <CreditCard size={20} color="#6B7280" />
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentMethod}>
              {order.payment_method === 'wallet' ? 'Wallet Payment' : 'Card Payment'}
            </Text>
            <Text style={[
              styles.paymentStatus,
              { color: order.payment_status === 'paid' ? '#10B981' : '#F59E0B' }
            ]}>
              {((order.payment_status ?? '').charAt(0).toUpperCase() + (order.payment_status ?? '').slice(1)) || 'Unknown'}
            </Text>
            <Text style={styles.paymentCurrency}>
              Paid in {actualPaymentCurrency}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
