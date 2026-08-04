import React from 'react';
import { Text, View } from 'react-native';
import { formatCurrency } from '@/lib/currency';
import { styles } from '../styles';

interface SelectionSummaryProps {
  sizesAvailable: boolean;
  colorsAvailable: boolean;
  selectedSizesCount: number;
  selectedColorsCount: number;
  productPriceInUserCurrency: number;
  quantity: number;
  userCurrency: string;
}

export function SelectionSummary({
  sizesAvailable,
  colorsAvailable,
  selectedSizesCount,
  selectedColorsCount,
  productPriceInUserCurrency,
  quantity,
  userCurrency,
}: SelectionSummaryProps) {
  if (!(selectedSizesCount > 0 || selectedColorsCount > 0 || (!sizesAvailable && !colorsAvailable))) {
    return null;
  }

  return (
    <View style={styles.summarySection}>
      <Text style={styles.summaryTitle}>Selection Summary</Text>
      <Text style={styles.summaryText}>
        {sizesAvailable && colorsAvailable
          ? `${selectedSizesCount * selectedColorsCount} combinations will be added to cart`
          : sizesAvailable
            ? `${selectedSizesCount} size${selectedSizesCount > 1 ? 's' : ''} will be added to cart`
            : colorsAvailable
              ? `${selectedColorsCount} color${selectedColorsCount > 1 ? 's' : ''} will be added to cart`
              : '1 item will be added to cart'
        }
      </Text>
      <Text style={styles.summaryPrice}>
        Total: {formatCurrency(
          productPriceInUserCurrency * quantity * Math.max(
            (sizesAvailable ? selectedSizesCount : 1) * (colorsAvailable ? selectedColorsCount : 1),
            1
          ),
          userCurrency
        )}
      </Text>
    </View>
  );
}
