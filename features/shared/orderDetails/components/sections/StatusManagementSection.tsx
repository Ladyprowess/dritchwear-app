import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { statusOptions, customStatusOptions } from '../../types';
import { styles } from '../../styles';

interface StatusManagementSectionProps {
  isCustomOrder: boolean;
  currentStatus: string;
  updating: boolean;
  onStatusUpdate: (status: string) => void;
  onRequestShip?: () => void;
}

export function StatusManagementSection({ isCustomOrder, currentStatus, updating, onStatusUpdate, onRequestShip }: StatusManagementSectionProps) {
  const handlePress = (status: string) => {
    // Shipping needs tracking info first, so route it through a form instead
    // of applying the status change directly.
    if (status === 'shipped' && !isCustomOrder && onRequestShip) {
      onRequestShip();
      return;
    }
    onStatusUpdate(status);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Status Management</Text>
      <View style={styles.statusCard}>
        <Text style={styles.updateStatusLabel}>Update Status</Text>
        <View style={styles.statusOptions}>
          {(isCustomOrder ? customStatusOptions : statusOptions).map((status) => (
            <Pressable
              key={status}
              style={[
                styles.statusOption,
                currentStatus === status && styles.statusOptionActive
              ]}
              onPress={() => handlePress(status)}
              disabled={updating || currentStatus === status}
            >
              <Text
                style={[
                  styles.statusOptionText,
                  currentStatus === status && styles.statusOptionTextActive
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
