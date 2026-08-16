import { Redirect, Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChartBar as BarChart3, Package, Users, Bell, Settings, ShoppingBag, Mail } from 'lucide-react-native';
import { Platform, useWindowDimensions, View } from 'react-native';
import NotificationOptInPrompt from '@/components/NotificationOptInPrompt';
import AdminSidebar from '@/components/AdminSidebar';
import NewOrderToast from '@/features/admin/shell/components/NewOrderToast';
import NewChatToast from '@/features/admin/shell/components/NewChatToast';
import { useAdminOrderAlerts } from '@/features/admin/shell/hooks/useAdminOrderAlerts';
import { useAdminChatAlerts } from '@/features/admin/shell/hooks/useAdminChatAlerts';

export default function AdminLayout() {
  const { user, profile, isInitialized, hardSignOut } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  // On wide web we render a custom, designed sidebar (AdminSidebar) beside the
  // screen content and hide the built-in tab bar. Narrow web / native keep the
  // bottom tab bar.
  const sideNav = Platform.OS === 'web' && width >= 900;
  const { unreadOrders, liveAlert, markOrdersSeen } = useAdminOrderAlerts(profile?.role === 'admin');
  const { unreadChats, chatAlert, markChatsSeen } = useAdminChatAlerts(profile?.role === 'admin', user?.id);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const previousManifest = manifest?.href;
    const previousTitle = appleTitle?.content;
    if (manifest) manifest.href = '/admin-manifest.json';
    if (appleTitle) appleTitle.content = 'Dritchwear Admin';
    document.title = 'Dritchwear Admin';
    return () => {
      if (manifest && previousManifest) manifest.href = previousManifest;
      if (appleTitle && previousTitle) appleTitle.content = previousTitle;
    };
  }, []);

  if (!isInitialized) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (profile?.role !== 'admin') return <Redirect href="/(customer)" />;

  return (
    <View style={{ flex: 1, flexDirection: sideNav ? 'row' : 'column' }}>
      {sideNav && (
        <AdminSidebar
          unreadOrders={unreadOrders}
          unreadChats={unreadChats}
          adminEmail={profile?.email ?? user?.email ?? undefined}
          onOrdersPress={() => void markOrdersSeen()}
          onMessagesPress={() => markChatsSeen()}
          onSignOut={() => void hardSignOut()}
        />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
      <Tabs
        backBehavior="history"
        tabBar={sideNav ? () => null : undefined}
        screenOptions={{
          headerShown: false,
          tabBarPosition: 'bottom',
          tabBarActiveTintColor: '#5A2D82',
          tabBarInactiveTintColor: '#665F6C',
          tabBarStyle: sideNav ? { display: 'none' } : {
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#E8E3EB',
            paddingBottom: 8,
            paddingTop: 8,
            height: 80,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontFamily: 'Inter-SemiBold',
            marginTop: 4,
          },
        }}
      >

      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ size, color }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ size, color }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ size, color }) => <ShoppingBag size={size} color={color} />,
          tabBarBadge: unreadOrders > 0 ? (unreadOrders > 99 ? '99+' : unreadOrders) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#B42318', color: '#FFFFFF', fontFamily: 'Inter-Bold' },
        }}
        listeners={{ tabPress: () => void markOrdersSeen() }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ size, color }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ size, color }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ size, color }) => <Settings size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="cart-reminders" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="email"
        options={{
          title: 'Email',
          tabBarIcon: ({ size, color }) => <Mail size={size} color={color} />,
        }}
      />

      {/* Hidden screens - accessible via navigation but not shown in tabs */}
      <Tabs.Screen name="outfits"        options={{ href: null }} />
      <Tabs.Screen name="promo-codes"    options={{ href: null }} />
      <Tabs.Screen name="analytics"      options={{ href: null }} />
      <Tabs.Screen name="special-offers" options={{ href: null }} />
      <Tabs.Screen name="help-support"   options={{ href: null }} />
      <Tabs.Screen name="rewards"        options={{ href: null }} />
      <Tabs.Screen name="store-settings" options={{ href: null }} />
      <Tabs.Screen name="category-images" options={{ href: null }} />
      <Tabs.Screen name="portfolio"       options={{ href: null }} />
      </Tabs>
      </View>
      {liveAlert && (
        <NewOrderToast
          alert={liveAlert}
          onPress={async () => { await markOrdersSeen(); router.push('/(admin)/orders'); }}
        />
      )}
      {chatAlert && (
        <NewChatToast
          alert={chatAlert}
          onPress={() => { markChatsSeen(); router.push('/(admin)/help-support'); }}
        />
      )}
      <NotificationOptInPrompt userId={user?.id} mode="admin" />
    </View>
  );
}
