import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, ShoppingCart, Mail } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerForPushNotificationsAsync, removePushTokenFromDatabase, savePushTokenToDatabase } from '@/lib/pushNotifications';

const P = '#5A2D82';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [cartRemindersEnabled, setCartRemindersEnabled] = useState(true);
  const [cartEmailEnabled, setCartEmailEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user) return;
    if (Platform.OS === 'web') {
      void supabase.from('push_tokens').select('token').eq('user_id', user.id).eq('device_type', 'web').maybeSingle()
        .then(({ data }) => setPushEnabled(Boolean(data?.token)));
    } else {
      void supabase.from('push_tokens').select('token').eq('user_id', user.id).neq('device_type', 'web').maybeSingle()
        .then(({ data }) => setPushEnabled(Boolean(data?.token)));
    }
    void supabase.from('profiles').select('cart_reminders_enabled, cart_email_reminders_enabled').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setCartRemindersEnabled(data.cart_reminders_enabled !== false);
          setCartEmailEnabled(data.cart_email_reminders_enabled === true);
        }
      });
  }, [user]);

  const updateCartPreference = async (field: 'cart_reminders_enabled' | 'cart_email_reminders_enabled', enabled: boolean) => {
    if (!user || saving) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ [field]: enabled }).eq('id', user.id);
    setSaving(false);
    if (error) { setMessage('Could not save your reminder preference. Please try again.'); return; }
    if (field === 'cart_reminders_enabled') setCartRemindersEnabled(enabled);
    else setCartEmailEnabled(enabled);
    setMessage('Preference saved.');
  };

  const updatePushPreference = async (enabled: boolean) => {
    if (!user || saving) return;
    setSaving(true);
    setMessage('');
    try {
      if (enabled) {
        const token = await registerForPushNotificationsAsync();
        if (!token) throw new Error('Notification permission was not granted.');
        await savePushTokenToDatabase(user.id, token);
      } else {
        await removePushTokenFromDatabase(user.id);
      }

      setPushEnabled(enabled);

      // Turning notifications ON also switches on the notification categories, so
      // the user immediately gets order, payment and cart alerts - no hunting
      // through separate toggles.
      if (enabled) {
        await supabase.from('profiles').update({ cart_reminders_enabled: true }).eq('id', user.id);
        setCartRemindersEnabled(true);
      }

      setMessage(enabled
        ? 'Notifications are on. You will receive order, payment and cart alerts.'
        : 'Push notifications are off on this device.');
    } catch (error: any) {
      setMessage(error?.message || 'Could not update notification preference.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ArrowLeft size={20} color={P} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Choose how Dritchwear keeps you in the loop. You can change these anytime.
        </Text>

        <PreferenceRow
          icon={<Bell size={20} color={P} />}
          title="Push notifications"
          description="Delivery updates, payment alerts and important account messages."
          value={pushEnabled}
          disabled={saving}
          onValueChange={updatePushPreference}
        />

        <PreferenceRow
          icon={<ShoppingCart size={20} color={P} />}
          title="Saved-cart reminders"
          description="Remind me when products are still waiting in my cart."
          value={cartRemindersEnabled}
          disabled={saving}
          onValueChange={(value) => void updateCartPreference('cart_reminders_enabled', value)}
        />

        <PreferenceRow
          icon={<Mail size={20} color={P} />}
          title="Cart reminder emails"
          description="Email me a link back to my saved cart. Off by default."
          value={cartEmailEnabled}
          disabled={saving || !cartRemindersEnabled}
          onValueChange={(value) => void updateCartPreference('cart_email_reminders_enabled', value)}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>Not getting notifications?</Text>
          <Text style={styles.hintText}>
            If push notifications stay off after turning them on here, allow notifications for Dritchwear in your device or
            browser settings, then toggle it on again.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  value,
  disabled,
  onValueChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.copy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#D1D5DB', true: '#B99AD5' }}
        thumbColor={value ? P : '#FFFFFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E3EB',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3EFF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scrollView: { flex: 1 },
  intro: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E3EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3EFF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  cardDescription: { marginTop: 4, fontSize: 12, lineHeight: 17, fontFamily: 'Inter-Regular', color: '#6B7280' },
  message: {
    marginHorizontal: 20,
    marginTop: 4,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: P,
  },
  hintCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3EFF7',
    borderWidth: 1,
    borderColor: '#E8E3EB',
  },
  hintTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginBottom: 6 },
  hintText: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter-Regular', color: '#6B7280' },
});
