import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, useWindowDimensions } from "react-native";
import { useEffect, useState } from "react";

interface ScreenInfo {
  isTablet: boolean;
  isFoldable: boolean;
  isLandscape: boolean;
  screenSize: "small" | "medium" | "large" | "xlarge";
  aspectRatio: number;
}

export function useEdgeToEdge() {
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();

  const [screenInfo, setScreenInfo] = useState<ScreenInfo>({
    isTablet: false,
    isFoldable: false,
    isLandscape: false,
    screenSize: "small",
    aspectRatio: 1,
  });

  useEffect(() => {
    const { width, height } = windowDimensions;
    const aspectRatio = width / height;
    const isLandscape = width > height;

    const smallestWidth = Math.min(width, height);
    let screenSize: "small" | "medium" | "large" | "xlarge" = "small";

    if (smallestWidth >= 720) screenSize = "xlarge";
    else if (smallestWidth >= 600) screenSize = "large";
    else if (smallestWidth >= 480) screenSize = "medium";

    const isTablet = smallestWidth >= 600;
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

    getSafePadding: (
      area: "top" | "bottom" | "left" | "right" | "horizontal" | "vertical"
    ) => {
      switch (area) {
        case "top":
          return insets.top;
        case "bottom":
          return insets.bottom;
        case "left":
          return insets.left;
        case "right":
          return insets.right;
        case "horizontal":
          return Math.max(insets.left, insets.right);
        case "vertical":
          return Math.max(insets.top, insets.bottom);
        default:
          return 0;
      }
    },

    getResponsivePadding: (base: number = 20) => {
      switch (screenInfo.screenSize) {
        case "xlarge":
          return base * 2;
        case "large":
          return base * 1.5;
        case "medium":
          return base * 1.2;
        default:
          return base;
      }
    },

    getResponsiveFontSize: (base: number) => {
      switch (screenInfo.screenSize) {
        case "xlarge":
          return base * 1.3;
        case "large":
          return base * 1.2;
        case "medium":
          return base * 1.1;
        default:
          return base;
      }
    },

    getLayoutColumns: (defaultColumns: number = 2) => {
      if (screenInfo.isFoldable && screenInfo.isLandscape) {
        return Math.min(defaultColumns * 2, 4);
      }

      switch (screenInfo.screenSize) {
        case "xlarge":
          return Math.min(defaultColumns * 2, 4);
        case "large":
          return Math.min(defaultColumns + 1, 3);
        case "medium":
          return screenInfo.isLandscape ? defaultColumns + 1 : defaultColumns;
        default:
          return defaultColumns;
      }
    },

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
    },
  };
}
