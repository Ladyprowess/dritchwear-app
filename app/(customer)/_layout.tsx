import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs } from 'expo-router';
import { Home, ShoppingBag, User, Bell, Search } from 'lucide-react-native';

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