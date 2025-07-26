import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useEdgeToEdge } from '@/hooks/useEdgeToEdge';

interface EdgeToEdgeWrapperProps {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  backgroundColor?: string;
  enableResponsiveLayout?: boolean;
}

export default function EdgeToEdgeWrapper({ 
  children, 
  edges = ['top', 'bottom', 'left', 'right'],
  backgroundColor = '#F9FAFB',
  enableResponsiveLayout = true
}: EdgeToEdgeWrapperProps) {
  const { insets, screenInfo, getAdaptiveMargins, getResponsivePadding } = useEdgeToEdge();

  const adaptiveMargins = getAdaptiveMargins();
  const responsivePadding = getResponsivePadding();

  const paddingStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? 
      (enableResponsiveLayout ? adaptiveMargins.horizontal : insets.left) : 0,
    paddingRight: edges.includes('right') ? 
      (enableResponsiveLayout ? adaptiveMargins.horizontal : insets.right) : 0,
  };

  // Add responsive container styles for large screens
  const containerStyle = enableResponsiveLayout && (screenInfo.isTablet || screenInfo.isFoldable) ? {
    maxWidth: screenInfo.screenSize === 'xlarge' ? 1200 : 800,
    alignSelf: 'center' as const,
    width: '100%',
  } : {};

  return (
    <View style={[
      styles.container, 
      { backgroundColor },
      paddingStyle,
      containerStyle
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});