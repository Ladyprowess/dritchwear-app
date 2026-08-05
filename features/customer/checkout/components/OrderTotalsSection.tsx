import React from 'react';
import { Text, View } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import type { AppliedPromo } from '@/contexts/CartContext';
import { styles } from '../styles';

interface DisplayTotals {
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  tax: number;
  customizationFee: number;
  total: number;
}

interface OrderTotalsSectionProps {
  displayTotals: DisplayTotals;
  userCurrency: string;
  appliedPromo: AppliedPromo | null;
  memberFreeDelivery: boolean;
  memberTierName?: string;
  hasDeliveryAddress: boolean;
}

export function OrderTotalsSection({
  displayTotals,
  userCurrency,
  appliedPromo,
  memberFreeDelivery,
  memberTierName,
  hasDeliveryAddress,
}: OrderTotalsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Total</Text>
      <View style={styles.totalsCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(displayTotals.subtotal, userCurrency)}
          </Text>
        </View>

        {appliedPromo && appliedPromo.type !== 'free_delivery' && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Discount ({appliedPromo.code}
              {appliedPromo.type === 'item_percentage' ? ' - selected item' : ''})
            </Text>
            <Text style={styles.discountValue}>
              -{formatCurrency(displayTotals.discount, userCurrency)}
            </Text>
          </View>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Service Fee (2%)</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(displayTotals.serviceFee, userCurrency)}
          </Text>
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            Delivery Fee{appliedPromo?.type === 'free_delivery'
              ? ` (${appliedPromo.code})`
              : (memberFreeDelivery ? ` (${memberTierName} member)` : '')}
          </Text>
          {(appliedPromo?.type === 'free_delivery' || memberFreeDelivery) ? (
            <Text style={[styles.totalValue, { color: '#10B981' }]}>FREE 🚚</Text>
          ) : (
            <Text style={styles.totalValue}>
              {hasDeliveryAddress
                ? formatCurrency(displayTotals.deliveryFee, userCurrency)
                : '-'}
            </Text>
          )}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>VAT (7.5%)</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(displayTotals.tax, userCurrency)}
          </Text>
        </View>

        {displayTotals.customizationFee > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Customization Fee</Text>
            <Text style={styles.totalValue}>
              {formatCurrency(displayTotals.customizationFee, userCurrency)}
            </Text>
          </View>
        )}

        <View style={[styles.totalRow, styles.finalTotal]}>
          <Text style={styles.finalTotalLabel}>Total</Text>
          <Text style={styles.finalTotalValue}>
            {formatCurrency(displayTotals.total, userCurrency)}
          </Text>
        </View>
      </View>
    </View>
  );
}
