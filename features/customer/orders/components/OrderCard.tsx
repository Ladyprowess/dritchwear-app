import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { CheckCircle, XCircle, RefreshCw, Star } from 'lucide-react-native';
import { getStatusColor } from '@/lib/orders/statusColor';
import { formatCurrencyInUserPreference, formatInvoiceAmount, formatDate } from '@/lib/formatting';
import type { Order, Invoice } from '../types';
import { styles } from '../styles';

interface OrderCardProps {
  item: Order;
  preferredCurrency: string | null | undefined;
  processingInvoice: string | null;
  onPress: (order: Order) => void;
  onRepeatOrder: (order: Order) => void;
  onAcceptInvoice: (invoice: Invoice, order: Order) => void;
  onRejectInvoice: (invoice: Invoice, order: Order) => void;
  onPayForCustomOrder: (invoice: Invoice, order: Order) => void;
}

const isCustomRequest = (item: Order): boolean => !item.items;

// A "successful" order can be reordered: any paid regular order with items,
// regardless of fulfilment stage (excludes unpaid pay-for-me + custom orders).
const SUCCESSFUL_ORDER_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];
const canRepeatOrder = (order: Order) =>
  !isCustomRequest(order) &&
  !!(order.items && order.items.length > 0) &&
  (order.payment_status === 'paid' || SUCCESSFUL_ORDER_STATUSES.includes((order.order_status || '').toLowerCase()));

const generateOrderNumber = (id: string, isCustom: boolean = false) => {
  const prefix = isCustom ? 'CO' : 'OR';
  const shortId = id.slice(0, 8).toUpperCase();
  return `${prefix}-${shortId}`;
};

export function OrderCard({
  item,
  preferredCurrency,
  processingInvoice,
  onPress,
  onRepeatOrder,
  onAcceptInvoice,
  onRejectInvoice,
  onPayForCustomOrder,
}: OrderCardProps) {
  const isCustom = isCustomRequest(item);
  const status = isCustom ? item.status : item.order_status;
  const statusColor = getStatusColor(status || '');
  const orderNumber = generateOrderNumber(item.id, isCustom);
  const orderCurrency = item.currency || preferredCurrency || 'NGN';

  return (
    <Pressable
      style={styles.orderCard}
      onPress={() => onPress(item)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          {isCustom && (
            <View style={styles.customOrderBadge}>
              <Text style={styles.customOrderText}>Custom Order</Text>
            </View>
          )}
          <Text style={styles.orderId}>
            {isCustom ? item.title : orderNumber}
          </Text>
          <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
          {!isCustom && item.notes ? (
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }} numberOfLines={1}>
              Note: {item.notes}
            </Text>
          ) : null}
        </View>

        <View style={styles.orderRight}>
          <Text style={styles.orderAmount}>
            {isCustom
              ? item.budget_range
              : formatCurrencyInUserPreference(item.total || 0, preferredCurrency, orderCurrency)}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}20` }
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: statusColor }
              ]}
            >
              {status?.charAt(0).toUpperCase() + status?.slice(1).replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>

      {/* Repeat Order button for any successful (paid) regular order */}
      {canRepeatOrder(item) && (
        <Pressable
          style={styles.repeatOrderButton}
          onPress={() => onRepeatOrder(item)}
        >
          <RefreshCw size={14} color="#5A2D82" />
          <Text style={styles.repeatOrderText}>Repeat Order</Text>
        </Pressable>
      )}

      {/* Show invoice actions for custom orders */}
      {isCustom && item.invoices && item.invoices.length > 0 && (
        <View style={styles.invoiceActions}>
          {item.invoices.map((invoice) => (
            <View key={invoice.id} style={styles.invoiceItem}>
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceAmount}>
                  {formatInvoiceAmount(invoice, preferredCurrency)}
                </Text>
                <Text style={[
                  styles.invoiceStatus,
                  { color: getStatusColor(invoice.status) }
                ]}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Text>
              </View>
              <Text style={styles.invoiceDescription}>{invoice.description}</Text>

              {/* Show Accept/Reject buttons only for 'sent' status */}
              {invoice.status === 'sent' && (
                <View style={styles.invoiceButtons}>
                  <Pressable
                    style={[styles.acceptButton, processingInvoice === invoice.id && styles.buttonDisabled]}
                    onPress={() => onAcceptInvoice(invoice, item)}
                    disabled={processingInvoice === invoice.id}
                  >
                    <CheckCircle size={16} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>
                      {processingInvoice === invoice.id ? 'Processing...' : 'Accept'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.rejectButton, processingInvoice === invoice.id && styles.buttonDisabled]}
                    onPress={() => onRejectInvoice(invoice, item)}
                    disabled={processingInvoice === invoice.id}
                  >
                    <XCircle size={16} color="#FFFFFF" />
                    <Text style={styles.rejectButtonText}>
                      {processingInvoice === invoice.id ? 'Processing...' : 'Reject'}
                    </Text>

                    {!isCustom && item.order_status === 'delivered' && (
                      <View style={styles.reviewSection}>
                        <View style={styles.reviewPrompt}>
                          <Star size={14} color="#F59E0B" />
                          <Text style={styles.reviewPromptText}>Can review</Text>
                        </View>
                      </View>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Show Pay Now button for 'accepted' status */}
              {invoice.status === 'accepted' && item.status !== 'rejected' && (
                <Pressable
                  style={styles.payNowButton}
                  onPress={() => onPayForCustomOrder(invoice, item)}
                >
                  <Text style={styles.payNowButtonText}>
                    Pay Now - {formatInvoiceAmount(invoice, preferredCurrency)}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
