import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const { user, profile, loading, isAdmin, isInitialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only proceed with navigation once auth is fully initialized
    if (!isInitialized || loading) {
      return;
    }

    console.log('🧭 Navigation Logic:', {
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      isAdmin,
    });
    
    if (!user) {
      console.log('➡️ No user found, redirecting to welcome');
      router.replace('/(auth)/welcome');
    } else if (isAdmin) {
      console.log('➡️ Admin user detected, redirecting to admin dashboard');
      router.replace('/(admin)');
    } else {
      console.log('➡️ Regular user detected, redirecting to customer area');
      router.replace('/(customer)');
    }
  }, [user, profile, loading, isAdmin, isInitialized, router]);

  // Show loading screen while auth is initializing
  if (!isInitialized || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>
          {!isInitialized ? 'Initializing...' : 'Loading...'}
        </Text>
        <Text style={styles.subText}>
          Restoring your session
        </Text>
      </View>
    );
  }

  // This should rarely be seen as navigation should happen immediately
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7C3AED" />
      <Text style={styles.loadingText}>Redirecting...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'center',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});