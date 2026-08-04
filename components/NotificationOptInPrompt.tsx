import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { registerForPushNotificationsAsync, savePushTokenToDatabase } from '@/lib/pushNotifications';
import { supabase } from '@/lib/supabase';

const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export default function NotificationOptInPrompt({ userId, mode = 'customer' }: { userId?: string; mode?: 'customer' | 'admin' }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState('');

  const key = userId ? `notification_opt_in_prompt_${mode}_${userId}` : '';

  useEffect(() => {
    if (!userId || !key) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
            if (window.Notification.permission === 'granted') return;
          }
          const lastChoice = Number(await AsyncStorage.getItem(key) || 0);
          if (lastChoice && Date.now() - lastChoice < REMIND_AFTER_MS) return;
          if (active) setVisible(true);
        } catch {
          if (active) setVisible(true);
        }
      })();
    }, 900);
    return () => { active = false; clearTimeout(timer); };
  }, [key, userId]);

  const rememberChoice = async () => {
    if (key) await AsyncStorage.setItem(key, String(Date.now()));
  };

  const dismiss = async () => {
    await rememberChoice();
    setVisible(false);
  };

  const enable = async () => {
    if (!userId) return;
    setEnabling(true);
    setMessage('');
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) throw new Error('Notifications were not allowed. You can enable them later in settings.');
      await savePushTokenToDatabase(userId, token);
      // Turning notifications on here switches on every alert category too, so the
      // user doesn't have to visit settings to actually start receiving them.
      if (mode === 'customer') {
        await supabase.from('profiles').update({ cart_reminders_enabled: true }).eq('id', userId);
      }
      await rememberChoice();
      setVisible(false);
    } catch (error: any) {
      setMessage(error?.message || 'Could not enable notifications. Try again from Notifications settings.');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable accessibilityLabel="Not now" onPress={dismiss} style={styles.closeButton}>
            <X size={18} color="#665F6C" />
          </Pressable>
          <View style={styles.icon}><Bell size={25} color="#5A2D82" /></View>
          <Text style={styles.title}>{mode === 'admin' ? 'Get new-order alerts' : 'Stay updated on your orders'}</Text>
          <Text style={styles.copy}>
            {mode === 'admin' ? 'Turn on notifications so new orders and custom-order requests reach this device immediately.' : 'Turn on notifications for payment updates, order progress, delivery alerts and important promotions.'}
          </Text>
          {!!message && <Text accessibilityRole="alert" style={styles.error}>{message}</Text>}
          <Pressable disabled={enabling} onPress={enable} style={[styles.primary, enabling && styles.disabled]}>
            <Text style={styles.primaryText}>{enabling ? 'Enabling…' : 'Turn on notifications'}</Text>
          </Pressable>
          <Pressable onPress={dismiss} style={styles.secondary}>
            <Text style={styles.secondaryText}>Not now</Text>
          </Pressable>
          <Pressable onPress={() => { setVisible(false); router.push(mode === 'admin' ? '/(admin)/settings' : '/(customer)/notification-settings'); }} style={styles.settingsLink}>
            <Text style={styles.settingsText}>Open notification settings</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(23,19,28,0.56)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 430, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, alignItems: 'center' },
  closeButton: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3EFF7', alignItems: 'center', justifyContent: 'center' },
  icon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#F3EFF7', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 21, textAlign: 'center' },
  copy: { color: '#665F6C', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, marginBottom: 20 },
  error: { width: '100%', color: '#912018', backgroundColor: '#FEF3F2', borderRadius: 8, padding: 10, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  primary: { width: '100%', minHeight: 50, borderRadius: 10, backgroundColor: '#5A2D82', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  primaryText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  secondary: { width: '100%', minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { color: '#665F6C', fontFamily: 'Inter-SemiBold', fontSize: 13 },
  settingsLink: { minHeight: 40, justifyContent: 'center' },
  settingsText: { color: '#5A2D82', fontFamily: 'Inter-Medium', fontSize: 12 },
});
