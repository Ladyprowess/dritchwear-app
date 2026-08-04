import React from 'react';
import { Text, View } from 'react-native';
import DonutChart from '@/components/charts/DonutChart';
import type { StatusCount } from '../types';
import { styles } from '../styles';

interface OrderStatusDonutProps {
  statusCounts: StatusCount[];
  totalOrders: number;
  width: number;
}

function OrderStatusDonutBase({ statusCounts, totalOrders, width }: OrderStatusDonutProps) {
  return (
    <View style={[styles.card, { width }]}>
      <Text style={styles.cardTitle}>Order status</Text>
      <View style={styles.donutWrap}>
        <DonutChart segments={statusCounts} size={140} strokeWidth={18} centerValue={totalOrders.toLocaleString()} centerLabel="Total" />
        <View style={styles.legend}>
          {statusCounts.length > 0 ? statusCounts.map((s) => (
            <View key={s.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={styles.legendValue}>{s.value}</Text>
            </View>
          )) : <Text style={styles.cardCaption}>No orders yet</Text>}
        </View>
      </View>
    </View>
  );
}

export const OrderStatusDonut = React.memo(OrderStatusDonutBase);
