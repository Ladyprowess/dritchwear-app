import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { styles } from '../styles';

interface ContactPhoneSectionProps {
  contactPhone: string;
  onContactPhoneChange: (text: string) => void;
}

export function ContactPhoneSection({ contactPhone, onContactPhoneChange }: ContactPhoneSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Contact Phone <Text style={{ color: '#EF4444' }}>*</Text></Text>
      <View style={styles.addressCard}>
        <TextInput
          style={[styles.addressInput, { marginLeft: 0, minHeight: 50 }]}
          value={contactPhone}
          onChangeText={onContactPhoneChange}
          placeholder="Phone number for delivery contact"
          placeholderTextColor="#9CA3AF"
          keyboardType="phone-pad"
        />
      </View>
    </View>
  );
}
