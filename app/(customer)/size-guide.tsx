import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { smartBack } from '@/lib/navigation';
import { ArrowLeft } from 'lucide-react-native';
import SizeGuideBody from '@/components/SizeGuideBody';

const P = '#5A2D82';

export default function SizeGuideScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Pressable onPress={() => smartBack(router, '/(customer)/shop')} style={s.backBtn} hitSlop={8}>
          <ArrowLeft size={20} color={P} />
        </Pressable>
        <Text style={s.headerTitle}>Size Guide</Text>
        <View style={{ width: 36 }} />
      </View>
      <SizeGuideBody />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
});
