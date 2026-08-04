import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { styles } from '../styles';

interface OrderNoteSectionProps {
  orderNote: string;
  onOrderNoteChange: (text: string) => void;
}

export function OrderNoteSection({ orderNote, onOrderNoteChange }: OrderNoteSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Description (Optional)</Text>

      <View style={styles.addressCard}>
        <TextInput
          style={styles.addressInput}
          value={orderNote}
          onChangeText={onOrderNoteChange}
          placeholder="Add a note for your order (e.g. delivery instructions, packaging request, etc.)"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );
}
