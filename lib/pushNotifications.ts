// 📁 lib/pushNotifications.ts
import { Platform } from 'react-native';
import { supabase } from './supabase';

const isWeb = Platform.OS === 'web';
const WEB_PUSH_VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY;

// Dummy subscription shape so cleanup never crashes
const DUMMY_SUB = { remove() {} };

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function registerForWebPushNotificationsAsync(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const INSTALL_HINT = 'Add Dritchwear to your home screen and open it like an app to turn on notifications and enjoy the full experience.';
  if (!('Notification' in window)) throw new Error(INSTALL_HINT);
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error(INSTALL_HINT);
  }
  if (!WEB_PUSH_VAPID_PUBLIC_KEY) {
    throw new Error('Web push is not configured yet.');
  }

  const permission = await window.Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed. You can enable them later in browser settings.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(WEB_PUSH_VAPID_PUBLIC_KEY),
  });

  return JSON.stringify(subscription.toJSON());
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isWeb) return registerForWebPushNotificationsAsync();

  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');
    const { default: Constants } = await import('expo-constants');

    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#5A2D82',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push notification permissions');
      return null;
    }

    const projectId =
      Constants.easConfig?.projectId ||
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      'a4790542-c5a5-49ed-9721-562bb575964d';

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (error) {
    console.log('🔕 Push token fetch failed (non-blocking):', error);
    return null;
  }
}

export async function savePushTokenToDatabase(userId: string, token: string): Promise<void> {
  try {
    console.log('🧾 saving token for userId:', userId);

    const deviceType = isWeb ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';

    const { error } = await supabase.from('push_tokens').upsert(
      { user_id: userId, token, device_type: deviceType },
      { onConflict: 'user_id,device_type' }
    );

    if (error) {
      console.error('Error saving push token to database:', error);
    } else {
      console.log('✅ Push token saved or updated successfully');
    }
  } catch (error) {
    console.error('Error in savePushTokenToDatabase:', error);
  }
}

export async function removePushTokenFromDatabase(userId: string): Promise<void> {
  try {
    const deviceType = isWeb ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android';
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('device_type', deviceType);
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

export function setupNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationResponse?: (response: any) => void
): { notificationListener: any; responseListener: any } {
  if (isWeb) {
    return { notificationListener: DUMMY_SUB, responseListener: DUMMY_SUB };
  }

  try {
    // Synchronous require is safe here - we already checked !isWeb above
    // and this function is only called after the app has fully booted on native.
    const Notifications = require('expo-notifications');

    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        console.log('📱 Notification received:', notification.request.content.title);
        onNotificationReceived?.(notification);
      }
    );

    const responseListener = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        console.log('📱 Notification response received');
        onNotificationResponse?.(response);
      }
    );

    return { notificationListener, responseListener };
  } catch (e) {
    console.log('🔕 Failed to set up notification listeners (non-blocking):', e);
    return { notificationListener: DUMMY_SUB, responseListener: DUMMY_SUB };
  }
}

export function cleanupNotificationListeners(listeners: {
  notificationListener: any;
  responseListener: any;
}): void {
  try {
    listeners?.notificationListener?.remove?.();
    listeners?.responseListener?.remove?.();
  } catch (e) {
    console.log('cleanupNotificationListeners failed (non-blocking):', e);
  }
}
