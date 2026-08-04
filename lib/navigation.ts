import type { Router } from 'expo-router';

export function smartBack(router: Router, fallbackPath: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  // No back history (Tabs issue) → go to safe screen
  router.replace(fallbackPath);
}
