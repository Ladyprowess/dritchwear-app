import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import PaystackPayment from '@/components/PaystackPayment';
import type { Order } from '../types';

interface RetryOrderPaymentModalProps {
  visible: boolean;
  order: Order | null;
  userEmail?: string | null;
  onSuccess: (response: any) => void;
  onCancel: () => void;
}

export function RetryOrderPaymentModal({ visible, order, userEmail, onSuccess, onCancel }: RetryOrderPaymentModalProps) {
  if (!order) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <Text style={{ fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' }}>Complete Payment</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onCancel} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color="#1F2937" />
          </Pressable>
        </View>

        {visible && (
          <PaystackPayment
            email={userEmail || ''}
            amount={order.total ?? 0}
            publicKey={process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || ''}
            customerName={userEmail || 'Customer'}
            orderId={order.id}
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
