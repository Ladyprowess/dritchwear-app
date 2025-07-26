import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hook to handle edge-to-edge display for Android 15+
 * Provides safe area insets and handles system UI visibility
 */
export function useEdgeToEdge() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (Platform.OS === 'android') {
      // Enable edge-to-edge for Android 15+
      // This is handled by the native configuration, but we can add
      // additional JavaScript-side handling here if needed
      console.log('Edge-to-edge enabled for Android');
    }
  }, []);

  return {
    insets,
    // Helper functions for common padding scenarios
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
    // Combined horizontal and vertical padding
    paddingHorizontal: Math.max(insets.left, insets.right),
    paddingVertical: Math.max(insets.top, insets.bottom),
  };
}

/**
 * Get safe area styles for common use cases
 */
export function getSafeAreaStyles(insets: ReturnType<typeof useSafeAreaInsets>) {
  return {
    container: {
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    header: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    footer: {
      paddingBottom: insets.bottom,
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
    content: {
      paddingLeft: insets.left,
      paddingRight: insets.right,
    },
  };
}