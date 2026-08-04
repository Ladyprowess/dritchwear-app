import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, ChevronRight } from 'lucide-react-native';

const BRAND_PURPLE = '#5A2D82';

interface Props {
  /** Main line, e.g. "Having trouble placing your order?" */
  title: string;
  /** Optional supporting line. Defaults to a chat prompt. */
  subtitle?: string;
  /** Runs before navigating - e.g. close the product modal. */
  onBeforeNavigate?: () => void;
  style?: any;
}

// A small contextual "chat with us" prompt that opens the Messaging page.
export default function ChatHelpBanner({ title, subtitle = 'Chat with us, we reply fast', onBeforeNavigate, style }: Props) {
  const router = useRouter();
  const open = () => {
    onBeforeNavigate?.();
    router.push('/(customer)/help-support' as any);
  };
  return (
    <Pressable style={[styles.row, style]} onPress={open} accessibilityRole="button" accessibilityLabel={title}>
      <View style={styles.icon}><MessageCircle size={18} color={BRAND_PURPLE} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color="#B4ADBC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F6F2FB', borderRadius: 12, borderWidth: 1, borderColor: '#EADFF3', paddingVertical: 11, paddingHorizontal: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13.5, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  sub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7A7380', marginTop: 1 },
});
