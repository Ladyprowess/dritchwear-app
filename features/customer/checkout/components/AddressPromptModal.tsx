import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../styles';

interface AddressPromptModalProps {
  visible: boolean;
  defaultAddress: string;
  onClose: () => void;
  onChangeAddress: () => void;
  onUseDefaultAddress: () => void;
}

export function AddressPromptModal({ visible, defaultAddress, onClose, onChangeAddress, onUseDefaultAddress }: AddressPromptModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>Use saved address?</Text>
          <Text style={styles.promptText} numberOfLines={4}>
            {defaultAddress}
          </Text>

          <View style={styles.promptActions}>
            <Pressable style={styles.secondaryBtn} onPress={onChangeAddress}>
              <Text style={styles.secondaryBtnText}>Change</Text>
            </Pressable>

            <Pressable style={styles.primaryBtn} onPress={onUseDefaultAddress}>
              <Text style={styles.primaryBtnText}>Use this</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
