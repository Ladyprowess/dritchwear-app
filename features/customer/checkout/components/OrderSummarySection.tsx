import React from 'react';
import { Text, View } from 'react-native';
import { formatCurrency, getItemPriceInUserCurrency } from '@/lib/currency';
import type { CartItem, AppliedPromo } from '@/contexts/CartContext';
import { styles } from '../styles';

interface OrderSummarySectionProps {
  items: CartItem[];
  totalItems: number;
  userCurrency: string;
  appliedPromo: AppliedPromo | null;
}

export function OrderSummarySection({ items, totalItems, userCurrency, appliedPromo }: OrderSummarySectionProps) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryCard}>
          <Text style={styles.itemsCount}>
            {totalItems} {totalItems === 1 ? 'Item' : 'Items'}
          </Text>

          {items.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryItemName}>
                {item.productName} ({item.size}, {item.color})
              </Text>
              <Text style={styles.summaryItemPrice}>
                {item.quantity}x {formatCurrency(getItemPriceInUserCurrency(item.price, userCurrency), userCurrency)}
              </Text>
            </View>
          ))}

          {items.length > 3 && (
            <Text style={styles.moreItems}>
              +{items.length - 3} more items
            </Text>
          )}

          {appliedPromo && (
            <View style={styles.promoDisplay}>
              <Text style={styles.promoDisplayText}>
                🎉 {appliedPromo.code} applied: {appliedPromo.description}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.checkoutMomentumCard}>
        <View style={styles.checkoutMomentumBadge}>
          <Text style={styles.checkoutMomentumBadgeText}>NOW</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.checkoutMomentumTitle}>You're one step from done</Text>
          <Text style={styles.checkoutMomentumText}>
            One payment confirms your items, banks your rewards, and sends your order straight into processing.
          </Text>
        </View>
      </View>
    </>
  );
}
