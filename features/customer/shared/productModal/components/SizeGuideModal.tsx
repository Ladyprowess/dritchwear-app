import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import SizeGuideBody from '@/components/SizeGuideBody';
import { styles } from '../styles';

interface SizeGuideModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SizeGuideModal({ visible, onClose }: SizeGuideModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sizeGuideContainer}>
        <View style={styles.sizeGuideHeader}>
          <Text style={styles.sizeGuideTitle}>Size guide</Text>
          <Pressable style={styles.sizeGuideCloseBtn} onPress={onClose} hitSlop={8}><X size={22} color="#1F2937" /></Pressable>
        </View>
        <SizeGuideBody />
      </SafeAreaView>
    </Modal>
  );
}
