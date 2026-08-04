import React from 'react';
import { Text, View } from 'react-native';
import MiniBars from '@/components/charts/MiniBars';
import { styles } from '../styles';

interface CustomerGrowthCardProps {
  growthSeries: number[];
  totalUsers: number;
  width: number;
}

function CustomerGrowthCardBase({ growthSeries, totalUsers, width }: CustomerGrowthCardProps) {
  return (
    <View style={[styles.card, { width, marginBottom: 8 }]}>
      <Text style={styles.cardTitle}>Customer growth</Text>
      <Text style={styles.cardBig}>{totalUsers.toLocaleString()}</Text>
      <Text style={styles.cardCaption}>New customers · last 30 days</Text>
      <View style={{ marginTop: 12 }}>
        <MiniBars data={growthSeries} width={width - 36} height={110} />
      </View>
    </View>
  );
}

export const CustomerGrowthCard = React.memo(CustomerGrowthCardBase);
