import React from 'react';
import * as Clipboard from 'expo-clipboard';
import { Modal, Pressable, Text, View } from 'react-native';
import { X, Copy } from 'lucide-react-native';
import type { SpecialOffer } from '../types';
import { BRAND_PURPLE } from '../constants';
import { styles } from '../styles';

interface OfferModalProps {
  activeOffer: SpecialOffer | null;
  showOffer: boolean;
  isDesktop: boolean;
  onDismiss: () => void;
}

export function OfferModal({ activeOffer, showOffer, isDesktop, onDismiss }: OfferModalProps) {
  if (!activeOffer) return null;

  const offerCard = (
    <View style={styles.offerModal}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close offer" style={styles.offerClose} onPress={onDismiss}>
        <X size={18} color="#665F6C" />
      </Pressable>
      <Text style={styles.offerEyebrow}>SPECIAL OFFER</Text>
      <Text style={styles.offerTitle}>{activeOffer.title}</Text>
      <Text style={styles.offerSubtitle}>{activeOffer.subtitle}</Text>
      <Pressable
        accessibilityRole="button"
        style={styles.offerCode}
        onPress={() => Clipboard.setStringAsync(activeOffer.promo_code)}
      >
        <View>
          <Text style={styles.offerCodeLabel}>PROMO CODE</Text>
          <Text style={styles.offerCodeValue}>{activeOffer.promo_code}</Text>
        </View>
        <Copy size={18} color={BRAND_PURPLE} />
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.offerDone} onPress={onDismiss}>
        <Text style={styles.offerDoneText}>Continue shopping</Text>
      </Pressable>
    </View>
  );

  if (isDesktop) {
    return showOffer ? (
      <View pointerEvents="box-none" style={styles.offerDesktopLayer}>{offerCard}</View>
    ) : null;
  }

  return (
    <Modal visible={showOffer} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.offerOverlay} onPress={onDismiss}>
        <Pressable onPress={(event) => event.stopPropagation()}>{offerCard}</Pressable>
      </Pressable>
    </Modal>
  );
}
