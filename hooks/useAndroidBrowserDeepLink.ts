import { useEffect } from 'react';
import { Platform } from 'react-native';

const ANDROID_PACKAGE_NAME = 'com.dritchwear.app';
const SESSION_KEY_PREFIX = 'android_browser_deep_link_attempt:';
const ATTEMPT_TTL_MS = 15_000;

function isStandalonePwa() {
  try {
    return (
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches
    );
  } catch {
    return false;
  }
}

function shouldAttemptRedirect() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (isStandalonePwa()) return false;

  const ua = window.navigator.userAgent || '';
  return /android/i.test(ua);
}

function canAttemptForCurrentPage() {
  try {
    const key = `${SESSION_KEY_PREFIX}${window.location.href}`;
    const lastAttempt = Number(window.sessionStorage.getItem(key) || '0');

    if (Date.now() - lastAttempt < ATTEMPT_TTL_MS) return false;

    window.sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function useAndroidBrowserDeepLink(
  pathname: string | null,
  queryParams?: Record<string, string | null | undefined>
) {
  useEffect(() => {
    if (!pathname || !shouldAttemptRedirect()) return;
    if (!canAttemptForCurrentPage()) return;

    const url = new URL(pathname, window.location.origin);
    Object.entries(queryParams ?? {}).forEach(([key, value]) => {
      if (!value) return;
      url.searchParams.set(key, value);
    });

    const intentPath = `${url.pathname.replace(/^\//, '')}${url.search}`;
    const intentUrl =
      `intent://${intentPath}` +
      `#Intent;scheme=dritchwear;package=${ANDROID_PACKAGE_NAME};` +
      `S.browser_fallback_url=${encodeURIComponent(url.toString())};end`;

    const redirect = window.setTimeout(() => {
      window.location.replace(intentUrl);
    }, 250);

    return () => window.clearTimeout(redirect);
  }, [pathname, queryParams]);
}
