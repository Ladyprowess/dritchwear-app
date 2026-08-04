import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import type { Order } from '../../types';
import { formatAmountInPaymentCurrency } from '../../helpers';
import { styles } from '../../styles';

interface OrderItemsSectionProps {
  order: Order;
  onDownloadImage: (imageUrl: string) => void;
}

export function OrderItemsSection({ order, onDownloadImage }: OrderItemsSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Items</Text>
      {order.items?.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemVariants}>
              Size: {item.size} • Color: {item.color}
            </Text>
            {!!item.note && (
              <Text style={styles.itemNote}>📝 Note: {item.note}</Text>
            )}
            {!!item.logo_url && (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.itemNote}>🎨 Customer logo</Text>
                <Image source={{ uri: item.logo_url }} style={{ width: 72, height: 72, borderRadius: 8, marginTop: 6, backgroundColor: '#F3F4F6' }} resizeMode="contain" />
                <Pressable onPress={() => onDownloadImage(item.logo_url!)} style={{ marginTop: 6 }}>
                  <Text style={{ color: '#5A2D82', fontSize: 13, fontWeight: '600' }}>Download logo</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
          </View>
          <Text style={styles.itemPrice}>
            {formatAmountInPaymentCurrency(order, item.price * item.quantity)}
          </Text>
        </View>
      ))}
    </View>
  );
}
