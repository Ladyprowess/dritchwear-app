import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Users, Gift } from 'lucide-react-native';
import { styles } from '../styles';

interface ServicesSectionProps {
  onInviteAndEarn: () => void;
  onGiftCards: () => void;
}

export function ServicesSection({ onInviteAndEarn, onGiftCards }: ServicesSectionProps) {
  return (
    <View style={styles.servicesContainer}>
      <Text style={styles.sectionTitle}>Services</Text>
      <View style={styles.servicesCard}>
        <Pressable style={styles.serviceItem} onPress={onInviteAndEarn}>
          <View style={styles.serviceItemLeft}>
            <View style={[styles.serviceIconWrap, { backgroundColor: '#DBEAFE' }]}>
              <Users size={20} color="#1D4ED8" />
            </View>
            <View style={styles.serviceTextWrap}>
              <Text style={styles.serviceTitle}>Invite and Earn</Text>
              <Text style={styles.serviceSubtitle}>Share your code and track rewards.</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.serviceDivider} />

        <Pressable style={styles.serviceItem} onPress={onGiftCards}>
          <View style={styles.serviceItemLeft}>
            <View style={[styles.serviceIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Gift size={20} color="#D97706" />
            </View>
            <View style={styles.serviceTextWrap}>
              <Text style={styles.serviceTitle}>Gift Cards</Text>
              <Text style={styles.serviceSubtitle}>Send or redeem a stylish Dritchwear gift.</Text>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
