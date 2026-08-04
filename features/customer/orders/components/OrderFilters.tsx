import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { statusFilters } from '../types';
import { styles } from '../styles';

interface OrderFiltersProps {
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

export function OrderFilters({ selectedStatus, onSelectStatus }: OrderFiltersProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      {statusFilters.map((status) => (
        <Pressable
          key={status}
          style={[
            styles.filterChip,
            selectedStatus === status && styles.filterChipActive
          ]}
          onPress={() => onSelectStatus(status)}
        >
          <Text
            style={[
              styles.filterText,
              selectedStatus === status && styles.filterTextActive
            ]}
          >
            {status}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
