import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { styles } from '../styles';

interface QuantitySelectorProps {
  quantity: number;
  onChange: (quantity: number) => void;
}

export function QuantitySelector({ quantity, onChange }: QuantitySelectorProps) {
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
          style={styles.quantityButton}
          onPress={() => onChange(quantity + 1)}
        >
          <Plus size={20} color="#5A2D82" />
        </Pressable>
      </View>
    </View>
  );
}
