import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { formatInvoiceAmount } from '@/lib/formatting';
import type { Order, Invoice } from '../types';
import { styles } from '../styles';

interface PaymentChoiceModalProps {
  paymentChoice: { invoice: Invoice; order: Order } | null;
  preferredCurrency: string | null | undefined;
  onClose: () => void;
  onPayWithWallet: (invoice: Invoice, order: Order) => void;
  onPayOnline: (invoice: Invoice, order: Order) => void;
}

export function PaymentChoiceModal({ paymentChoice, preferredCurrency, onClose, onPayWithWallet, onPayOnline }: PaymentChoiceModalProps) {
  return (
    <Modal visible={!!paymentChoice} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.choiceOverlay}>
        <View style={styles.choiceCard}>
          <Text style={styles.choiceTitle}>Choose payment method</Text>
          <Text style={styles.choiceCopy}>{paymentChoice ? `Pay ${formatInvoiceAmount(paymentChoice.invoice, preferredCurrency)} for this custom order.` : ''}</Text>
          <Pressable style={styles.choicePrimary} onPress={() => { const choice = paymentChoice; onClose(); if (choice) void onPayWithWallet(choice.invoice, choice.order); }}>
            <Text style={styles.choicePrimaryText}>Pay with wallet</Text>
          </Pressable>
          {(paymentChoice?.invoice.currency || 'NGN') === 'NGN' && <Pressable style={styles.choiceSecondary} onPress={() => { const choice = paymentChoice; onClose(); if (choice) onPayOnline(choice.invoice, choice.order); }}><Text style={styles.choiceSecondaryText}>Card or bank transfer</Text></Pressable>}
          <Pressable style={styles.choiceCancel} onPress={onClose}><Text style={styles.choiceCancelText}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
