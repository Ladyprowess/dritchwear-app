import { useEffect, useState, useCallback, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, View, ActivityIndicator, StyleSheet, Text, Pressable } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

// Must be > AuthContext failsafe (8 s native, 20 s web) so the failsafe always
// unblocks loading before this timeout fires. This prevents the "taking longer"
// error screen from appearing on a normal slow-start or after idle.
// Web: redirect to welcome after 12s (Chrome Android app banners can delay init).
// Native: show error UI after 14s (AuthContext failsafe fires at 8s so this rarely triggers).
const SESSION_TIMEOUT_MS = Platform.OS === 'web' ? 2500 : 8000;

export default function IndexScreen() {
  const { user, profile, loading, isAdmin, isInitialized, profileLoaded } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const referralParam = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const normalizedReferralCode = referralParam ? String(referralParam).trim().toUpperCase() : '';

  const [timedOut, setTimedOut] = useState(false);

  // Refs so timeout closure always has current values
  const userRef = useRef(user);
  const isAdminRef = useRef(isAdmin);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

  // 1) Safety timeout: if auth restore hangs, show fallback UI
  useEffect(() => {
    if (isInitialized && !loading) {
      setTimedOut(false);
      return;
    }

    setTimedOut(false);
    const t = setTimeout(() => {
      if (Platform.OS === 'web') {
        // On web, silently navigate based on current auth state instead of showing error UI.
        // Chrome Android app banners can stall auth init for a long time.
        const currentUser = userRef.current;
        if (!currentUser) {
          router.replace('/(auth)/welcome');
        } else if (isAdminRef.current) {
          router.replace('/(admin)');
        } else {
          router.replace('/(customer)');
        }
      } else {
        setTimedOut(true);
      }
    }, SESSION_TIMEOUT_MS);

    return () => clearTimeout(t);
  }, [isInitialized, loading, router]);

  const goToWelcome = useCallback(() => {
    router.replace('/(auth)/welcome');
  }, [router]);

  const retry = useCallback(() => {
    // “Retry” by reloading this route.
    setTimedOut(false);
    router.replace('/'); // re-enter index screen
  }, [router]);

  // 2) Normal routing once auth is ready
  useEffect(() => {
    if (!isInitialized || loading) return;

    console.log('🧭 Navigation Logic:', {
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      isAdmin,
      profileLoaded,
    });

    if (!user) {
      if (normalizedReferralCode) {
        router.replace({
          pathname: '/(auth)/register',
          params: { ref: normalizedReferralCode },
        });
        return;
      }
      router.replace('/(auth)/welcome');
    } else if (isAdmin) {
      router.replace('/(admin)');
    } else {
      router.replace('/(customer)');
    }
  }, [user, profile, loading, isAdmin, isInitialized, profileLoaded, router, normalizedReferralCode]);

  // Loading UI
  if (!isInitialized || loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#5A2D82" />
        <Text style={styles.loadingText}>
          {!isInitialized ? 'Initializing...' : 'Loading...'}
        </Text>
        <Text style={styles.subText}>Restoring your session</Text>

        {/* Timeout fallback */}
        {timedOut && (
          <View style={styles.timeoutBox}>
            <Text style={styles.timeoutText}>
              This is taking longer than expected.
            </Text>

            <Pressable style={styles.primaryBtn} onPress={retry}>
              <Text style={styles.primaryBtnText}>Try Again</Text>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={goToWelcome}>
              <Text style={styles.secondaryBtnText}>Continue to Login</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // Rare fallback
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#5A2D82" />
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

  timeoutBox: {
    marginTop: 18,
    width: '100%',
    maxWidth: 320,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  timeoutText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryBtnText: {
    color: '#111827',
    fontFamily: 'Inter-SemiBold',
    fontSize: 14,
  },
});
