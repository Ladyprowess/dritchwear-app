import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { styles } from '../styles';

interface DeliveryAddressSectionProps {
  defaultAddress: string;
  deliveryAddress: string;
  onDeliveryAddressChange: (text: string) => void;
  deliveryState: string;
  onDeliveryStateChange: (text: string) => void;
  deliveryCountry: string;
  onDeliveryCountryChange: (text: string) => void;
}

export function DeliveryAddressSection({
  defaultAddress,
  deliveryAddress,
  onDeliveryAddressChange,
  deliveryState,
  onDeliveryStateChange,
  deliveryCountry,
  onDeliveryCountryChange,
}: DeliveryAddressSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Delivery Address</Text>

      {!defaultAddress.trim() && (
        <View style={styles.addressNoticeCard}>
          <Text style={styles.addressNoticeTitle}>No saved profile address</Text>
          <Text style={styles.addressNoticeText}>
            Add your delivery address below before paying, or update it later from your profile.
          </Text>
        </View>
      )}

      <View style={styles.addressCard}>
        <MapPin size={20} color="#5A2D82" />
        <TextInput
          style={styles.addressInput}
          value={deliveryAddress}
          onChangeText={onDeliveryAddressChange}
          placeholder="Enter delivery address (street, area, etc.)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={[styles.addressCard, { marginTop: 10 }]}>
        <TextInput
          style={[styles.addressInput, { marginLeft: 0, minHeight: 50 }]}
          value={deliveryState}
          onChangeText={onDeliveryStateChange}
          placeholder="State (required)"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={[styles.addressCard, { marginTop: 10 }]}>
        <TextInput
          style={[styles.addressInput, { marginLeft: 0, minHeight: 50 }]}
          value={deliveryCountry}
          onChangeText={onDeliveryCountryChange}
          placeholder="Country (required)"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.deliveryPromiseCard}>
        <Text style={styles.deliveryPromiseTitle}>🚚 Delivered in 2–7 days - our promise</Text>
        <Text style={styles.deliveryPromiseText}>
          We move fast. If your order ever takes longer than 7 days, we'll drop{' '}
          <Text style={styles.deliveryPromiseHighlight}>₦1,000 into your wallet</Text> - yours to
          spend on your next order, anytime.
        </Text>
      </View>
    </View>
  );
}
