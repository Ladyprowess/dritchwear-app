import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

const POST_LOGOUT_REDIRECT_KEY = 'post_logout_redirect_to_welcome';

async function markPostLogoutRedirect() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.sessionStorage.setItem(POST_LOGOUT_REDIRECT_KEY, '1');
      return;
    }

    await AsyncStorage.setItem(POST_LOGOUT_REDIRECT_KEY, '1');
  } catch {}
}

export function useSignOut(user: unknown, hardSignOut: () => Promise<void>) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const runSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      await markPostLogoutRedirect();
      await hardSignOut();
      router.replace('/(auth)/welcome');
    } catch (error) {
      console.error('Customer sign out failed:', error);
      Alert.alert('Sign Out Failed', 'Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const confirmAndSignOut = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to sign out?')) {
        void runSignOut();
      }
      return;
    }

    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            void runSignOut();
          },
        },
      ]
    );
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    confirmAndSignOut();
  };

  // Once the user is signed out, don't keep rendering the profile page.
  useEffect(() => {
    if (!user && !isSigningOut) {
      router.replace('/(auth)/welcome');
    }
  }, [isSigningOut, router, user]);

  return { isSigningOut, confirmAndSignOut, handleSignOut };
}
