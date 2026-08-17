// 📁 app/_layout.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { logEvent } from '@/lib/analytics';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '@/lib/posthog';
import { initSessionReplay } from '@/lib/sessionReplay';

import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, Text, StyleSheet, ActivityIndicator, InteractionManager } from 'react-native';

import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  registerForPushNotificationsAsync,
  savePushTokenToDatabase,
  setupNotificationListeners,
  cleanupNotificationListeners,
} from '@/lib/pushNotifications';

import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { PointsProvider } from '@/contexts/PointsContext';

import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import WebInstallBanner from '@/components/WebInstallBanner';
import GlobalNoticeProvider from '@/components/GlobalNoticeProvider';
import { supabase } from '@/lib/supabase';

// ✅ keep splash until we say so
void SplashScreen.preventAutoHideAsync().catch(() => {});

const BRAND = {
  purple: '#5A2D82', // Dritchwear brand purple
  yellow: '#FDB813', // Dritchwear brand yellow
  softBg: '#F9FAFB',
};

// Give web/PWA cold starts more time before showing a timeout message.
// This MUST stay comfortably above the AuthContext failsafe (web 1800ms /
// native 4000ms) so a normal slow start is unblocked by the failsafe and
// routed away long before this "please refresh" message ever appears.
const getBootTimeoutMs = () => (Platform.OS === 'web' ? 7000 : 12000);
const POST_LOGOUT_REDIRECT_KEY = 'post_logout_redirect_to_welcome';
const PENDING_REFERRAL_CODE_KEY = 'pending_referral_code';

async function consumePostLogoutRedirectFlag() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const shouldRedirect = window.sessionStorage.getItem(POST_LOGOUT_REDIRECT_KEY) === '1';
      window.sessionStorage.removeItem(POST_LOGOUT_REDIRECT_KEY);
      return shouldRedirect;
    }

    const shouldRedirect = (await AsyncStorage.getItem(POST_LOGOUT_REDIRECT_KEY)) === '1';
    await AsyncStorage.removeItem(POST_LOGOUT_REDIRECT_KEY);
    return shouldRedirect;
  } catch {
    return false;
  }
}

function AuthBootOverlay({ mode }: { mode: 'loading' | 'timeout' }) {
  return (
    <View style={styles.bootOverlay}>
      {mode === 'timeout' ? (
        <>
          <Text style={styles.errorIcon}>⏳</Text>
          <Text style={styles.bootTitle}>Loading is taking too long</Text>
          <Text style={styles.bootMessage}>
            Please refresh the app.{'\n'}
            Close it completely and open it again.
          </Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={BRAND.purple} />
          <Text style={styles.loadingText}>Loading...</Text>
        </>
      )}
    </View>
  );
}

function PushNotificationSetup() {
  const { user, isInitialized, loading, isAdmin } = useAuth();
  const router = useRouter();

  

  const listenersRef = useRef<any>(null);
  const hasSetupRef = useRef(false);

   

  useEffect(() => {
    if (!isInitialized || loading) return;

    // signed out => cleanup
    if (!user?.id) {
      if (listenersRef.current) {
        cleanupNotificationListeners(listenersRef.current);
        listenersRef.current = null;
      }
      hasSetupRef.current = false;
      return;
    }

    if (hasSetupRef.current) return;

    if (Constants.appOwnership === 'expo') {
      console.log('ℹ️ Skipping push registration in Expo Go');
      return;
    }

    hasSetupRef.current = true;

    (async () => {
      try {
        const { data: savedToken } = await supabase
          .from('push_tokens')
          .select('token')
          .eq('user_id', user.id)
          .maybeSingle();

        if (savedToken?.token) {
          const token = await registerForPushNotificationsAsync();
          if (token && user?.id) await savePushTokenToDatabase(user.id, token);
        }

        const listeners = setupNotificationListeners(
          () => {
            try {
              router.setParams({ refresh: String(Date.now()) });
            } catch (e) {
              console.log('Could not set params:', e);
            }
          },
          (response) => {
            const data: any = response.notification.request.content.data || {};
            const type = String(data.type || '');

            try {
              if (type === 'chat') router.push(isAdmin ? '/(admin)/help-support' : '/(customer)/help-support');
              else if (type === 'order') router.push('/(customer)/orders');
              else if (type === 'promo') router.push('/(customer)/shop');
              else router.push('/(customer)/notifications');
            } catch (e) {
              console.log('Could not navigate:', e);
            }
          }
        );

        listenersRef.current = listeners;
      } catch (error) {
        console.error('Error setting up push notifications:', error);
        hasSetupRef.current = false;
      }
    })();

    return () => {
      if (listenersRef.current) {
        cleanupNotificationListeners(listenersRef.current);
        listenersRef.current = null;
      }
      hasSetupRef.current = false;
    };
  }, [user?.id, isInitialized, loading, router]);

  return null;
}

