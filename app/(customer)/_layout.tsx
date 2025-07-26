import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs } from 'expo-router';
import { Home, ShoppingBag, User, Bell, Search, ShoppingCart } from 'lucide-react-native';
import { useCart } from '@/contexts/CartContext';
import { View, Text, StyleSheet } from 'react-native';

function CartTabIcon({ size, color }: { size: number; color: string }) {
  const { getTotalItems } = useCart();
  const itemCount = getTotalItems();

  return (
    <View style={styles.cartIconContainer}>
      <ShoppingCart size={size} color={color} />
      {itemCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>
            {itemCount > 99 ? '99+' : itemCount.toString()}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CustomerLayout() {
  const { user, profile, loading } = useAuth();

  if (loading) return null;

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profile?.role === 'admin') {
    return <Redirect href="/(admin)" />;
  }

  // Return the Tabs navigator directly for customer routes
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 8,
          paddingTop: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-Medium',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ size, color }) => (
            <Search size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ size, color }) => (
            <CartTabIcon size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ size, color }) => (
            <ShoppingBag size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ size, color }) => (
            <Bell size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      
      {/* Hidden screens - accessible via navigation but not shown in tabs */}
      <Tabs.Screen
        name="checkout"
        options={{
          href: null, // This hides the screen from tabs
        }}
      />
      <Tabs.Screen
        name="fund-wallet"
        options={{
          href: null, // This hides the screen from tabs
        }}
      />
      <Tabs.Screen
        name="custom-order"
        options={{
          href: null, // This hides the screen from tabs
        }}
      />
      <Tabs.Screen
        name="wallet-history"
        options={{
          href: null, // This hides the screen from tabs
        }}
      />
      <Tabs.Screen
        name="help-support"
        options={{
          href: null, // This hides the screen from tabs
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  cartIconContainer: {
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});