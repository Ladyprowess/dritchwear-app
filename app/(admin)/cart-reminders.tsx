import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Save, ShoppingCart } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function CartReminderSettings() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [first, setFirst] = useState('1');
  const [second, setSecond] = useState('24');
  const [finalHours, setFinalHours] = useState('72');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void supabase.from('commerce_settings').select('*').eq('id', 'default').single().then(({ data, error }) => {
    if (error) { Alert.alert('Settings unavailable', 'Could not load cart reminder settings.'); return; }
    if (data) { setEnabled(data.cart_reminders_enabled); setFirst(String(data.first_reminder_hours)); setSecond(String(data.second_reminder_hours)); setFinalHours(String(data.final_reminder_hours)); }
  }); }, []);

  const save = async () => {
    const values = [Number(first), Number(second), Number(finalHours)];
    if (values.some(value => !Number.isInteger(value) || value < 1) || !(values[0] < values[1] && values[1] < values[2])) {
      Alert.alert('Check reminder timing', 'Use whole hours in increasing order, for example 1, 24 and 72.'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('commerce_settings').update({ cart_reminders_enabled: enabled, first_reminder_hours: values[0], second_reminder_hours: values[1], final_reminder_hours: values[2], updated_at: new Date().toISOString() }).eq('id', 'default');
    setSaving(false);
    Alert.alert(error ? 'Could not save settings' : 'Reminder schedule saved', error?.message || 'New and active carts will use this schedule.');
  };

  const field = (label: string, value: string, setter: (value: string) => void, hint: string) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={setter} keyboardType="number-pad" /><Text style={styles.hint}>{hint}</Text></View>;
  return <SafeAreaView style={styles.container}><View style={styles.header}><Pressable accessibilityLabel="Back" style={styles.iconButton} onPress={() => router.back()}><ArrowLeft size={20} color="#5A2D82" /></Pressable><View style={styles.headerCopy}><Text style={styles.title}>Cart recovery</Text><Text style={styles.subtitle}>Control respectful abandoned-cart reminders</Text></View></View><View style={styles.card}><View style={styles.toggleRow}><View style={styles.toggleCopy}><View style={styles.titleRow}><ShoppingCart size={18} color="#5A2D82" /><Text style={styles.cardTitle}>Automated reminders</Text></View><Text style={styles.hint}>Customers can opt out. Email remains off until each customer enables it.</Text></View><Switch value={enabled} onValueChange={setEnabled} /></View>{field('First reminder', first, setFirst, 'Hours after the customer last changes the cart.')}{field('Second reminder', second, setSecond, 'A follow-up for customers who have not returned.')}{field('Final reminder', finalHours, setFinalHours, 'The last message. No further reminders are sent.') }<Pressable style={[styles.saveButton, saving && styles.disabled]} disabled={saving} onPress={() => void save()}><Save size={17} color="#FFFFFF" /><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save schedule'}</Text></Pressable></View></SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#F9FAFB', padding: 20 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }, iconButton: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3EFF7', alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, title: { fontFamily: 'Inter-Bold', fontSize: 24, color: '#17131C' }, subtitle: { fontFamily: 'Inter-Regular', fontSize: 13, color: '#665F6C', marginTop: 3 }, card: { width: '100%', maxWidth: 720, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 22, borderWidth: 1, borderColor: '#E8E3EB' }, toggleRow: { flexDirection: 'row', gap: 18, alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#E8E3EB' }, toggleCopy: { flex: 1 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardTitle: { fontFamily: 'Inter-SemiBold', fontSize: 16, color: '#17131C' }, field: { marginTop: 20 }, label: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#17131C', marginBottom: 7 }, input: { width: '100%', minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: '#D8D2DC', paddingHorizontal: 14, fontFamily: 'Inter-Regular', fontSize: 15, color: '#17131C' }, hint: { fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, color: '#746D79', marginTop: 6 }, saveButton: { minHeight: 48, borderRadius: 9, backgroundColor: '#5A2D82', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 26 }, saveText: { fontFamily: 'Inter-SemiBold', fontSize: 14, color: '#FFFFFF' }, disabled: { opacity: 0.6 } });