function RootLayoutContent() {
  const { user, isAdmin, isInitialized, loading, profileLoaded } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const didRouteRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const splashHiddenRef = useRef(false);

  // Show a timeout message during first boot, but allow automatic recovery
  // once auth finishes instead of permanently blocking navigation.
  const [showTimeout, setShowTimeout] = useState(false);

  const bootStartRef = useRef<number>(Date.now());
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Once the app finishes its first boot, never show the overlay again.
  // Prevents the boot overlay from blocking touches (sign-out, etc.) when
  // Supabase fires SIGNED_IN/TOKEN_REFRESHED on device wake from idle.
  const hasBootedOnce = useRef(false);

  // derive "booting" (no early return!)
  const booting = !isInitialized || loading;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    try {
      const referralParam = new URLSearchParams(window.location.search).get('ref');
      const referralCode = referralParam?.trim().toUpperCase();

      if (!referralCode) return;
      window.localStorage.setItem(PENDING_REFERRAL_CODE_KEY, referralCode);
    } catch (error) {
      console.log('Unable to store referral code:', error);
    }
  }, []);
    
  
  useEffect(() => {
    try {
      // GA4 recommended event
      logEvent('app_open', {});
      logEvent('debug_hello', { source: 'dritchwear' });
    } catch (e) {
      console.log('Analytics error:', e);
    }
  }, []);



  useEffect(() => {
    if (booting) return;
  
    const screen = !user?.id
      ? 'welcome'
      : isAdmin
      ? 'admin_home'
      : 'customer_home';
  
    try {
      // GA4 screen view event
      logEvent('screen_view', {
        screen_name: screen,
        screen_class: screen,
      });
    } catch (e) {
      console.log('Screen analytics error:', e);
    }
  }, [booting, user?.id, isAdmin]);

  // Start PWA session recording once (no-op on native - posthog-react-native
  // handles replay there via enableSessionReplay in lib/posthog.ts).
  useEffect(() => {
    initSessionReplay();
  }, []);

  const previousPathnameRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      posthog.screen(pathname, { previous_screen: previousPathnameRef.current ?? null })
      previousPathnameRef.current = pathname
    }
  }, [pathname]);


  const hideSplashSafely = () => {
    if (splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    void SplashScreen.hideAsync().catch(() => {});
  };

  const showBootTimeout = useCallback(() => {
    // Show overlay (loading/timeout) instead of a native red error.
    hideSplashSafely();
    setShowTimeout(true);
  }, []);

  // ✅ reset routing guard when user changes
  useEffect(() => {
    const current = user?.id ?? null;
    if (lastUserIdRef.current !== current) {
      lastUserIdRef.current = current;
      didRouteRef.current = false;
      splashHiddenRef.current = false;

      // reset timer baseline
      bootStartRef.current = Date.now();

      // Reset the timeout message when a new boot cycle starts for a different user.
      setShowTimeout(false);
    }
  }, [user?.id]);

  // ✅ cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
  }, []);

  // ✅ boot timeout: show Loading... immediately, then switch to Timeout after BOOT_TIMEOUT_MS
  useEffect(() => {
    if (!booting) {
      // Boot done => clear timer, hide the timeout message, and mark as booted.
      hasBootedOnce.current = true;
      setShowTimeout(false);
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      return;
    }

    // After initial boot, never re-trigger the overlay on subsequent booting cycles
    // (e.g. Supabase SIGNED_IN on device wake from idle temporarily sets profileLoaded=false)
    if (hasBootedOnce.current) return;

    // show Loading... overlay (hide splash so the overlay is visible)
    hideSplashSafely();

    // restart timeout timer
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    timeoutTimerRef.current = setTimeout(() => {
      // Still booting? Swap the loading indicator for a timeout message.
      if (!isInitialized || loading) {
        showBootTimeout();
      }
    }, getBootTimeoutMs());

    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
    };
  }, [booting, isInitialized, loading, profileLoaded, showBootTimeout, user?.id]);

  // Route as soon as boot finishes, even if a timeout message was shown earlier.
  useEffect(() => {
    if (booting) return;

    if (didRouteRef.current) return;
    didRouteRef.current = true;

    void (async () => {
      try {
        const currentPath = pathname || '/';
        const webPath = Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.pathname
          : currentPath;
        const isPublicStandaloneRoute =
          currentPath === '/pay' || currentPath.startsWith('/pay/') ||
          webPath === '/pay' || webPath.startsWith('/pay/') ||
          currentPath === '/corporate' || webPath === '/corporate' ||
          currentPath === '/portfolio' || webPath === '/portfolio' ||
          currentPath === '/b2b-pricing' || webPath === '/b2b-pricing';

        // Keep standalone public routes mounted instead of forcing them through
        // the app home redirect logic during global auth boot.
        if (isPublicStandaloneRoute) {
          InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                hideSplashSafely();
              });
            });
          });
          return;
        }

        if (!user?.id) {
          // If there's a referral code in the URL, send guest straight to register
          const refCode =
            Platform.OS === 'web' && typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('ref')
              : null;
          if (refCode) {
            router.replace({
              pathname: '/(auth)/register',
              params: { ref: refCode.trim().toUpperCase() },
            });
          } else {
            const shouldGoToWelcome = await consumePostLogoutRedirectFlag();
            router.replace(shouldGoToWelcome ? '/(auth)/welcome' : '/(customer)');
          }
        } else if (isAdmin) {
          router.replace('/(admin)');
        } else {
          router.replace('/(customer)');
        }

        InteractionManager.runAfterInteractions(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              hideSplashSafely();
            });
          });
        });
      } catch (e) {
        console.error('Navigation error:', e);
        showBootTimeout();
      }
    })();
  }, [booting, user?.id, isAdmin, pathname, router, showBootTimeout]);

  // Only show the overlay during the very first boot - never on resume/idle
  const showOverlay = !hasBootedOnce.current && (booting || showTimeout);

  return (
    <View style={{ flex: 1 }}>
      <PushNotificationSetup />

      {/*
        ✅ Always keep the Stack mounted so navigations are never lost.
        The boot overlay is absolutely positioned on top and covers everything
        while auth is initialising.
      */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(customer)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="pay/[token]" options={{ headerShown: false }} />
        <Stack.Screen name="corporate" options={{ headerShown: false }} />
        <Stack.Screen name="portfolio" options={{ headerShown: false }} />
        <Stack.Screen name="b2b-pricing" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Overlay sits on top - bootOverlay style uses position:absolute so it covers the Stack */}
      {showOverlay && <AuthBootOverlay mode={showTimeout ? 'timeout' : 'loading'} />}

      <StatusBar style="dark" translucent={false} hidden={false} />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        // Dynamic import so expo-navigation-bar is never loaded on web
        const NavigationBar = await import('expo-navigation-bar');
        await NavigationBar.setVisibilityAsync('visible');

        // ✅ Edge-to-edge: background colour isn't supported (avoids warnings)
        if (Platform.Version < 30) {
          await NavigationBar.setBackgroundColorAsync('#F9FAFB');
        }

        await NavigationBar.setButtonStyleAsync('dark');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    // If this page is already controlled by a service worker, a controllerchange
    // means a NEW worker just took over (e.g. we shipped an updated sw.js). Reload
    // once so the fresh app shell/bundle loads instead of a stale cached one - this
    // is what auto-recovers users stuck on a blank screen from an older SW.
    // Skipped on first-ever visit (no existing controller) to avoid a needless reload.
    if (navigator.serviceWorker.controller) {
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        // A new service worker can take over mid-session at any time (e.g.
        // right after a deploy). Reloading immediately used to blow away
        // whatever was on screen - including an open Paystack payment
        // overlay mid-checkout. Wait until no payment is in progress instead
        // of forcing it through a live payment attempt.
        const tryReload = () => {
          if ((window as any).__dritchwearPaymentActive) {
            setTimeout(tryReload, 2000);
            return;
          }
          refreshing = true;
          window.location.reload();
        };
        tryReload();
      });
    }

    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.log('Service worker registration failed:', error);
    });
  }, []);

  // Browsers can paint with a fallback immediately and swap Inter in when ready.
  // Native still waits because its text renderer requires the registered fonts.
  if (Platform.OS !== 'web' && !fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GlobalNoticeProvider>
        <PostHogProvider
          client={posthog}
          autocapture={{
            captureScreens: false,
            captureTouches: true,
            propsToCapture: ['testID'],
            maxElementsCaptured: 20,
          }}
        >
          <AuthProvider>
            <CartProvider>
              <PointsProvider>
                <RootLayoutContent />
              </PointsProvider>
            </CartProvider>
          </AuthProvider>

          {/* PWA install banner - web only, positioned absolutely over everything */}
          <WebInstallBanner />
        </PostHogProvider>
      </GlobalNoticeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BRAND.softBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  bootTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
  },
  bootMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    fontFamily: 'Inter-Medium',
  },
});
