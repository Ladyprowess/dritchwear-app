import React from 'react';
import { Image, Text, View } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { TopProduct } from '../types';
import { styles } from '../styles';

interface TopProductsListProps {
  topProducts: TopProduct[];
  width: number;
}

function TopProductsListBase({ topProducts, width }: TopProductsListProps) {
  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.cardHeaderRow}><Text style={styles.cardTitle}>Top selling products</Text></View>
      {topProducts.length > 0 ? topProducts.map((p) => (
        <View key={p.id} style={styles.listRow}>
          <Image source={{ uri: optimizeImageUrl(p.image, { width: 80 }) as string }} style={styles.listThumb} resizeMode="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.listName} numberOfLines={1}>{p.name}</Text>
            <Text style={styles.listSub}>{formatCurrency(p.price, 'NGN')}</Text>
          </View>
          <Text style={styles.listMetric}>{p.sold} sold</Text>
        </View>
      )) : <Text style={styles.cardCaption}>No sales yet</Text>}
    </View>
  );
}

export const TopProductsList = React.memo(TopProductsListBase);
