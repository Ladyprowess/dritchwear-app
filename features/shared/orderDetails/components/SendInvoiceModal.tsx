import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Alert } from 'react-native';
import { styles } from '../styles';

interface SendInvoiceModalProps {
  visible: boolean;
  actualPaymentCurrency: string;
  onClose: () => void;
  onSend: (invoiceData: { amount: string; description: string }) => Promise<boolean>;
}

export function SendInvoiceModal({ visible, actualPaymentCurrency, onClose, onSend }: SendInvoiceModalProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
      setDescription('');
    }
  }, [visible]);

  const handleSendPress = async () => {
    if (!amount || !description) {
      Alert.alert('Error', 'Please fill in all invoice fields');
      return;
    }
    const success = await onSend({ amount, description });
    if (success) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.invoiceModalContent}>
          <Text style={styles.invoiceModalTitle}>Send Invoice ({actualPaymentCurrency})</Text>

          <View style={styles.invoiceForm}>
            <Text style={styles.invoiceFormLabel}>Amount ({actualPaymentCurrency})</Text>
            <TextInput
              style={styles.invoiceFormInput}
              value={amount}
              onChangeText={setAmount}
              placeholder={`Enter amount in ${actualPaymentCurrency}`}
              keyboardType="numeric"
            />

            <Text style={styles.invoiceFormLabel}>Description</Text>
            <TextInput
              style={[styles.invoiceFormInput, styles.invoiceFormTextArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Enter invoice description"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.currencyNote}>
              💡 Invoice will be sent in payment currency: {actualPaymentCurrency}
            </Text>

            <View style={styles.warningCard}>
              <Text style={styles.warningText}>
                ⚠️ Only one invoice can be sent per custom order. Please ensure all details are correct before sending.
              </Text>
            </View>
          </View>

          <View style={styles.invoiceModalActions}>
            <Pressable style={styles.invoiceModalCancel} onPress={onClose}>
              <Text style={styles.invoiceModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.invoiceModalSend} onPress={handleSendPress}>
              <Text style={styles.invoiceModalSendText}>Send Invoice</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
