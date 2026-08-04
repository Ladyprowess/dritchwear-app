import React from 'react';
import { Alert, Modal, Platform, Pressable, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { X, Link, Copy } from 'lucide-react-native';
import { styles } from '../styles';

interface PayLinkModalProps {
  visible: boolean;
  generatedPayLink: string;
  onClose: () => void;
  clearCart: () => Promise<void>;
}

export function PayLinkModal({ visible, generatedPayLink, onClose, clearCart }: PayLinkModalProps) {
  const router = useRouter();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.payLinkOverlay}>
        <View style={styles.payLinkCard}>
          <View style={styles.payLinkHeader}>
            <Text style={styles.payLinkTitle}>Payment Link Ready</Text>
            <Pressable onPress={onClose}>
              <X size={22} color="#6B7280" />
            </Pressable>
          </View>

          <View style={styles.payLinkInfoBox}>
            <Link size={18} color="#5A2D82" />
            <Text style={styles.payLinkInfoText} numberOfLines={2}>{generatedPayLink}</Text>
          </View>

          <Text style={styles.payLinkNote}>
            Share this link with someone to pay for your order. The order will move to review once payment is confirmed.
          </Text>

          <View style={styles.payLinkActions}>
            <Pressable
              style={[styles.payLinkActionBtn, { backgroundColor: '#EDE9F6' }]}
              onPress={async () => {
                await Clipboard.setStringAsync(generatedPayLink);
                onClose();
                await clearCart();
                router.back();
                router.navigate('/(customer)/orders');
                Alert.alert('Order Placed', 'Your order is pending payment.');
              }}
            >
              <Copy size={16} color="#5A2D82" />
              <Text style={[styles.payLinkActionText, { color: '#5A2D82' }]}>Copy Link</Text>
            </Pressable>

            <Pressable
              style={[styles.payLinkActionBtn, { backgroundColor: '#5A2D82', flex: 1 }]}
              onPress={async () => {
                // Web Share API throws on desktop browsers that don't support
                // it (or when the user dismisses the sheet) - don't let that
                // strand the order; proceed to clear cart and navigate regardless.
                try {
                  await Share.share({ message: `Hiya! Would you like to pay for my order on Dritchwear? 🥺\n\n${generatedPayLink}\n\nLink expires in 48 hours.`, url: generatedPayLink });
                } catch (e) {
                  console.warn('Share failed/cancelled:', e);
                }
                onClose();
                await clearCart();
                router.back();
                router.navigate('/(customer)/orders');
                if (Platform.OS !== 'web') {
                  Alert.alert('Order Placed', 'Your order is pending payment.');
                }
              }}
            >
              <Text style={[styles.payLinkActionText, { color: '#FFF' }]}>Share Link</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
