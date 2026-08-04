import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Package, Calendar, User, Phone, Globe, Send, Tag, MapPin } from 'lucide-react-native';
import type { Order } from '../../types';
import { isCustomOrder, getActualPaymentCurrency, formatAmountInPaymentCurrency, formatOrderDetailsDate } from '../../helpers';
import { styles } from '../../styles';

interface OrderInfoSectionProps {
  order: Order;
  isAdmin: boolean;
  sendingReminder: boolean;
  onSendPaymentReminder: () => void;
}

export function OrderInfoSection({ order, isAdmin, sendingReminder, onSendPaymentReminder }: OrderInfoSectionProps) {
  const custom = isCustomOrder(order);
  const actualPaymentCurrency = getActualPaymentCurrency(order);
  const customerPhone = order.contact_phone || order.profiles?.phone || null;
  const hasInvoice = !!(order.invoice_sent || (order.invoices && order.invoices.length > 0));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Information</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Package size={20} color="#6B7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>#{order.id.toString().substring(0, 8)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Calendar size={20} color="#6B7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Created</Text>
            <Text style={styles.infoValue}>{formatOrderDetailsDate(order.created_at)}</Text>
          </View>
        </View>

        {isAdmin && (
          <View style={styles.infoRow}>
            <User size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Customer</Text>
              <Text style={styles.infoValue}>
                {order.profiles?.full_name || order.profiles?.email || 'Unknown'}
              </Text>
            </View>
          </View>
        )}

        {isAdmin && customerPhone && (
          <View style={styles.infoRow}>
            <Phone size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Customer Phone</Text>
              <Text style={styles.infoValue}>{customerPhone}</Text>
            </View>
          </View>
        )}

        <View style={styles.infoRow}>
          <Globe size={20} color="#6B7280" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Payment Currency</Text>
            <Text style={styles.infoValue}>{actualPaymentCurrency}</Text>
          </View>
        </View>

        {isAdmin && !custom && order.payment_status === 'pending_payment' && order.order_status !== 'cancelled' && (
          <View style={styles.reminderCard}>
            <View style={styles.infoContent}>
              <Text style={styles.reminderTitle}>Payment pending</Text>
              <Text style={styles.reminderHint}>{"This order hasn't been paid yet. Remind the customer to complete payment."}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Send payment reminder" accessibilityState={{ busy: sendingReminder, disabled: sendingReminder }} disabled={sendingReminder} style={[styles.reminderButton, sendingReminder && { opacity: 0.6 }]} onPress={onSendPaymentReminder}>
              <Send size={16} color="#FFFFFF" />
              <Text style={styles.reminderButtonText}>{sendingReminder ? 'Sending…' : 'Send payment reminder'}</Text>
            </Pressable>
          </View>
        )}

        {/* Promo Code (if applied) - Show for EVERYONE on regular orders */}
        {!custom && order.promo_code && (order.discount_amount ?? 0) > 0 && (
          <View style={styles.infoRow}>
            <Tag size={20} color="#10B981" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Promo Code</Text>
              <Text style={[styles.infoValue, { color: '#10B981' }]}>
                {order.promo_code} ({formatAmountInPaymentCurrency(order, order.discount_amount ?? 0)} discount)
              </Text>
            </View>
          </View>
        )}

        {custom && (
          <View style={styles.infoRow}>
            <Send size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Invoice Status</Text>
              <Text style={[styles.infoValue, { color: hasInvoice ? '#10B981' : '#F59E0B' }]}>
                {hasInvoice ? (isAdmin ? 'Invoice Sent' : 'Invoice Received') : 'No Invoice Yet'}
              </Text>
            </View>
          </View>
        )}

        {!custom && order.delivery_address && (
          <View style={styles.infoRow}>
            <MapPin size={20} color="#6B7280" />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              <Text style={styles.infoValue}>{order.delivery_address}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
