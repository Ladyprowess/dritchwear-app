import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import type { StoreProduct } from '@/types/product';
import { styles } from '../styles';

interface ColorSelectorProps {
  product: StoreProduct;
  selectedColors: string[];
  onToggleColor: (color: string) => void;
}

export function ColorSelector({ product, selectedColors, onToggleColor }: ColorSelectorProps) {
  return (
    <View style={styles.selectionSection}>
      <Text style={styles.selectionTitle}>
        Select Colors ({selectedColors.length} selected)
      </Text>
      <View style={styles.optionsGrid}>
        {product.colors.map((color) => (
          <Pressable
            key={color}
            style={[
              styles.optionButton,
              selectedColors.includes(color) && styles.optionButtonActive
            ]}
            onPress={() => onToggleColor(color)}
          >
            {selectedColors.includes(color) && (
              <Check size={16} color="#FFFFFF" style={styles.checkIcon} />
            )}
            <Text
              style={[
                styles.optionText,
                selectedColors.includes(color) && styles.optionTextActive
              ]}
            >
              {color}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
