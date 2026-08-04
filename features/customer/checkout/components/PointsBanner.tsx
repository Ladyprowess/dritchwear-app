import React from 'react';
import { Text, View } from 'react-native';
import { pointsToNaira } from '@/lib/points';
import { styles } from '../styles';

export function PointsBanner() {
  return (
    <View style={styles.pointsBanner}>
      <Text style={styles.pointsBannerEmoji}>⭐</Text>
      <Text style={styles.pointsBannerText}>
        You&apos;ll earn <Text style={styles.pointsBannerBold}>5 loyalty points</Text> worth ₦{pointsToNaira(5).toLocaleString()} on this order!
      </Text>
    </View>
  );
}
