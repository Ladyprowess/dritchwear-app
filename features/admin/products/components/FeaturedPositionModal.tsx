import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';
import { styles } from '../styles';

interface FeaturedPositionModalProps {
  productId: string | null;
  onClose: () => void;
  onSave: (productId: string, position: number) => Promise<void>;
}

export function FeaturedPositionModal({ productId, onClose, onSave }: FeaturedPositionModalProps) {
  const [position, setPosition] = useState('1');

  useEffect(() => {
    if (productId) setPosition('1');
  }, [productId]);

  const handleSave = async () => {
    const pos = Number(position);
    if (!pos || pos < 1 || pos > 6) {
      Alert.alert('Invalid', 'Position must be between 1 and 6.');
      return;
    }
    if (!productId) return;
    await onSave(productId, pos);
    onClose();
  };

  return (
    <Modal visible={!!productId} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.featuredOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.featuredCard}>
              <Text style={styles.featuredTitle}>Feature Product</Text>
              <Text style={styles.featuredSubtitle}>Enter position (1 to 6)</Text>

              <TextInput
                style={styles.featuredInput}
                value={position}
                onChangeText={setPosition}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#9CA3AF"
              />

              <View style={styles.featuredActions}>
                <Pressable style={styles.featuredCancel} onPress={onClose}>
                  <Text style={styles.featuredCancelText}>Cancel</Text>
                </Pressable>

                <Pressable style={styles.featuredSave} onPress={handleSave}>
                  <Text style={styles.featuredSaveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
