import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Redirect, Tabs, useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, User, Bell, Search, ShoppingCart, Menu, X, Gift, Scissors, Heart, Sparkles, Shirt } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  AppState,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationOptInPrompt from '@/components/NotificationOptInPrompt';
import LiveChatBubble from '@/components/LiveChatBubble';


const BRAND   = { purple: '#5A2D82', gold: '#FDB813' };
const DRAWER_W = 270;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
type TabItem = { name: string; label: string; icon: (color: string, size: number) => React.ReactNode };

const TABS: TabItem[] = [
  { name: 'shop',          label: 'Products',       icon: (c, s) => <Search size={s} color={c} /> },
  { name: 'cart',          label: 'Cart',           icon: (c, s) => <ShoppingCart size={s} color={c} /> },
  { name: 'wishlist',      label: 'Wishlist',       icon: (c, s) => <Heart size={s} color={c} /> },
  { name: 'orders',        label: 'Orders',         icon: (c, s) => <ShoppingBag size={s} color={c} /> },
  { name: 'notifications', label: 'Notifications',  icon: (c, s) => <Bell size={s} color={c} /> },
  { name: 'profile',       label: 'Profile',        icon: (c, s) => <User size={s} color={c} /> },
];

// ---------------------------------------------------------------------------
// Persistent top header (hamburger + title + quick badges)
// ---------------------------------------------------------------------------
function AppHeader({
  navigation: _navigation,
  onMenuPress,
  unreadCount,
  user,
}: {
  navigation: any;
  onMenuPress: () => void;
  unreadCount: number;
  user: any;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { getTotalItems } = useCart();
  const cartCount = getTotalItems();
  const isDesktop = Platform.OS === 'web' && width >= 760;
  const isWideDesktop = Platform.OS === 'web' && width >= 1100;

  const navigate = (route: string, requiresAuth = false) => {
    if (requiresAuth && !user) {
      router.push('/(auth)/welcome');
      return;
    }
    router.push(`/(customer)/${route}` as any);
  };

  return (
    <View style={[styles.appHeader, isDesktop && styles.appHeaderDesktop, { paddingTop: isDesktop ? 8 : insets.top + 8 }]}> 
      {/* Hamburger */}
      {!isDesktop && (
        <Pressable accessibilityLabel="Open navigation" style={styles.headerMenuBtn} onPress={onMenuPress} hitSlop={8}>
          <Menu size={22} color={BRAND.purple} />
        </Pressable>
      )}

      {/* App name */}
      <Text style={styles.appTitle}>Dritchwear Collections</Text>

      {isDesktop && (
        <View style={styles.desktopNav}>
          <Pressable style={styles.desktopNavItem} onPress={() => navigate('shop')}><Search size={16} color="#17131C" /><Text style={styles.desktopNavText}>Shop</Text></Pressable>
          {isWideDesktop && <Pressable style={styles.desktopNavItem} onPress={() => navigate('custom-order', true)}><Scissors size={16} color="#17131C" /><Text style={styles.desktopNavText}>Custom Order</Text></Pressable>}
          <Pressable style={styles.desktopNavItem} onPress={() => navigate('gift-cards')}><Gift size={16} color="#17131C" /><Text style={styles.desktopNavText}>Gift Cards</Text></Pressable>
          <Pressable style={styles.desktopNavItem} onPress={() => navigate('orders', true)}><ShoppingBag size={16} color="#17131C" /><Text style={styles.desktopNavText}>Orders</Text></Pressable>
        </View>
      )}

      {/* Quick-access badges */}
      <View style={styles.headerRight}>
        <Pressable
          accessibilityLabel="Open wishlist"
          style={styles.headerIconBtn}
          onPress={() => router.push(user ? '/(customer)/wishlist' : '/(auth)/welcome')}
          hitSlop={8}
        >
          <Heart size={21} color={BRAND.purple} />
        </Pressable>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.push('/(customer)/cart')}
          hitSlop={8}
        >
          <ShoppingCart size={22} color={BRAND.purple} />
          {cartCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={styles.headerIconBtn}
          onPress={() => router.push(user ? '/(customer)/notifications' : '/(auth)/welcome')}
          hitSlop={8}
        >
          <Bell size={22} color={BRAND.purple} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Side drawer
// ---------------------------------------------------------------------------
function SideDrawer({
  slideAnim,
  overlayOpacity,
  onClose,
  unreadCount,
  user,
}: {
  slideAnim: Animated.Value;
  overlayOpacity: Animated.Value;
  onClose: () => void;
  unreadCount: number;
  user: any;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const insets   = useSafeAreaInsets();
  const { getTotalItems } = useCart();
  const cartCount = getTotalItems();
  const scaleAnims = useRef<Animated.Value[]>(TABS.map(() => new Animated.Value(1))).current;

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname.endsWith('/(customer)') || pathname === '/(customer)/index';
    return pathname.includes(`/(customer)/${name}`);
  };

  const navigate = (name: string) => {
    // Guests can only browse home - any other action requires login
    if (!user && !['shop', 'cart', 'gift-cards', 'size-guide', 'looks'].includes(name)) {
      onClose();
      setTimeout(() => router.push('/(auth)/welcome'), 160);
      return;
    }

    // bounce animation
    const i = TABS.findIndex(t => t.name === name);
    if (i >= 0) {
      Animated.sequence([
        Animated.spring(scaleAnims[i], { toValue: 0.88, useNativeDriver: true, speed: 60, bounciness: 0 }),
        Animated.spring(scaleAnims[i], { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 10 }),
      ]).start();
    }
    onClose();
    setTimeout(() => {
      router.push(`/(customer)/${name}` as any);
    }, 160);
  };

  const getBadge = (name: string) => {
    if (name === 'cart' && cartCount > 0) return cartCount;
    if (name === 'notifications' && unreadCount > 0) return unreadCount;
    return null;
  };

  return (
    <>
      {/* Dimmed overlay - tap to close */}
      <Animated.View
        pointerEvents="auto"
        style={[styles.drawerOverlay, { opacity: overlayOpacity }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { paddingTop: insets.top + 16, transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* Header row */}
        <View style={styles.drawerHead}>
          <Text style={styles.drawerBrand}>Dritchwear Collections</Text>
          <Pressable onPress={onClose} style={styles.drawerClose} hitSlop={8}>
            <X size={20} color="#5A2D82" />
          </Pressable>
        </View>

        <View style={styles.drawerDivider} />

        {/* Nav items */}
        <View style={styles.drawerNav}>
          {TABS.map((tab, i) => {
            const active = isActive(tab.name);
            const badge  = getBadge(tab.name);
            return (
              <Animated.View
                key={tab.name}
                style={{ transform: [{ scale: scaleAnims[i] }] }}
              >
                <Pressable
                  style={[styles.drawerItem, active && styles.drawerItemActive]}
                  onPress={() => navigate(tab.name)}
                >
                  <View style={[styles.drawerIconWrap, active && styles.drawerIconWrapActive]}>
                    {tab.icon(active ? '#FFF' : '#6B7280', 20)}
                    {badge != null && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.drawerLabel, active && styles.drawerLabelActive]}>
                    {tab.label}
                  </Text>
                  {active && <View style={styles.drawerActivePill} />}
                </Pressable>
              </Animated.View>
            );
          })}

          <Text style={styles.drawerSectionLabel}>ORDER SERVICES</Text>
          <Pressable style={styles.drawerServiceItem} onPress={() => navigate('looks')}>
            <Sparkles size={18} color={BRAND.purple} />
            <Text style={styles.drawerServiceText}>Style me · Shop the look</Text>
          </Pressable>
          <Pressable style={styles.drawerServiceItem} onPress={() => navigate('wardrobe')}>
            <Shirt size={18} color={BRAND.purple} />
            <Text style={styles.drawerServiceText}>My Wardrobe</Text>
          </Pressable>
          <Pressable style={styles.drawerServiceItem} onPress={() => navigate('custom-order')}>
            <Scissors size={18} color={BRAND.purple} />
            <Text style={styles.drawerServiceText}>Custom order</Text>
          </Pressable>
          <Pressable style={styles.drawerServiceItem} onPress={() => navigate('gift-cards')}>
            <Gift size={18} color={BRAND.purple} />
            <Text style={styles.drawerServiceText}>Gift cards</Text>
          </Pressable>
          <Pressable style={styles.drawerServiceItem} onPress={() => navigate('size-guide')}>
            <Text style={styles.drawerServiceGlyph}>Aa</Text>
            <Text style={styles.drawerServiceText}>Size guide</Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function CustomerLayout() {
  const { user, profile, loading, isInitialized, profileLoaded } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount]     = useState(0);
  const [showBanner,  setShowBanner]      = useState(false);
  const [drawerOpen,  setDrawerOpen]      = useState(false);
  const bannerTimerRef  = useRef<any>(null);
  const slideAnim       = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayOpacity  = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(slideAnim,      { toValue: 0, useNativeDriver: true, tension: 68, friction: 11 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.spring(slideAnim,      { toValue: -DRAWER_W, useNativeDriver: true, tension: 68, friction: 11 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(false));
  }, [slideAnim, overlayOpacity]);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const LAST_SEEN_KEY = `last_seen_notification_time_${user.id}`;
    let cancelled = false;

    const checkNotifications = async () => {
      await refreshUnreadCount();
      const { data: latest } = await supabase
        .from('notifications')
        .select('created_at')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(1);
      const latestCreatedAt = latest?.[0]?.created_at;
      if (!latestCreatedAt) return;
      const lastSeen = await AsyncStorage.getItem(LAST_SEEN_KEY);
      if (!lastSeen) { await AsyncStorage.setItem(LAST_SEEN_KEY, latestCreatedAt); return; }
      if (new Date(latestCreatedAt) > new Date(lastSeen)) {
        if (!cancelled) setShowBanner(true);
        await AsyncStorage.setItem(LAST_SEEN_KEY, latestCreatedAt);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => { if (!cancelled) setShowBanner(false); }, 6000);
      }
    };

    checkNotifications();

    const appStateSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshUnreadCount();
    });

    const realtimeChannel = supabase
      .channel(`notifications-all-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const n = payload.new as any;
          if (n.user_id && n.user_id !== user.id) return;
          if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
            try {
              new window.Notification(n.title || 'Dritchwear update', {
                body: n.message || 'You have a new notification.',
                icon: '/icons/icon-192.png',
                tag: n.id || undefined,
              });
            } catch {}
          }
          if (!cancelled) setShowBanner(true);
          if (!cancelled && (n.is_read === false || n.is_read == null)) setUnreadCount(p => p + 1);
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => { if (!cancelled) setShowBanner(false); }, 6000);
          await AsyncStorage.setItem(LAST_SEEN_KEY, n.created_at);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      appStateSub.remove();
      supabase.removeChannel(realtimeChannel);
    };
  }, [user?.id, refreshUnreadCount]);

  // Native: redirect to welcome on sign-out. Use useEffect + router.replace
  // (more reliable than <Redirect> inside a Tabs layout).
  useEffect(() => {
    if (!loading && !user && Platform.OS !== 'web') {
      router.replace('/(auth)/welcome');
    }
  }, [loading, user, router]);

  if (!isInitialized) return null;
  // Wait for the profile fetch to resolve before committing to the customer
  // UI - otherwise an admin briefly sees this screen (profile still null,
  // so the check below can't catch it yet) before getting redirected once
  // the profile loads. Guests (no user) skip this and render immediately.
  if (user && !profileLoaded) return null;
  if (profile?.role === 'admin') return <Redirect href="/(admin)" />;

  // Fallback: if native + no user and effect hasn't fired yet, show nothing
  if (Platform.OS !== 'web' && !user) {
    return null;
  }
  // Web mobile guests are allowed to view - individual actions will gate login

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: true,
          headerShadowVisible: false,
          header: (props: any) => (
            <AppHeader
              {...props}
              onMenuPress={openDrawer}
              unreadCount={unreadCount}
              user={user}
            />
          ),
        }}
        tabBar={() => null}
      >
        <Tabs.Screen name="index"         options={{ title: 'Home' }} />
        <Tabs.Screen name="shop"          options={{ title: 'Shop' }} />
        <Tabs.Screen name="cart"          options={{ title: 'Cart' }} />
        <Tabs.Screen name="orders"        options={{ title: 'Orders' }} />
        <Tabs.Screen name="notifications" options={{ title: 'Notifications' }}
          listeners={{ tabPress: () => refreshUnreadCount() }}
        />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="wishlist" options={{ title: 'Wishlist' }} />

        {/* Hidden screens - no header */}
        <Tabs.Screen name="checkout"       options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="fund-wallet"    options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="custom-order"   options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="wallet-history" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="help-support"   options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="bill-payment"   options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="pay-link"       options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="notification-settings" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="gift-cards"     options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="terms"          options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="privacy"        options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="returns"        options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="size-guide"     options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="looks"          options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="look/[id]"      options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="wardrobe"       options={{ href: null, headerShown: false }} />
      </Tabs>

      <LiveChatBubble />

      {/* Side drawer (rendered as overlay above everything) */}
      {drawerOpen && (
        <SideDrawer
          slideAnim={slideAnim}
          overlayOpacity={overlayOpacity}
          onClose={closeDrawer}
          unreadCount={unreadCount}
          user={user}
        />
      )}

      {/* Notification banner */}
      {showBanner && (
        <Pressable
          style={styles.bottomBanner}
          onPress={async () => {
            setShowBanner(false);
            await refreshUnreadCount();
            router.push('/(customer)/notifications');
          }}
        >
          <Bell size={16} color={BRAND.gold} />
          <Text style={styles.bannerText}>
            {unreadCount > 0
              ? `You have ${unreadCount} new notification${unreadCount > 1 ? 's' : ''}`
              : 'New notification'}
          </Text>
          <Text style={styles.bannerCta}>View</Text>
        </Pressable>
      )}

      <NotificationOptInPrompt userId={user?.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Persistent header ──────────────────────────────────────────────────────
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3EB',
  },
  appHeaderDesktop: {
    minHeight: 72,
    paddingHorizontal: 32,
    paddingBottom: 8,
  },
  headerMenuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3EFF7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E3EB',
  },
  appTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: BRAND.purple,
    letterSpacing: 0.3,
  },
  desktopNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  desktopNavItem: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  desktopNavText: {
    color: '#17131C',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3EFF7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E8E3EB',
    position: 'relative',
  },

  // ── Badge (shared) ─────────────────────────────────────────────────────────
  badge: {
    position: 'absolute',
    top: -5,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontFamily: 'Inter-Bold',
  },

  // ── Side drawer ────────────────────────────────────────────────────────────
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 100,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: '#FFFFFF',
    zIndex: 110,
    shadowColor: '#17131C',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 24,
    paddingHorizontal: 16,
  },
  drawerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  drawerBrand: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: BRAND.purple,
  },
  drawerClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3F0F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 18,
  },
  drawerNav: {
    gap: 4,
  },
  drawerSectionLabel: {
    color: '#7A7380',
    fontFamily: 'Inter-Bold',
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  drawerServiceItem: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  drawerServiceText: {
    color: '#374151',
    fontFamily: 'Inter-Medium',
    fontSize: 14,
  },
  drawerServiceGlyph: {
    width: 18,
    color: BRAND.purple,
    fontFamily: 'Inter-Bold',
    fontSize: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
    overflow: 'hidden',
  },
  drawerItemActive: {
    backgroundColor: '#F3F0F8',
  },
  drawerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  drawerIconWrapActive: {
    backgroundColor: BRAND.purple,
  },
  drawerLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#374151',
  },
  drawerLabelActive: {
    fontFamily: 'Inter-SemiBold',
    color: BRAND.purple,
  },
  drawerActivePill: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND.gold,
  },

  // ── Notification banner ───────────────────────────────────────────────────
  bottomBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 200,
    shadowColor: '#17131C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 50,
  },
  bannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  bannerCta: {
    color: BRAND.gold,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
});
