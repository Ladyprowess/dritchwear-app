import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart } from 'lucide-react-native';
import { styles } from '../styles';

interface EmptyCartViewProps {
  onShopPress: () => void;
}

export function EmptyCartView({ onShopPress }: EmptyCartViewProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
      </View>

      <View style={styles.emptyContainer}>
        <ShoppingCart size={80} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Text style={styles.emptySubtitle}>
          Add some items to your cart to get started
        </Text>
        <Pressable
          style={styles.shopButton}
          onPress={onShopPress}
        >
          <Text style={styles.shopButtonText}>Start Shopping</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
