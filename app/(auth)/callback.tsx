import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();

  useEffect(() => {
    const getHashParams = (url: string) => {
      const hash = url.split('#')[1];
      if (!hash) return {} as Record<string, string>;
      return Object.fromEntries(new URLSearchParams(hash));
    };

    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);

      // 🔹 CASE 1 - PKCE confirmation link
      const code = parsed.queryParams?.code as string | undefined;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error && data.session) {
          router.replace('/(auth)/confirm-email?confirmed=1');
          return;
        }

        router.replace('/(auth)/login');
        return;
      }

      // 🔹 CASE 2 - Token confirmation link
      const hashParams = getHashParams(url);
      const access_token = hashParams.access_token;
      const refresh_token = hashParams.refresh_token;

      if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (!error && data.session) {
          router.replace('/(auth)/confirm-email?confirmed=1');
          return;
        }

        router.replace('/(auth)/login');
        return;
      }

      // 🔹 CASE 3 - NOT a confirmation link (normal open)
      router.replace('/(auth)/login');
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
      else router.replace('/(auth)/login');
    });

    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Confirming your email…</Text>
    </View>
  );
}