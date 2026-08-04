import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Shield, RotateCcw, Ruler, ChevronRight } from 'lucide-react-native';
import { styles } from '../styles';

const LEGAL_ITEMS = [
  { icon: FileText, title: 'Terms of Service', route: '/(customer)/terms' },
  { icon: Shield, title: 'Privacy Policy', route: '/(customer)/privacy' },
  { icon: RotateCcw, title: 'Returns & Exchanges', route: '/(customer)/returns' },
  { icon: Ruler, title: 'Size Guide', route: '/(customer)/size-guide' },
] as const;

export function LegalSection() {
  const router = useRouter();

  return (
    <View style={styles.menuContainer}>
      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.menuCard}>
        {LEGAL_ITEMS.map((item, index) => (
          <Pressable
            key={item.title}
            style={[styles.menuItem, index === LEGAL_ITEMS.length - 1 && styles.lastMenuItem]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <item.icon size={20} color="#6B7280" />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
              </View>
            </View>
            <ChevronRight size={16} color="#D1D5DB" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
