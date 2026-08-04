import React from 'react';
import { Text, View } from 'react-native';
import { getStatusColor } from '@/lib/orders/statusColor';
import { styles } from '../../styles';

interface StatusSectionProps {
  currentStatus: string;
}

export function StatusSection({ currentStatus }: StatusSectionProps) {
  const label = currentStatus ? currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1).replace('_', ' ') : 'Unknown';
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Order Status</Text>
      <View style={styles.statusDisplayCard}>
        <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(currentStatus)}20` }]}>
          <Text style={[styles.statusText, { color: getStatusColor(currentStatus) }]}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}
