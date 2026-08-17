import { Platform, useWindowDimensions } from 'react-native';

// Shared desktop-breakpoint contract for web. Mirrors the thresholds already
// used by app/(customer)/_layout.tsx's header (760/1100) so every screen
// agrees on when "desktop" starts.
export function useDesktopLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 760;
  const isWideDesktop = Platform.OS === 'web' && width >= 1100;
  return { width, isDesktop, isWideDesktop };
}
