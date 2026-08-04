import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Sparkles,
  Image as ImageIcon,
  Tag,
  Ticket,
  TrendingUp,
  MessageCircle,
  Bell,
  Mail,
  ShoppingCart,
  Gift,
  Store,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react-native';

type NavItem = {
  label: string;
  route: string;
  segment: string | null; // last route segment; null = index
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  badge?: number;
};

type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', route: '/(admin)', segment: null, Icon: LayoutDashboard },
      { label: 'Orders', route: '/(admin)/orders', segment: 'orders', Icon: ShoppingBag },
      { label: 'Products', route: '/(admin)/products', segment: 'products', Icon: Package },
      { label: 'Customers', route: '/(admin)/users', segment: 'users', Icon: Users },
    ],
  },
  {
    title: 'Merchandising',
    items: [
      { label: 'Looks', route: '/(admin)/outfits', segment: 'outfits', Icon: Sparkles },
      { label: 'Category Images', route: '/(admin)/category-images', segment: 'category-images', Icon: ImageIcon },
      { label: 'Special Offers', route: '/(admin)/special-offers', segment: 'special-offers', Icon: Tag },
      { label: 'Discounts', route: '/(admin)/promo-codes', segment: 'promo-codes', Icon: Ticket },
    ],
  },
  {
    title: 'Growth',
    items: [
      { label: 'Messaging', route: '/(admin)/help-support', segment: 'help-support', Icon: MessageCircle },
      { label: 'Analytics', route: '/(admin)/analytics', segment: 'analytics', Icon: TrendingUp },
      { label: 'Notifications', route: '/(admin)/notifications', segment: 'notifications', Icon: Bell },
      { label: 'Email', route: '/(admin)/email', segment: 'email', Icon: Mail },
      { label: 'Cart Recovery', route: '/(admin)/cart-reminders', segment: 'cart-reminders', Icon: ShoppingCart },
      { label: 'Rewards', route: '/(admin)/rewards', segment: 'rewards', Icon: Gift },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { label: 'Store & Delivery', route: '/(admin)/store-settings', segment: 'store-settings', Icon: Store },
      { label: 'Settings', route: '/(admin)/settings', segment: 'settings', Icon: SettingsIcon },
    ],
  },
];

interface Props {
  unreadOrders?: number;
  unreadChats?: number;
  adminEmail?: string;
  onOrdersPress?: () => void;
  onMessagesPress?: () => void;
  onSignOut?: () => void;
}

export default function AdminSidebar({ unreadOrders = 0, unreadChats = 0, adminEmail, onOrdersPress, onMessagesPress, onSignOut }: Props) {
  const router = useRouter();
  const segments = useSegments() as string[];
  // The active route segment is the last segment that is not a group like "(admin)".
  const last = [...segments].reverse().find((s) => !s.startsWith('(')) ?? null;
  const activeSegment = last === 'index' ? null : last;

  const go = (item: NavItem) => {
    if (item.segment === 'orders') onOrdersPress?.();
    if (item.segment === 'help-support') onMessagesPress?.();
    router.push(item.route as any);
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>D</Text></View>
        <View>
          <Text style={styles.brandName}>Dritchwear</Text>
          <Text style={styles.brandMeta}>ADMIN CONSOLE</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
            {group.items.map((item) => {
              const active = item.segment === activeSegment;
              const badge = item.segment === 'orders' ? unreadOrders : item.segment === 'help-support' ? unreadChats : 0;
              const color = active ? '#5A2D82' : '#6B6472';
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => go(item)}
                  style={({ hovered }: any) => [
                    styles.item,
                    hovered && !active && styles.itemHover,
                    active && styles.itemActive,
                  ]}
                >
                  {active && <View style={styles.activeBar} />}
                  <item.Icon size={19} color={color} />
                  <Text style={[styles.itemLabel, active && styles.itemLabelActive]} numberOfLines={1}>{item.label}</Text>
                  {badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerAvatar}><Text style={styles.footerAvatarText}>{(adminEmail?.[0] || 'A').toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.footerName} numberOfLines={1}>Admin</Text>
          <Text style={styles.footerEmail} numberOfLines={1}>{adminEmail || 'Signed in'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sign out" onPress={onSignOut} style={styles.signOut} hitSlop={8}>
          <LogOut size={17} color="#B42318" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 260,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E8E3EB',
    ...(Platform.OS === 'web' ? { position: 'sticky' as any, top: 0 } : {}),
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 18 },
  brandMark: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#5A2D82', alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 19 },
  brandName: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 16 },
  brandMeta: { color: '#9A93A1', fontFamily: 'Inter-Bold', fontSize: 9, letterSpacing: 1.3, marginTop: 2 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingBottom: 12 },
  group: { marginTop: 14 },
  groupTitle: { color: '#A39BAA', fontFamily: 'Inter-Bold', fontSize: 10, letterSpacing: 1, marginLeft: 12, marginBottom: 6 },

  item: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 42, paddingHorizontal: 12, borderRadius: 10, marginBottom: 2 },
  itemHover: { backgroundColor: '#F6F3F9' },
  itemActive: { backgroundColor: '#F3EEF8' },
  activeBar: { position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, backgroundColor: '#5A2D82' },
  itemLabel: { flex: 1, color: '#4A4451', fontFamily: 'Inter-Medium', fontSize: 13.5 },
  itemLabelActive: { color: '#5A2D82', fontFamily: 'Inter-SemiBold' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#B42318', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 11 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#EEEAF1' },
  footerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EFE7F6', alignItems: 'center', justifyContent: 'center' },
  footerAvatarText: { color: '#5A2D82', fontFamily: 'Inter-Bold', fontSize: 14 },
  footerName: { color: '#17131C', fontFamily: 'Inter-SemiBold', fontSize: 13 },
  footerEmail: { color: '#8B8391', fontFamily: 'Inter-Regular', fontSize: 11 },
  signOut: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center' },
});
