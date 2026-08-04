import React from 'react';
import { Text, View } from 'react-native';
import { getStatusColor } from '@/lib/orders/statusColor';
import { styles } from '../../styles';

interface StatusSectionProps {
  currentStatus: string;
}

export function StatusSection({ currentStatus }: StatusSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Status</Text>
      <View style={styles.statusDisplayCard}>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(currentStatus)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(currentStatus) }]}>
            {currentStatus?.charAt(0).toUpperCase() + currentStatus?.slice(1).replace('_', ' ')}
          </Text>
        </View>
      </View>
    </View>
  );
}
