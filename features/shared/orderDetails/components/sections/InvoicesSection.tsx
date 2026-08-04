import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Send, CheckCircle } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import { getStatusColor } from '@/lib/orders/statusColor';
import type { Order } from '../../types';
import { getActualPaymentCurrency, formatOrderDetailsDate } from '../../helpers';
import { styles } from '../../styles';

interface InvoicesSectionProps {
  order: Order;
  mode: 'view' | 'manage';
  isAdmin: boolean;
  currentStatus: string;
  onSendInvoicePress: () => void;
}

export function InvoicesSection({ order, mode, isAdmin, currentStatus, onSendInvoicePress }: InvoicesSectionProps) {
  const actualPaymentCurrency = getActualPaymentCurrency(order);
  const hasInvoice = !!(order.invoice_sent || (order.invoices && order.invoices.length > 0));

  const canSendInvoice =
    isAdmin &&
    !['completed', 'cancelled', 'rejected'].includes(currentStatus || '') &&
    !hasInvoice;

  return (
    <>
      {order.invoices && order.invoices.length > 0 && (
        <View style={styles.invoicesSection}>
          <Text style={styles.invoicesTitle}>Invoices</Text>
          {order.invoices.map((invoice) => (
            <View key={invoice.id} style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <Text style={styles.invoiceAmount}>
                  {formatCurrency(invoice.original_amount || invoice.amount, invoice.currency || actualPaymentCurrency)}
                </Text>
                <Text style={[styles.invoiceStatus, { color: getStatusColor(invoice.status) }]}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Text>
              </View>
              <Text style={styles.invoiceDescription}>{invoice.description}</Text>
              <Text style={styles.invoiceDate}>{formatOrderDetailsDate(invoice.created_at)}</Text>
            </View>
          ))}
        </View>
      )}

      {mode === 'manage' && canSendInvoice && (
        <Pressable style={styles.sendInvoiceButton} onPress={onSendInvoicePress}>
          <Send size={20} color="#FFFFFF" />
          <Text style={styles.sendInvoiceText}>Send Invoice ({actualPaymentCurrency})</Text>
        </Pressable>
      )}

      {isAdmin && hasInvoice && (
        <View style={styles.invoiceAlreadySentCard}>
          <CheckCircle size={20} color="#10B981" />
          <Text style={styles.invoiceAlreadySentText}>
            Invoice has already been sent for this order
          </Text>
        </View>
      )}
    </>
  );
}
