import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import type { AdminChatAlert } from '@/features/admin/shell/hooks/useAdminChatAlerts';

interface Props {
  alert: AdminChatAlert;
  onPress: () => void;
}

export default function NewChatToast({ alert, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open customer message"
      style={styles.toast}
      onPress={onPress}
    >
      <View style={styles.icon}><MessageCircle size={18} color="#FDB813" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{alert.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{alert.message}</Text>
      </View>
      <Text style={styles.cta}>Reply</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Sits above the order toast so both can show at once.
  toast: { position: 'absolute', right: 20, bottom: 110, width: 360, maxWidth: '90%', minHeight: 78, borderRadius: 14, backgroundColor: '#32154E', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  icon: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 14 },
  message: { color: 'rgba(255,255,255,0.76)', fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, marginTop: 3 },
  cta: { color: '#FDB813', fontFamily: 'Inter-Bold', fontSize: 12 },
});
