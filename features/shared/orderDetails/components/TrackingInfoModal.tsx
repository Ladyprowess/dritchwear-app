import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../styles';

interface TrackingInfoModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (trackingNumber: string, trackingLink: string) => Promise<boolean>;
}

export function TrackingInfoModal({ visible, onClose, onSubmit }: TrackingInfoModalProps) {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingLink, setTrackingLink] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setTrackingNumber('');
      setTrackingLink('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!trackingNumber.trim()) {
      Alert.alert('Error', 'Please enter a tracking number.');
      return;
    }
    setSubmitting(true);
    const success = await onSubmit(trackingNumber.trim(), trackingLink.trim());
    setSubmitting(false);
    if (success) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.invoiceModalContent}>
          <Text style={styles.invoiceModalTitle}>Mark as Shipped</Text>

          <View style={styles.invoiceForm}>
            <Text style={styles.invoiceFormLabel}>Tracking Number</Text>
            <TextInput
              style={styles.invoiceFormInput}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="e.g. GIG-1029384756"
              autoCapitalize="characters"
            />

            <Text style={styles.invoiceFormLabel}>Tracking Link (optional)</Text>
            <TextInput
              style={styles.invoiceFormInput}
              value={trackingLink}
              onChangeText={setTrackingLink}
              placeholder="https://courier.com/track/..."
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.currencyNote}>
              💡 This is included in the "Order shipped" email so the customer can track their delivery.
            </Text>
          </View>

          <View style={styles.invoiceModalActions}>
            <Pressable style={styles.invoiceModalCancel} onPress={onClose} disabled={submitting}>
              <Text style={styles.invoiceModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.invoiceModalSend} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.invoiceModalSendText}>{submitting ? 'Saving...' : 'Mark as Shipped'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
