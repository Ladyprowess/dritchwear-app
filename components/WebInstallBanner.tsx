/**
 * WebInstallBanner - shown only when the app is accessed via a browser (not installed).
 *
 * Android Chrome / Samsung Browser:
 *   Listens for `beforeinstallprompt` (PWA install). If that fires, shows a
 *   custom banner that triggers the native install sheet. If it never fires
 *   (APK already covers the install), shows a Play Store banner as fallback.
 *
 * iOS Safari:
 *   No automatic install prompt on iOS. Shows step-by-step "Add to Home Screen"
 *   instructions using the Share sheet.
 *
 * Already installed (standalone mode):
 *   Never shows - detected via CSS display-mode + navigator.standalone.
 *
 * Dismissed:
 *   Stored in localStorage; won't show again for 30 days.
 *
 * Desktop:
 *   Never shows.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { X, Download, Share, MoreVertical, Play } from 'lucide-react-native';

const BRAND_PURPLE = '#5A2D82';
const DISMISSED_KEY = 'dritchwear:pwa-install-dismissed-at';
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dritchwear.app';

type BannerMode = 'android-play' | 'android-pwa' | 'android-manual' | 'ios' | null;

function isStandalone(): boolean {
  try {
    if ((window.navigator as any).standalone === true) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {}
  return false;
}

function isInstallBannerDevice(): boolean {
  try {
    const ua = window.navigator.userAgent || '';
    const isIPadOS = /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || isIPadOS;
    const isAndroid = /android/i.test(ua);

    if (isIOS || isAndroid) return true;

    const hasTouch =
      window.navigator.maxTouchPoints > 1 ||
      window.matchMedia('(pointer: coarse)').matches;
    const tabletSizedViewport = Math.max(window.innerWidth, window.innerHeight) <= 1366;

    return hasTouch && tabletSizedViewport;
  } catch {
    return false;
  }
}

export default function WebInstallBanner() {
  if (Platform.OS !== 'web') return null;
  return <Inner />;
}

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_KEY) || 0);
    return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {}
}

function Inner() {
  const [mode, setMode]       = useState<BannerMode>(null);
  const [visible, setVisible] = useState(false);
  const [showGuide, setShowGuide] = useState(false); // iOS "watch how" video overlay
  const slideAnim             = useRef(new Animated.Value(-180)).current; // starts above screen
  const deferredPrompt        = useRef<any>(null);
  const hasShown              = useRef(false);
  const adminPwa = typeof document !== 'undefined' &&
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href.includes('admin-manifest');

  const showBanner = useCallback((m: BannerMode) => {
    // Intentionally NOT gated by wasRecentlyDismissed(): the prompt should show
    // on every page reload until the user actually installs the app. Still
    // skipped when already installed (standalone) and once per page load.
    if (!m || hasShown.current || isStandalone()) return;
    hasShown.current = true;
    setMode(m);
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    if (isStandalone()) return;   // already installed as PWA / native app
    if (!isInstallBannerDevice()) return; // desktop/laptop browsers - no banner

    const ua        = window.navigator.userAgent || '';
    const isIOS     = /iphone|ipad|ipod/i.test(ua);
    const isSafari  = /^((?!chrome|android).)*safari/i.test(ua);
    const isAndroid = /android/i.test(ua);

    if (isIOS && isSafari) {
      // Delay slightly so the page has a moment to settle before the banner pops up
      const t = setTimeout(() => showBanner('ios'), 2000);
      return () => clearTimeout(t);
    }

    if (isAndroid) {
      // The customer app ships as a native Android app on the Play Store, which
      // gives real push notifications and the full experience - so send Android
      // browser users there instead of the PWA. The admin console has no Play
      // Store app, so it keeps the PWA install path below.
      if (!adminPwa) {
        const t = setTimeout(() => showBanner('android-play'), 2000);
        return () => clearTimeout(t);
      }

      // Admin PWA: intercept Chrome's PWA install prompt
      const onBeforeInstall = (e: Event) => {
        e.preventDefault();
        deferredPrompt.current = e;
        if (!hasShown.current) showBanner('android-pwa');
      };
      window.addEventListener('beforeinstallprompt', onBeforeInstall as any);

      const onInstalled = () => {
        rememberDismissal();
        setVisible(false);
        deferredPrompt.current = null;
      };
      window.addEventListener('appinstalled', onInstalled);

      // Some Android browsers withhold beforeinstallprompt even for installable
      // PWAs. Provide the browser-menu path instead of advertising the native app.
      const fallbackTimer = setTimeout(() => {
        if (!deferredPrompt.current) {
          showBanner('android-manual');
        }
      }, 5000);

      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall as any);
        window.removeEventListener('appinstalled', onInstalled);
        clearTimeout(fallbackTimer);
      };
    }
  }, [showBanner, adminPwa]);

  function openPlayStore() {
    try { window.open(PLAY_STORE_URL, '_blank', 'noopener'); } catch {}
    dismiss();
  }

  function dismiss() {
    rememberDismissal();
    Animated.timing(slideAnim, {
      toValue: -180,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  }

  async function handleInstallPWA() {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    deferredPrompt.current = null;
    dismiss();
  }

  if (!visible || !mode) return null;

  return (
    <>
    {showGuide && (
      <View style={s.guideOverlay}>
        <Pressable style={s.guideBackdrop} onPress={() => setShowGuide(false)} />
        <View style={s.guideCard}>
          <Text style={s.guideTitle}>Add Dritchwear to your Home Screen</Text>
          <Text style={s.guideSub}>Follow along - it takes about 20 seconds.</Text>
          {/* @ts-ignore - video is a valid DOM element on web */}
          <video
            src="/v.mp4"
            controls
            autoPlay
            muted
            playsInline
            style={{ width: '100%', maxHeight: '70vh', borderRadius: 14, background: '#000', objectFit: 'contain' }}
          />
          <Pressable onPress={() => setShowGuide(false)} style={s.guideDoneBtn}>
            <Text style={s.guideDoneText}>Done</Text>
          </Pressable>
        </View>
      </View>
    )}
    <Animated.View
      style={[s.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents="box-none"
    >
      <View style={s.banner}>
        {/* App icon + title + close */}
        <View style={s.row}>
          <View style={s.iconWrap}>
            {/* @ts-ignore - img is valid on web */}
            <img
              src="/apple-touch-icon.png"
              alt="Dritchwear"
              style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }}
            />
          </View>

          <View style={s.info}>
            <Text style={s.appName}>{adminPwa ? 'Dritchwear Admin' : 'Dritchwear'}</Text>
            <Text style={s.appDesc}>
              {mode === 'ios'
                ? 'Add to your home screen for quick access'
                : mode === 'android-play'
                ? 'Get the full app on Google Play'
                : 'Get the full app experience'}
            </Text>
          </View>

          <Pressable onPress={dismiss} style={s.closeBtn} hitSlop={8}>
            <X size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Android - native app on the Play Store (customer app) */}
        {mode === 'android-play' && (
          <View style={s.actionRow}>
            <Pressable style={s.installBtn} onPress={openPlayStore}>
              <Play size={15} color="#FFF" fill="#FFF" />
              <Text style={s.installBtnText}>Get it on Google Play</Text>
            </Pressable>
            <Pressable onPress={dismiss} style={s.laterBtn}>
              <Text style={s.laterText}>Not now</Text>
            </Pressable>
          </View>
        )}

        {/* Android - PWA install */}
        {mode === 'android-pwa' && (
          <View style={s.actionRow}>
            <Pressable style={s.installBtn} onPress={handleInstallPWA}>
              <Download size={15} color="#FFF" />
              <Text style={s.installBtnText}>Install App</Text>
            </Pressable>
            <Pressable onPress={dismiss} style={s.laterBtn}>
              <Text style={s.laterText}>Not now</Text>
            </Pressable>
          </View>
        )}

        {/* Android - manual browser installation fallback */}
        {mode === 'android-manual' && (
          <View style={s.manualSteps}>
            <View style={s.iosStep}>
              <MoreVertical size={16} color={BRAND_PURPLE} />
              <Text style={s.iosStepText}>Open your browser menu</Text>
            </View>
            <View style={s.iosStep}>
              <Download size={15} color={BRAND_PURPLE} />
              <Text style={s.iosStepText}>Tap <Text style={s.bold}>Install app</Text> or <Text style={s.bold}>Add to Home screen</Text></Text>
            </View>
            <Pressable onPress={dismiss} style={s.iosDoneBtn}>
              <Text style={s.iosDoneText}>Got it</Text>
            </Pressable>
          </View>
        )}

        {/* iOS - manual instructions */}
        {mode === 'ios' && (
          <View style={s.iosSteps}>
            <Text style={s.iosTitle}>Add to Home Screen:</Text>
            <View style={s.iosStep}>
              <Share size={14} color={BRAND_PURPLE} />
              <Text style={s.iosStepText}>
                Tap the <Text style={s.bold}>Share</Text> icon at the bottom of Safari
              </Text>
            </View>
            <View style={s.iosStep}>
              <Text style={s.iosBullet}>＋</Text>
              <Text style={s.iosStepText}>
                Tap <Text style={s.bold}>Add to Home Screen</Text>
              </Text>
            </View>
            <View style={s.iosActions}>
              <Pressable onPress={() => setShowGuide(true)} style={s.watchBtn}>
                <Play size={13} color={BRAND_PURPLE} fill={BRAND_PURPLE} />
                <Text style={s.watchText}>Watch how (20s)</Text>
              </Pressable>
              <Pressable onPress={dismiss} style={s.iosDoneBtn}>
                <Text style={s.iosDoneText}>Got it</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  banner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F3F0F8',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  info: { flex: 1 },
  appName: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#111827',
  },
  appDesc: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Android
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  installBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BRAND_PURPLE,
    paddingVertical: 12,
    borderRadius: 12,
  },
  installBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
  laterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  laterText: {
    color: '#6B7280',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  // iOS
  iosSteps: {
    marginTop: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  manualSteps: {
    marginTop: 14,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  iosTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 4,
  },
  iosStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iosBullet: {
    fontSize: 16,
    color: BRAND_PURPLE,
    fontFamily: 'Inter-Bold',
    lineHeight: 18,
  },
  iosStepText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 18,
  },
  bold: {
    fontFamily: 'Inter-SemiBold',
    color: '#111827',
  },
  iosActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4DCEE',
    backgroundColor: '#F6F2FB',
  },
  watchText: {
    color: BRAND_PURPLE,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  iosDoneBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 10,
  },
  iosDoneText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },

  // iOS "watch how" video overlay
  guideOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  guideBackdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,6,16,0.88)',
  },
  guideCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  guideTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: '#17131C',
    textAlign: 'center',
  },
  guideSub: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: -4,
  },
  guideDoneBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    marginTop: 2,
  },
  guideDoneText: {
    color: '#FFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
  },
});
