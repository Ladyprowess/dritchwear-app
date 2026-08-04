import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { hasSizeStock, sizeStock, type StoreProduct } from '@/types/product';
import { styles } from '../styles';

interface SizeSelectorProps {
  product: StoreProduct;
  selectedSizes: string[];
  onToggleSize: (size: string) => void;
  onOpenSizeGuide: () => void;
}

export function SizeSelector({ product, selectedSizes, onToggleSize, onOpenSizeGuide }: SizeSelectorProps) {
  return (
    <View style={styles.selectionSection}>
      <View style={styles.sizeHeaderRow}>
        <Text style={styles.selectionTitle}>
          Select Sizes ({selectedSizes.length} selected)
        </Text>
        <Pressable onPress={onOpenSizeGuide} hitSlop={6}>
          <Text style={styles.sizeGuideLink}>Size guide ›</Text>
        </Pressable>
      </View>
      <View style={styles.optionsGrid}>
        {product.sizes.map((size) => {
          const perSize = hasSizeStock(product);
          const left = sizeStock(product, size);
          const soldOut = perSize && left <= 0;
          return (
            <Pressable
              key={size}
              style={[
                styles.optionButton,
                selectedSizes.includes(size) && styles.optionButtonActive,
                soldOut && styles.optionButtonSoldOut,
              ]}
              onPress={() => { if (!soldOut) onToggleSize(size); }}
              disabled={soldOut}
            >
              {selectedSizes.includes(size) && (
                <Check size={16} color="#FFFFFF" style={styles.checkIcon} />
              )}
              <Text
                style={[
                  styles.optionText,
                  selectedSizes.includes(size) && styles.optionTextActive,
                  soldOut && styles.optionTextSoldOut,
                ]}
              >
                {size}
              </Text>
              {perSize && !soldOut && left <= 5 && (
                <Text style={styles.sizeLeft}>{left} left</Text>
              )}
              {soldOut && <Text style={styles.sizeLeft}>Sold out</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
