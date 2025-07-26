import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import * as SystemUI from 'expo-system-ui';

export function useEdgeToEdge() {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Configure edge-to-edge for Android 15+
    if (Platform.OS === 'android') {
      // Enable edge-to-edge display
      SystemUI.setBackgroundColorAsync('transparent');
      
      // Set navigation bar to transparent for edge-to-edge
      if (Platform.Version >= 35) {
        console.log('Configuring edge-to-edge for Android 15+ (SDK 35+)');
      }
    }
  }, []);

  return {
    insets,
    // Helper function to get safe padding for different areas
    getSafePadding: (area: 'top' | 'bottom' | 'left' | 'right' | 'horizontal' | 'vertical') => {
      switch (area) {
        case 'top':
          return insets.top;
        case 'bottom':
          return insets.bottom;
        case 'left':
          return insets.left;
        case 'right':
          return insets.right;
        case 'horizontal':
          return Math.max(insets.left, insets.right);
        case 'vertical':
          return Math.max(insets.top, insets.bottom);
        default:
          return 0;
      }
    }
  };
}