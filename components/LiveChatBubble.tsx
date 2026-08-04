import React from 'react';
import { Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';

// Floating "message us" button shown across the customer app. Tapping it opens
// the existing Messaging page (conversations + FAQs + contact).
export default function LiveChatBubble() {
  const router = useRouter();
  const pathname = usePathname();

  // Hide on the messaging page itself and on focused flows where it would get in the way.
  if (pathname?.includes('help-support') || pathname?.includes('checkout')) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Message support"
      style={styles.bubble}
      onPress={() => router.push('/(customer)/help-support' as any)}
    >
      <MessageCircle size={26} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    right: 18,
    bottom: Platform.OS === 'web' ? 24 : 96,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5A2D82',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 900,
  },
});
