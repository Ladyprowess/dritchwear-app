import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ShoppingBag } from 'lucide-react-native';
import type { AdminLiveAlert } from '@/features/admin/shell/hooks/useAdminOrderAlerts';

interface NewOrderToastProps {
  alert: AdminLiveAlert;
  onPress: () => void;
}

export default function NewOrderToast({ alert, onPress }: NewOrderToastProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open new order"
      style={styles.orderAlert}
      onPress={onPress}
    >
      <View style={styles.orderAlertIcon}><ShoppingBag size={18} color="#FDB813" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderAlertTitle}>{alert.title}</Text>
        <Text style={styles.orderAlertMessage} numberOfLines={2}>{alert.message}</Text>
      </View>
      <Text style={styles.orderAlertCta}>View</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  orderAlert: { position: 'absolute', right: 20, bottom: 22, width: 360, maxWidth: '90%', minHeight: 78, borderRadius: 14, backgroundColor: '#32154E', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  orderAlertIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  orderAlertTitle: { color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 14 },
  orderAlertMessage: { color: 'rgba(255,255,255,0.76)', fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 17, marginTop: 3 },
  orderAlertCta: { color: '#FDB813', fontFamily: 'Inter-Bold', fontSize: 12 },
});
