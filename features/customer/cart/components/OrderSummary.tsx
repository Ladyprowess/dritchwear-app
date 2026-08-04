import React from 'react';
import { Text, View } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import type { AppliedPromo } from '@/contexts/CartContext';
import { styles } from '../styles';

interface OrderSummaryProps {
  subtotal: number;
  discount: number;
  finalTotal: number;
  appliedPromo: AppliedPromo | null;
  userCurrency: string;
}

export function OrderSummary({ subtotal, discount, finalTotal, appliedPromo, userCurrency }: OrderSummaryProps) {
  return (
    <View style={styles.summarySection}>
      <Text style={styles.summaryTitle}>Order Summary</Text>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>
          {formatCurrency(subtotal, userCurrency)}
        </Text>
      </View>

      {appliedPromo && (
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Discount ({appliedPromo.code})</Text>
          <Text style={styles.discountValue}>
            -{formatCurrency(discount, userCurrency)}
          </Text>
        </View>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Delivery</Text>
        <Text style={styles.summaryNote}>Calculated at checkout</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Service Fee</Text>
        <Text style={styles.summaryNote}>Calculated at checkout</Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>VAT</Text>
        <Text style={styles.summaryNote}>Calculated at checkout</Text>
      </View>

      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(finalTotal, userCurrency)}+
        </Text>
      </View>
    </View>
  );
}
