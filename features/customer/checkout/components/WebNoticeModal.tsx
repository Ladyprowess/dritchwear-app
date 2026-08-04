import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import type { WebNotice } from '../types';
import { styles } from '../styles';

interface WebNoticeModalProps {
  webNotice: WebNotice | null;
  onClose: () => void;
}

export function WebNoticeModal({ webNotice, onClose }: WebNoticeModalProps) {
  return (
    <Modal
      visible={!!webNotice}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.promptCard}>
          <Text style={styles.promptTitle}>{webNotice?.title}</Text>
          <Text style={styles.promptText}>{webNotice?.message}</Text>

          <View style={styles.promptActions}>
            <Pressable style={styles.primaryBtn} onPress={onClose}>
              <Text style={styles.primaryBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
