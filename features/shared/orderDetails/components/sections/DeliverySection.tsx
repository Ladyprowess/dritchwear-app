import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Truck, ExternalLink, Gift, CheckCircle2 } from 'lucide-react-native';
import type { Order } from '../../types';
import { formatOrderDetailsDate } from '../../helpers';
import { styles as sharedStyles } from '../../styles';

interface DeliverySectionProps {
  order: Order;
  isAdmin: boolean;
  givingCredit: boolean;
  onGiveLateDeliveryCredit: () => void;
}

const ACTIVE_STATUSES = ['confirmed', 'processing', 'shipped'];

export function DeliverySection({ order, isAdmin, givingCredit, onGiveLateDeliveryCredit }: DeliverySectionProps) {
  const hasTracking = !!order.tracking_number;
  const daysSinceConfirmed = order.confirmed_at ? Math.floor((Date.now() - new Date(order.confirmed_at).getTime()) / (24 * 60 * 60 * 1000)) : 0;
  const isOverdue = !!order.confirmed_at && daysSinceConfirmed >= 7;
  const eligibleForGuarantee = order.payment_status === 'paid' && ACTIVE_STATUSES.includes(order.order_status || '') && isOverdue;
  const alreadyCredited = !!order.late_delivery_credit_at;

  if (!hasTracking && !eligibleForGuarantee && !alreadyCredited) return null;

  return (
    <View style={sharedStyles.section}>
      <Text style={sharedStyles.sectionTitle}>Delivery</Text>
      <View style={sharedStyles.infoCard}>
        {hasTracking && (
          <View style={local.row}>
            <Truck size={20} color="#6B7280" />
            <View style={local.rowContent}>
              <Text style={sharedStyles.infoLabel}>Tracking Number</Text>
              <Text style={sharedStyles.infoValue}>{order.tracking_number}</Text>
              {!!order.tracking_link && (
                <Pressable style={local.trackButton} onPress={() => Linking.openURL(order.tracking_link!)}>
                  <ExternalLink size={14} color="#5A2D82" />
                  <Text style={local.trackButtonText}>Track Package</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {alreadyCredited ? (
          <View style={[local.row, local.creditGivenRow]}>
            <CheckCircle2 size={20} color="#10B981" />
            <View style={local.rowContent}>
              <Text style={[sharedStyles.infoLabel, { color: '#047857' }]}>Late delivery credit given</Text>
              <Text style={sharedStyles.infoValue}>₦1,000 credited on {formatOrderDetailsDate(order.late_delivery_credit_at!)}</Text>
            </View>
          </View>
        ) : eligibleForGuarantee ? (
          <View style={local.guaranteeCard}>
            <Gift size={18} color="#B45309" />
            <Text style={local.guaranteeText}>
              This order was confirmed more than 7 days ago. If the delay is on us (not a pending pickup), consider crediting ₦1,000 as goodwill below.
            </Text>
          </View>
        ) : null}

        {isAdmin && !alreadyCredited && (
          <Pressable
            style={[local.creditButton, givingCredit && local.creditButtonDisabled]}
            onPress={onGiveLateDeliveryCredit}
            disabled={givingCredit}
          >
            <Gift size={16} color="#FFFFFF" />
            <Text style={local.creditButtonText}>{givingCredit ? 'Crediting...' : 'Give ₦1,000 Late Delivery Credit'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  rowContent: { marginLeft: 12, flex: 1 },
  trackButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  trackButtonText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#5A2D82' },
  creditGivenRow: { marginBottom: 0 },
  guaranteeCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  guaranteeText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#92400E' },
  creditButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    minHeight: 44, borderRadius: 10, backgroundColor: '#5A2D82',
  },
  creditButtonDisabled: { opacity: 0.6 },
  creditButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },
});
