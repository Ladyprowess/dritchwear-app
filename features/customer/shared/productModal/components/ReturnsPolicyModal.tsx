import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import ReturnsBody from '@/components/ReturnsBody';
import { styles } from '../styles';

interface ReturnsPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ReturnsPolicyModal({ visible, onClose }: ReturnsPolicyModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sizeGuideContainer}>
        <View style={styles.sizeGuideHeader}>
          <Text style={styles.sizeGuideTitle}>Returns & exchanges</Text>
          <Pressable style={styles.sizeGuideCloseBtn} onPress={onClose} hitSlop={8}><X size={22} color="#1F2937" /></Pressable>
        </View>
        <ReturnsBody />
      </SafeAreaView>
    </Modal>
  );
}
