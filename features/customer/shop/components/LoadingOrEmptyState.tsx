import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../styles';

interface LoadingOrEmptyStateProps {
  loading: boolean;
  hasActiveFilters: boolean;
}

export function LoadingOrEmptyState({ loading, hasActiveFilters }: LoadingOrEmptyStateProps) {
  if (loading) {
    return (
      <View style={styles.loadingGrid} accessibilityLabel="Loading products">
        {[0, 1, 2, 3].map((item) => (
          <View key={item} style={styles.productSkeleton}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLine} />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {hasActiveFilters
          ? 'No products found matching your criteria'
          : 'No products available'
        }
      </Text>
    </View>
  );
}
