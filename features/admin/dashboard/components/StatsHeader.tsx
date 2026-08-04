import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { DollarSign, Package, Users, ShoppingBag, ChartBar as BarChart3 } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import type { DashboardStats } from '../types';
import { styles } from '../styles';

interface StatsHeaderProps {
  stats: DashboardStats;
  productsSold: number;
  aov: number;
  kpiWidth: number;
  onKpiPress: (type: string, title: string) => void;
}

function StatsHeaderBase({ stats, productsSold, aov, kpiWidth, onKpiPress }: StatsHeaderProps) {
  const kpis = [
    { title: 'Total Revenue', value: formatCurrency(stats.totalRevenue, 'NGN'), icon: DollarSign, accent: '#5A2D82', tint: '#F3EFF7', type: 'revenue' },
    { title: 'Orders', value: stats.totalOrders.toLocaleString(), icon: Package, accent: '#10B981', tint: '#E7F7EF', type: 'orders' },
    { title: 'Customers', value: stats.totalUsers.toLocaleString(), icon: Users, accent: '#7C3AED', tint: '#F1EAFB', type: 'users' },
    { title: 'Products Sold', value: productsSold.toLocaleString(), icon: ShoppingBag, accent: '#F59E0B', tint: '#FEF3E2', type: '' },
    { title: 'Avg Order Value', value: formatCurrency(Math.round(aov), 'NGN'), icon: BarChart3, accent: '#EC4899', tint: '#FCE7F3', type: '' },
  ];

  return (
    <View style={styles.kpiRow}>
      {kpis.map((k) => (
        <Pressable
          key={k.title}
          onPress={() => onKpiPress(k.type, k.title)}
          style={[styles.kpiCard, { width: kpiWidth }]}
        >
          <View style={styles.kpiTop}>
            <Text style={styles.kpiTitle}>{k.title}</Text>
            <View style={[styles.kpiIcon, { backgroundColor: k.tint }]}><k.icon size={16} color={k.accent} /></View>
          </View>
          <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{k.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export const StatsHeader = React.memo(StatsHeaderBase);
