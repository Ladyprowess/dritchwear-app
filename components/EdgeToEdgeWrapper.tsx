import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface EdgeToEdgeWrapperProps {
  children: React.ReactNode;
  backgroundColor?: string;
  statusBarStyle?: 'light' | 'dark';
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}

/**
 * Wrapper component that handles edge-to-edge display for Android 15+
 * Provides consistent safe area handling across all screens
 */
export default function EdgeToEdgeWrapper({
  children,
  backgroundColor = '#F9FAFB',
  statusBarStyle = 'dark',
  edges = ['top', 'bottom', 'left', 'right'],
}: EdgeToEdgeWrapperProps) {
  const insets = useSafeAreaInsets();

  // For Android 15+ with edge-to-edge, we need to handle insets manually
  if (Platform.OS === 'android' && Platform.Version >= 35) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <View
          style={[
            styles.content,
            {
              paddingTop: edges.includes('top') ? insets.top : 0,
              paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
              paddingLeft: edges.includes('left') ? insets.left : 0,
              paddingRight: edges.includes('right') ? insets.right : 0,
            },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  // For other platforms, use SafeAreaView as normal
  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});