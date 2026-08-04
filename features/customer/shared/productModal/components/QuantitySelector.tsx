import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { styles } from '../styles';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
  maxQuantity?: number;
}

export function QuantitySelector({ quantity, onChange, maxQuantity }: QuantitySelectorProps) {
  const atMax = typeof maxQuantity === 'number' && quantity >= maxQuantity;
  return (
    <View style={styles.selectionSection}>
      <Text style={styles.selectionTitle}>Quantity</Text>
      <View style={styles.quantityContainer}>
        <Pressable
          style={styles.quantityButton}
          onPress={() => onChange(Math.max(1, quantity - 1))}
        >
          <Minus size={20} color="#5A2D82" />
        </Pressable>
        <Text style={styles.quantityText}>{quantity}</Text>
        <Pressable
          style={[styles.quantityButton, atMax && { opacity: 0.4 }]}
          onPress={() => onChange(atMax ? quantity : quantity + 1)}
          disabled={atMax}
        >
          <Plus size={20} color="#5A2D82" />
        </Pressable>
      </View>
      {typeof maxQuantity === 'number' && maxQuantity > 0 && (
        <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>{maxQuantity} in stock</Text>
      )}
    </View>
  );
}
