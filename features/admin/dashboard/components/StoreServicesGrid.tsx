import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Star, Link, Zap, GitBranch, Gift } from 'lucide-react-native';
import type { DashboardStats, StatCard } from '../types';
import { styles } from '../styles';

interface StoreServicesGridProps {
  stats: DashboardStats;
  serviceCardWidth: number;
  onServicePress: (type: string, title: string) => void;
}

function StoreServicesGridBase({ stats, serviceCardWidth, onServicePress }: StoreServicesGridProps) {
  // Only the "supporting activity" services shown in this grid - the
  // headline users/orders/revenue/pending stats live in StatsHeader instead.
  const serviceCards: StatCard[] = [
    { type: 'points', title: 'Points Issued', value: stats.totalPointsIssued.toLocaleString(), icon: Star, accent: '#9A6700', tint: '#FFF6D8' },
    { type: 'paylinks', title: 'Pay Links', value: stats.paymentLinksGenerated.toLocaleString(), icon: Link, accent: '#5A2D82', tint: '#F3EFF7' },
    { type: 'bills', title: 'Bill Payments', value: stats.billPaymentsCount.toLocaleString(), icon: Zap, accent: '#5A2D82', tint: '#F3EFF7' },
    { type: 'referrals', title: 'Referrals', value: stats.referralsCount.toLocaleString(), icon: GitBranch, accent: '#5A2D82', tint: '#F3EFF7' },
    { type: 'giftcards', title: 'Gift Cards', value: stats.giftCardsCount.toLocaleString(), icon: Gift, accent: '#9A6700', tint: '#FFF6D8' },
  ];

  return (
    <>
      <View style={styles.servicesHeader}><Text style={styles.sectionTitle}>Store services</Text><Text style={styles.sectionHint}>Supporting activity</Text></View>
      <View style={styles.serviceGrid}>
        {serviceCards.map((card) => (
          <Pressable key={card.type} onPress={() => onServicePress(card.type, card.title)} style={[styles.serviceCard, { width: serviceCardWidth }]}>
            <View style={[styles.serviceIcon, { backgroundColor: card.tint }]}><card.icon size={17} color={card.accent} /></View>
            <View style={styles.serviceCopy}>
              <Text style={styles.serviceTitle}>{card.title}</Text>
              {card.type === 'giftcards' && <Text style={styles.statSubtitle}>{stats.giftCardsActive} active · {stats.giftCardsRedeemed} redeemed</Text>}
            </View>
            <Text style={styles.serviceValue}>{card.value}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}

export const StoreServicesGrid = React.memo(StoreServicesGridBase);
