import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Users, Star } from 'lucide-react-native';
import { styles } from '../styles';

function QuickActionsGridBase() {
  const router = useRouter();

  return (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <Pressable
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/products')}
        >
          <Package size={24} color="#5A2D82" />
          <Text style={styles.actionText}>Manage Products</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/users')}
        >
          <Users size={24} color="#10B981" />
          <Text style={styles.actionText}>View Users</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/rewards')}
        >
          <Star size={24} color="#F59E0B" />
          <Text style={styles.actionText}>Rewards, Referrals & Gifts</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const QuickActionsGrid = React.memo(QuickActionsGridBase);
