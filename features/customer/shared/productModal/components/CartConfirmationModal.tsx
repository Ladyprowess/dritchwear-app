import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../styles';

interface CartConfirmationModalProps {
  visible: boolean;
  addedItemsCount: number;
  onContinueShopping: () => void;
  onViewCart: () => void;
}

export function CartConfirmationModal({ visible, addedItemsCount, onContinueShopping, onViewCart }: CartConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onContinueShopping}
    >
      <View style={styles.cartConfirmationOverlay}>
        <View style={styles.cartConfirmationCard}>
          <Text style={styles.cartConfirmationTitle}>Added to Cart</Text>
          <Text style={styles.cartConfirmationMessage}>
            Added {addedItemsCount} item{addedItemsCount !== 1 ? 's' : ''} to your cart.
          </Text>

          <View style={styles.cartConfirmationActions}>
            <Pressable
              style={[styles.cartConfirmationButton, styles.cartConfirmationSecondaryButton]}
              onPress={onContinueShopping}
            >
              <Text style={[styles.cartConfirmationButtonText, styles.cartConfirmationSecondaryButtonText]}>
                Continue Shopping
              </Text>
            </Pressable>

            <Pressable
              style={[styles.cartConfirmationButton, styles.cartConfirmationPrimaryButton]}
              onPress={onViewCart}
            >
              <Text style={styles.cartConfirmationButtonText}>View Cart</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
