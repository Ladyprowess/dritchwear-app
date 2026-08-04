import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Lock, ShoppingCart } from 'lucide-react-native';
import { styles } from '../styles';

interface AddToCartFooterProps {
  lockedTier: string | null;
  cartError: string;
  loading: boolean;
  sizesAvailable: boolean;
  colorsAvailable: boolean;
  selectedSizesCount: number;
  selectedColorsCount: number;
  ctaPulseStyle: any;
  onPress: () => void;
  outOfStock?: boolean;
}

export function AddToCartFooter({
  lockedTier,
  cartError,
  loading,
  sizesAvailable,
  colorsAvailable,
  selectedSizesCount,
  selectedColorsCount,
  ctaPulseStyle,
  onPress,
  outOfStock,
}: AddToCartFooterProps) {
  if (lockedTier) {
    return (
      <View style={styles.bottomSection}>
        <View style={[styles.addToCartButton, styles.addToCartButtonDisabled]}>
          <Lock size={18} color="#FFFFFF" />
          <Text style={styles.addToCartText}>Members only · unlock at {lockedTier}</Text>
        </View>
      </View>
    );
  }

  if (outOfStock) {
    return (
      <View style={styles.bottomSection}>
        <View style={[styles.addToCartButton, styles.addToCartButtonDisabled]}>
          <Text style={styles.addToCartText}>Out of Stock</Text>
        </View>
      </View>
    );
  }

  const itemCount = sizesAvailable && colorsAvailable
    ? selectedSizesCount * selectedColorsCount
    : sizesAvailable
      ? selectedSizesCount
      : colorsAvailable
        ? selectedColorsCount
        : 1;

  const disabled = (sizesAvailable && selectedSizesCount === 0) ||
    (colorsAvailable && selectedColorsCount === 0) ||
    loading;

  return (
    <View style={styles.bottomSection}>
      {!!cartError && <Text accessibilityRole="alert" style={styles.cartError}>{cartError}</Text>}
      <Animated.View style={ctaPulseStyle}>
        <Pressable
          style={[styles.addToCartButton, disabled && styles.addToCartButtonDisabled]}
          onPress={onPress}
          disabled={disabled}
        >
          <ShoppingCart size={20} color="#FFFFFF" />
          <Text style={styles.addToCartText}>
            {loading ? 'Adding...' : `Add to Cart (${itemCount} item${itemCount > 1 ? 's' : ''})`}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
