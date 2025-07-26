import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Dimensions, useWindowDimensions } from 'react-native';
import { useEffect, useState } from 'react';
import * as SystemUI from 'expo-system-ui';

interface ScreenInfo {
  isTablet: boolean;
  isFoldable: boolean;
  isLandscape: boolean;
  screenSize: 'small' | 'medium' | 'large' | 'xlarge';
  aspectRatio: number;
}

export function useEdgeToEdge() {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>({
    isTablet: false,
    isFoldable: false,
    isLandscape: false,
    screenSize: 'small',
    aspectRatio: 1,
  });

  useEffect(() => {
    // Configure edge-to-edge for Android 15+
    if (Platform.OS === 'android') {
      // Use new Android 15+ compatible APIs
      SystemUI.setBackgroundColorAsync('transparent');
      
      if (Platform.Version >= 35) {
        console.log('Configuring edge-to-edge for Android 15+ (SDK 35+)');
        // Additional Android 15+ specific configurations
      }
    }
  }, []);

  useEffect(() => {
    const { width, height } = windowDimensions;
    const aspectRatio = width / height;
    const isLandscape = width > height;
    
    // Determine screen size based on dp (density-independent pixels)
    const smallestWidth = Math.min(width, height);
    let screenSize: 'small' | 'medium' | 'large' | 'xlarge' = 'small';
    
    if (smallestWidth >= 720) {
      screenSize = 'xlarge'; // Large tablets
    } else if (smallestWidth >= 600) {
      screenSize = 'large'; // Small tablets
    } else if (smallestWidth >= 480) {
      screenSize = 'medium'; // Large phones
    } else {
      screenSize = 'small'; // Regular phones
    }

    // Detect tablet (sw600dp+)
    const isTablet = smallestWidth >= 600;
    
    // Detect potential foldable (unusual aspect ratios or very wide screens)
    const isFoldable = aspectRatio > 2.1 || aspectRatio < 0.5 || width > 900;

    setScreenInfo({
      isTablet,
      isFoldable,
      isLandscape,
      screenSize,
      aspectRatio,
    });
  }, [windowDimensions]);

  return {
    insets,
    screenInfo,
    windowDimensions,
    
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
    },

    // Helper for responsive padding based on screen size
    getResponsivePadding: (base: number = 20) => {
      switch (screenInfo.screenSize) {
        case 'xlarge':
          return base * 2; // 40px for large tablets
        case 'large':
          return base * 1.5; // 30px for small tablets
        case 'medium':
          return base * 1.2; // 24px for large phones
        default:
          return base; // 20px for regular phones
      }
    },

    // Helper for responsive font sizes
    getResponsiveFontSize: (base: number) => {
      switch (screenInfo.screenSize) {
        case 'xlarge':
          return base * 1.3;
        case 'large':
          return base * 1.2;
        case 'medium':
          return base * 1.1;
        default:
          return base;
      }
    },

    // Helper for layout columns based on screen size
    getLayoutColumns: (defaultColumns: number = 2) => {
      if (screenInfo.isFoldable && screenInfo.isLandscape) {
        return Math.min(defaultColumns * 2, 4); // More columns for unfolded devices
      }
      
      switch (screenInfo.screenSize) {
        case 'xlarge':
          return Math.min(defaultColumns * 2, 4); // Up to 4 columns for large tablets
        case 'large':
          return Math.min(defaultColumns + 1, 3); // Up to 3 columns for small tablets
        case 'medium':
          return screenInfo.isLandscape ? defaultColumns + 1 : defaultColumns;
        default:
          return defaultColumns;
      }
    },

    // Helper for adaptive margins in landscape/foldable modes
    getAdaptiveMargins: () => {
      if (screenInfo.isFoldable || (screenInfo.isTablet && screenInfo.isLandscape)) {
        return {
          horizontal: Math.max(insets.left, insets.right, 40),
          vertical: Math.max(insets.top, insets.bottom, 20),
        };
      }
      
      return {
        horizontal: Math.max(insets.left, insets.right, 20),
        vertical: Math.max(insets.top, insets.bottom, 16),
      };
    }
  };
}