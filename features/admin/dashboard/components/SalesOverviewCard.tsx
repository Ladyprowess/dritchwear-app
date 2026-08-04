import React from 'react';
import { Text, View } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import AreaLineChart from '@/components/charts/AreaLineChart';
import { styles } from '../styles';

interface SalesOverviewCardProps {
  salesSeries: number[];
  width: number;
}

function SalesOverviewCardBase({ salesSeries, width }: SalesOverviewCardProps) {
  return (
    <View style={[styles.card, { width }]}>
      <Text style={styles.cardTitle}>Sales overview</Text>
      <Text style={styles.cardBig}>{formatCurrency(salesSeries.reduce((s, n) => s + n, 0), 'NGN')}</Text>
      <Text style={styles.cardCaption}>Revenue · last 30 days</Text>
      <View style={{ marginTop: 10 }}>
        <AreaLineChart data={salesSeries} width={width - 36} height={170} />
      </View>
    </View>
  );
}

export const SalesOverviewCard = React.memo(SalesOverviewCardBase);
