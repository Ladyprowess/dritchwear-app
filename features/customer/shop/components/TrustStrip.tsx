import React from 'react';
import { Text, View } from 'react-native';
import { Sparkles, Truck, ShieldCheck } from 'lucide-react-native';
import { BRAND_PURPLE } from '../constants';
import { styles } from '../styles';

const TRUST_ITEMS = [
  { Icon: Sparkles, label: 'Premium fabric' },
  { Icon: Truck, label: 'Fast delivery' },
  { Icon: ShieldCheck, label: 'Secure checkout' },
];

export function TrustStrip() {
  return (
    <View style={styles.trustStrip}>
      {TRUST_ITEMS.map(({ Icon, label }) => (
        <View key={label} style={styles.trustItem}>
          <View style={styles.trustCheck}><Icon size={13} color={BRAND_PURPLE} strokeWidth={2.2} /></View>
          <Text style={styles.trustText}>{label}</Text>
        </View>
      ))}
    </View>
  );
}
