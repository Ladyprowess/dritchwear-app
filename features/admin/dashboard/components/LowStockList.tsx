import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import type { LowStockProduct } from '../types';
import { styles } from '../styles';

interface LowStockListProps {
  lowStock: LowStockProduct[];
  width: number;
  onNavigateToProducts: () => void;
}

function LowStockListBase({ lowStock, width, onNavigateToProducts }: LowStockListProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Low stock alert</Text>
        <Pressable onPress={onNavigateToProducts}><Text style={styles.seeAllText}>View all</Text></Pressable>
      </View>
      {lowStock.length > 0 ? lowStock.map((p) => (
        <Pressable key={p.id} style={styles.listRow} onPress={onNavigateToProducts}>
          <View style={styles.lowStockIcon}><AlertTriangle size={15} color="#B42318" /></View>
          <Text style={[styles.listName, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
          <Text style={styles.lowStockValue}>{p.stock} left</Text>
        </Pressable>
      )) : <Text style={styles.cardCaption}>All products well stocked</Text>}
    </View>
  );
}

export const LowStockList = React.memo(LowStockListBase);
