import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Plus, Minus, Trash2 } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency } from '@/lib/currency';
import type { CartItem } from '@/contexts/CartContext';
import { styles } from '../styles';

interface CartItemRowProps {
  item: CartItem;
  itemPriceInUserCurrency: number;
  userCurrency: string;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}

export function CartItemRow({ item, itemPriceInUserCurrency, userCurrency, onIncrement, onDecrement, onRemove }: CartItemRowProps) {
  return (
    <View style={styles.cartItem}>
      <Image
        source={{ uri: optimizeImageUrl(item.productImage, { width: 200 }) as string }}
        style={styles.itemImage}
        resizeMode="cover"
      />

      <View style={styles.itemDetails}>
        <Text style={styles.itemName}>{item.productName}</Text>
        <Text style={styles.itemVariant}>
          Size: {item.size} • Color: {item.color}
        </Text>
        {!!item.note && (
          <Text style={styles.itemNote}>Note: {item.note}</Text>
        )}
        {!!item.hasCustomizationFee && (
          <Text style={styles.itemNote}>Custom design added - a customization fee applies at checkout</Text>
        )}
        <Text style={styles.itemPrice}>
          {formatCurrency(itemPriceInUserCurrency, userCurrency)}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <View style={styles.quantityControls}>
          <Pressable style={styles.quantityButton} onPress={onDecrement}>
            <Minus size={16} color="#5A2D82" />
          </Pressable>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <Pressable style={styles.quantityButton} onPress={onIncrement}>
            <Plus size={16} color="#5A2D82" />
          </Pressable>
        </View>

        <Pressable style={styles.removeButton} onPress={onRemove}>
          <Trash2 size={16} color="#EF4444" />
        </Pressable>
      </View>
    </View>
  );
}
