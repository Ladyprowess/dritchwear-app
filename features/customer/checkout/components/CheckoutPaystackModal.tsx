import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import PaystackPayment from '@/components/PaystackPayment';
import { styles } from '../styles';

interface CheckoutPaystackModalProps {
  visible: boolean;
  orderData: any;
  userEmail?: string | null;
  customerName?: string;
  onSuccess: (response: any) => void;
  onCancel: () => void;
}

export function CheckoutPaystackModal({ visible, orderData, userEmail, customerName, onSuccess, onCancel }: CheckoutPaystackModalProps) {
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
            <X size={24} color="#1F2937" />
          </Pressable>
        </View>

        {visible && orderData && (
          <PaystackPayment
            email={userEmail || ''}
            amount={orderData.total}
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
