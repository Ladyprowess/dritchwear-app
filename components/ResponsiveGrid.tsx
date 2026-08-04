import React from 'react';
import { FlatList, FlatListProps, View, ViewStyle } from 'react-native';
import { useEdgeToEdge } from '@/hooks/useEdgeToEdge';

interface ResponsiveGridProps<T>
  extends Omit<FlatListProps<T>, 'numColumns' | 'columnWrapperStyle' | 'renderItem'> {
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

  const computedColumns = enableResponsiveColumns ? getLayoutColumns(defaultColumns) : defaultColumns;
  const numColumns = computedColumns; // keep your responsive behaviour

  const columnWrapperStyle: ViewStyle | undefined =
    numColumns > 1
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
      numColumns={numColumns}
      key={`${numColumns}-${screenInfo.isLandscape}`} // re-render on orientation change
      columnWrapperStyle={columnWrapperStyle}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <View
          style={{
            flex: 1,
            maxWidth: `${100 / numColumns}%`, // ✅ prevents single item from taking full width
            paddingHorizontal: spacing / 2,
            marginBottom: spacing,
          }}
        >
          {renderItem({ item, index })}
        </View>
      )}
    />
  );
}
