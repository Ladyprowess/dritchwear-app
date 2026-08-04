import React from 'react';
import { Text, View } from 'react-native';
import type { Order } from '../../types';
import { formatAmountInPaymentCurrency } from '../../helpers';
import { styles } from '../../styles';
import { NotesSection } from './NotesSection';

interface OrderSummarySectionProps {
  order: Order;
}

// NOTE: the Notes block is rendered nested inside the summary card here,
// splitting subtotal/discount from service-fee/delivery-fee/tax/total -
// that's the original JSX structure, preserved verbatim rather than
// "corrected" as part of this extraction.
export function OrderSummarySection({ order }: OrderSummarySectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Summary</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatAmountInPaymentCurrency(order, order.subtotal || 0)}</Text>
        </View>

        {order.promo_code && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount ({order.promo_code})</Text>
            <Text style={styles.discountValue}>
              -{formatAmountInPaymentCurrency(order, order.discount_amount ?? 0)}
            </Text>
          </View>
        )}

        {(order.notes || order.description) && (
          <NotesSection note={(order.notes || order.description || '').toString()} />
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service Fee</Text>
          <Text style={styles.summaryValue}>{formatAmountInPaymentCurrency(order, order.service_fee || 0)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery Fee</Text>
          <Text style={styles.summaryValue}>{formatAmountInPaymentCurrency(order, order.delivery_fee || 0)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>VAT</Text>
          <Text style={styles.summaryValue}>{formatAmountInPaymentCurrency(order, order.tax || 0)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{formatAmountInPaymentCurrency(order, order.total || 0)}</Text>
        </View>
      </View>
    </View>
  );
}
