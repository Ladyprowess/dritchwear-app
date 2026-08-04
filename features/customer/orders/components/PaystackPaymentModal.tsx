import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { XCircle } from 'lucide-react-native';
import PaystackPayment from '@/components/PaystackPayment';
import type { Invoice } from '../types';
import { styles } from '../styles';

interface PaystackPaymentModalProps {
  visible: boolean;
  paymentInvoice: Invoice | null;
  userEmail?: string;
  customerName?: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
}

export function PaystackPaymentModal({ visible, paymentInvoice, userEmail, customerName, onSuccess, onCancel }: PaystackPaymentModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Complete Payment</Text>
          <Pressable style={styles.closeButton} onPress={onCancel}>
            <XCircle size={24} color="#1F2937" />
          </Pressable>
        </View>

        {visible && paymentInvoice && (
          <PaystackPayment
            email={userEmail || ''}
            amount={paymentInvoice.amount}
            publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
            customerName={customerName || 'Customer'}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
