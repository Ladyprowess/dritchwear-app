import React from 'react';
import { View, StyleSheet, FlatList, FlatListProps } from 'react-native';
import { useEdgeToEdge } from '@/hooks/useEdgeToEdge';

interface ResponsiveGridProps<T> extends Omit<FlatListProps<T>, 'numColumns' | 'columnWrapperStyle'> {
  data: T[];
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement;
  defaultColumns?: number;
  spacing?: number;
  enableResponsiveColumns?: boolean;
}

export default function ResponsiveGrid<T>({
  data,
  renderItem,
  defaultColumns = 2,
  spacing = 16,
  enableResponsiveColumns = true,
  ...flatListProps
}: ResponsiveGridProps<T>) {
  const { getLayoutColumns, screenInfo, getResponsivePadding } = useEdgeToEdge();
  
  const numColumns = enableResponsiveColumns ? getLayoutColumns(defaultColumns) : defaultColumns;
  const responsivePadding = getResponsivePadding();

  const columnWrapperStyle = numColumns > 1 ? {
    justifyContent: 'space-between' as const,
    paddingHorizontal: responsivePadding,
    marginBottom: spacing,
  } : undefined;

  const contentContainerStyle = [
    flatListProps.contentContainerStyle,
    {
      paddingHorizontal: numColumns === 1 ? responsivePadding : 0,
    }
  ];

  return (
    <FlatList
      {...flatListProps}
      data={data}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`${numColumns}-${screenInfo.isLandscape}`} // Force re-render on orientation change
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
    />
  );
}