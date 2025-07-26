import React from 'react';
import { FlatList, FlatListProps, ViewStyle } from 'react-native';
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
  const { getLayoutColumns, screenInfo } = useEdgeToEdge();
  const numColumns = enableResponsiveColumns ? getLayoutColumns(defaultColumns) : defaultColumns;

  const columnWrapperStyle: ViewStyle | undefined = numColumns > 1
    ? {
        justifyContent: 'space-between',
        paddingHorizontal: spacing,
        marginBottom: spacing,
      }
    : undefined;

  const contentContainerStyle = [
    flatListProps.contentContainerStyle,
    {
      paddingBottom: spacing + 20,
    },
  ];

  return (
    <FlatList
      {...flatListProps}
      data={data}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`${numColumns}-${screenInfo.isLandscape}`} // re-render on orientation change
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
    />
  );
}
