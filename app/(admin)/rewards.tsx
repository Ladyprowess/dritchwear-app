/**
 * Admin - Rewards & Bills Tracker
 *
 * Tracks:
 *  • Points transactions (earned / spent per user)
 *  • Pay-for-me payment links (generated, paid, expired)
 *  • VTpass bill payments (airtime & electricity)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, ActivityIndicator, Dimensions, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Star, Link, Zap, TrendingUp, Users, Gift, X } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import { pointsToNaira } from '@/lib/points';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 16 * 2 - 10) / 2;

type Tab = 'points' | 'paylinks' | 'bills' | 'referrals' | 'giftcards';

interface PointsSummary {
  totalEarned: number;
  totalSpent: number;
  outstanding: number;
  topEarners: { user_id: string; name: string; email: string; earned: number }[];
}

interface PayLinkSummary {
  total: number;
  pending: number;
  paid: number;
  expired: number;
  recentLinks: any[];
}

interface BillSummary {
  total: number;
  totalAmountNGN: number;
  airtimeCount: number;
  electricityCount: number;
  pointsUsed: number;
  walletUsed: number;
  recentBills: any[];
}

interface ReferralSummary {
  total: number;
  rewardedSignups: number;
  firstOrders: number;
  topReferrers: { user_id: string; name: string; email: string; count: number }[];
  recentReferrals: any[];
}

interface GiftCardSummary {
  total: number;
  active: number;
  redeemed: number;
  totalValueNGN: number;
  recentGiftCards: any[];
}

export default function AdminRewardsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('points');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [points, setPoints] = useState<PointsSummary>({
    totalEarned: 0, totalSpent: 0, outstanding: 0, topEarners: [],
  });
  const [payLinks, setPayLinks] = useState<PayLinkSummary>({
    total: 0, pending: 0, paid: 0, expired: 0, recentLinks: [],
  });
  const [bills, setBills] = useState<BillSummary>({
    total: 0, totalAmountNGN: 0, airtimeCount: 0, electricityCount: 0,
    pointsUsed: 0, walletUsed: 0, recentBills: [],
  });
  const [referrals, setReferrals] = useState<ReferralSummary>({
    total: 0, rewardedSignups: 0, firstOrders: 0, topReferrers: [], recentReferrals: [],
  });
  const [giftCards, setGiftCards] = useState<GiftCardSummary>({
    total: 0, active: 0, redeemed: 0, totalValueNGN: 0, recentGiftCards: [],
  });

  // Detail modal state
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<Tab | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [
        { data: ptTxns },
        { data: links },
        { data: billTxns },
        { data: referralRows },
        { data: giftCardRows },
      ] = await Promise.all([
        supabase
          .from('points_transactions')
          .select('user_id, type, amount, description, created_at, profiles(full_name, email)')
          .order('created_at', { ascending: false }),
        supabase
          .from('payment_links')
          .select('id, token, status, amount_ngn, requester_name, created_at, expires_at, paid_at, profiles(email)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('bill_transactions')
          .select('id, service_type, service_provider, amount, payment_source, points_used, status, beneficiary, created_at, profiles(full_name, email)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('referrals')
          .select(`
            id,
            referrer_user_id,
            referred_user_id,
            referral_code_used,
            signup_rewarded_at,
            first_paid_order_id,
            first_paid_order_at,
            created_at,
            referrer:profiles!referrals_referrer_user_id_fkey(full_name, email, referral_code),
            referred:profiles!referrals_referred_user_id_fkey(full_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('gift_cards')
          .select(`
            id,
            purchaser_user_id,
            recipient_user_id,
            redeemed_by_user_id,
            code,
            status,
            currency,
            amount_ngn,
            original_amount,
            recipient_name,
            sender_name,
            recipient_email,
            delivery_method,
            redeemed_at,
            created_at,
            template:gift_card_templates(name, category),
            purchaser:profiles!gift_cards_purchaser_user_id_fkey(full_name, email),
            recipient:profiles!gift_cards_recipient_user_id_fkey(full_name, email),
            redeemed_by:profiles!gift_cards_redeemed_by_user_id_fkey(full_name, email)
          `)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // ── Points ──
      const earned = (ptTxns ?? []).filter((t: any) => t.type === 'earned');
      const spent  = (ptTxns ?? []).filter((t: any) => t.type === 'spent');
      const totalEarned = earned.reduce((s: number, t: any) => s + t.amount, 0);
      const totalSpent  = spent.reduce((s: number, t: any) => s + t.amount, 0);

      // Top earners
      const earnerMap: Record<string, { name: string; email: string; earned: number }> = {};
      earned.forEach((t: any) => {
        const uid = t.user_id;
        if (!earnerMap[uid]) {
          earnerMap[uid] = {
            name:  (t.profiles as any)?.full_name ?? 'Unknown',
            email: (t.profiles as any)?.email ?? '',
            earned: 0,
          };
        }
        earnerMap[uid].earned += t.amount;
      });
      const topEarners = Object.entries(earnerMap)
        .map(([user_id, v]) => ({ user_id, ...v }))
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 5);

      setPoints({ totalEarned, totalSpent, outstanding: totalEarned - totalSpent, topEarners });

      // ── Payment Links ──
      const lArr = links ?? [];
      setPayLinks({
        total:   lArr.length,
        pending: lArr.filter((l: any) => l.status === 'pending').length,
        paid:    lArr.filter((l: any) => l.status === 'paid').length,
        expired: lArr.filter((l: any) => l.status === 'expired').length,
        recentLinks: lArr.slice(0, 10),
      });

      // ── Bills ──
      const bArr = (billTxns ?? []).filter((b: any) => b.status === 'success');
      const totalAmountNGN = bArr.reduce((s: number, b: any) => s + (b.amount ?? 0), 0);
      const pointsUsedTotal = bArr.reduce((s: number, b: any) => s + (b.points_used ?? 0), 0);
      setBills({
        total:            bArr.length,
        totalAmountNGN,
        airtimeCount:     bArr.filter((b: any) => b.service_type === 'airtime').length,
        electricityCount: bArr.filter((b: any) => b.service_type === 'electricity').length,
        pointsUsed:       pointsUsedTotal,
        walletUsed:       bArr.filter((b: any) => b.payment_source === 'wallet').length,
        recentBills:      bArr.slice(0, 10),
      });

      // ── Referrals ──
      const rArr = referralRows ?? [];
      const topReferrerMap: Record<string, { name: string; email: string; count: number }> = {};

      rArr.forEach((row: any) => {
        const referrer = Array.isArray(row.referrer) ? row.referrer[0] : row.referrer;
        if (!topReferrerMap[row.referrer_user_id]) {
          topReferrerMap[row.referrer_user_id] = {
            name: referrer?.full_name ?? 'Unknown',
            email: referrer?.email ?? '',
            count: 0,
          };
        }
        topReferrerMap[row.referrer_user_id].count += 1;
      });

      setReferrals({
        total: rArr.length,
        rewardedSignups: rArr.filter((r: any) => !!r.signup_rewarded_at).length,
        firstOrders: rArr.filter((r: any) => !!r.first_paid_order_id).length,
        topReferrers: Object.entries(topReferrerMap)
          .map(([user_id, value]) => ({ user_id, ...value }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        recentReferrals: rArr.slice(0, 10),
      });

      // ── Gift Cards ──
      const gArr = giftCardRows ?? [];
      setGiftCards({
        total: gArr.length,
        active: gArr.filter((g: any) => g.status === 'active').length,
        redeemed: gArr.filter((g: any) => g.status === 'redeemed').length,
        totalValueNGN: gArr.reduce((sum: number, g: any) => sum + Number(g.amount_ngn ?? 0), 0),
        recentGiftCards: gArr.slice(0, 10),
      });
    } catch (err) {
      console.error('Admin rewards fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openDetail = (item: any, type: Tab) => {
    setSelectedItem(item);
    setSelectedItemType(type);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setSelectedItemType(null);
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'points',    label: 'Points',     icon: Star  },
    { key: 'paylinks',  label: 'Pay Links',  icon: Link  },
    { key: 'bills',     label: 'Bills',      icon: Zap   },
    { key: 'referrals', label: 'Referrals',  icon: Users },
    { key: 'giftcards', label: 'Gift Cards', icon: Gift  },
  ];

  // ── Detail modal content renderer ──
  const renderDetailRows = () => {
    if (!selectedItem || !selectedItemType) return null;
    const item = selectedItem;

    const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
      <View style={styles.detailField}>
        <Text style={styles.detailFieldLabel}>{label}</Text>
        <Text style={styles.detailFieldValue}>{value ?? '-'}</Text>
      </View>
    );

    if (selectedItemType === 'points') {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return (
        <>
          <Field label="User Name" value={profile?.full_name} />
          <Field label="Email" value={profile?.email} />
          <Field label="Amount" value={`${item.amount} pts`} />
          <Field label="Type" value={item.type} />
          <Field label="Description" value={item.description} />
          <Field label="Date" value={fmtDate(item.created_at)} />
        </>
      );
    }

    if (selectedItemType === 'paylinks') {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return (
        <>
          <Field label="Requester Name" value={item.requester_name} />
          <Field label="Email" value={profile?.email} />
          <Field label="Token" value={item.token} />
          <Field label="Amount (NGN)" value={formatCurrency(item.amount_ngn, 'NGN')} />
          <Field label="Status" value={item.status} />
          <Field label="Created" value={fmtDate(item.created_at)} />
          <Field label="Expires" value={fmtDate(item.expires_at)} />
          <Field label="Paid At" value={item.paid_at ? fmtDate(item.paid_at) : '-'} />
        </>
      );
    }

    if (selectedItemType === 'bills') {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return (
        <>
          <Field label="User Name" value={profile?.full_name} />
          <Field label="Email" value={profile?.email} />
          <Field label="Service Type" value={item.service_type} />
          <Field label="Provider" value={item.service_provider} />
          <Field label="Beneficiary" value={item.beneficiary} />
          <Field label="Amount" value={formatCurrency(item.amount, 'NGN')} />
          <Field label="Payment Source" value={item.payment_source} />
          <Field label="Points Used" value={item.points_used != null ? `${item.points_used} pts` : '0 pts'} />
          <Field label="Status" value={item.status} />
          <Field label="Date" value={fmtDate(item.created_at)} />
        </>
      );
    }

    if (selectedItemType === 'referrals') {
      // Top earner sub-type: has user_id, name, email, count
      if ('count' in item && !('referral_code_used' in item)) {
        return (
          <>
            <Field label="Name" value={item.name} />
            <Field label="Email" value={item.email} />
            <Field label="Total Referrals" value={String(item.count)} />
          </>
        );
      }
      const referrer = Array.isArray(item.referrer) ? item.referrer[0] : item.referrer;
      const referred = Array.isArray(item.referred) ? item.referred[0] : item.referred;
      return (
        <>
          <Field label="Referrer Name" value={referrer?.full_name} />
          <Field label="Referrer Email" value={referrer?.email} />
          <Field label="Referred User Name" value={referred?.full_name} />
          <Field label="Referred Email" value={referred?.email} />
          <Field label="Code Used" value={item.referral_code_used} />
          <Field label="Signup Rewarded" value={item.signup_rewarded_at ? `Yes - ${fmtDate(item.signup_rewarded_at)}` : 'No'} />
          <Field
            label="First Order Placed"
            value={item.first_paid_order_id
              ? `Yes - ${fmtDate(item.first_paid_order_at)}`
              : 'No'}
          />
          <Field label="Created Date" value={fmtDate(item.created_at)} />
        </>
      );
    }

    if (selectedItemType === 'giftcards') {
      // Top earner sub-type: name, email, earned
      if ('earned' in item) {
        return (
          <>
            <Field label="Name" value={item.name} />
            <Field label="Email" value={item.email} />
            <Field label="Total Points Earned" value={`${item.earned} pts`} />
          </>
        );
      }
      const purchaser = Array.isArray(item.purchaser) ? item.purchaser[0] : item.purchaser;
      const recipient = Array.isArray(item.recipient) ? item.recipient[0] : item.recipient;
      const template = Array.isArray(item.template) ? item.template[0] : item.template;
      return (
        <>
          <Field label="Sender Name" value={item.sender_name} />
          <Field label="Recipient Name" value={item.recipient_name} />
          <Field label="Buyer Email" value={purchaser?.email} />
          <Field label="Recipient Email" value={recipient?.email ?? item.recipient_email} />
          <Field label="Template" value={template?.name} />
          <Field label="Code" value={item.code} />
          <Field label="Original Amount" value={item.original_amount != null ? `${item.original_amount} ${item.currency}` : '-'} />
          <Field label="Amount (NGN)" value={formatCurrency(item.amount_ngn, 'NGN')} />
          <Field label="Currency" value={item.currency} />
          <Field label="Status" value={item.status} />
          <Field label="Delivery Method" value={item.delivery_method} />
          <Field label="Redeemed At" value={item.redeemed_at ? fmtDate(item.redeemed_at) : '-'} />
          <Field label="Created Date" value={fmtDate(item.created_at)} />
        </>
      );
    }

    return null;
  };

  const getDetailTitle = () => {
    if (!selectedItem || !selectedItemType) return '';
    const item = selectedItem;
    if (selectedItemType === 'points') {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return profile?.full_name ?? profile?.email ?? 'Points Transaction';
    }
    if (selectedItemType === 'paylinks') return item.requester_name ?? item.token ?? 'Pay Link';
    if (selectedItemType === 'bills') {
      const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
      return profile?.full_name ?? profile?.email ?? 'Bill Payment';
    }
    if (selectedItemType === 'referrals') {
      if ('count' in item && !('referral_code_used' in item)) return item.name ?? 'Referrer';
      const referrer = Array.isArray(item.referrer) ? item.referrer[0] : item.referrer;
      return referrer?.full_name ?? referrer?.email ?? 'Referral';
    }
    if (selectedItemType === 'giftcards') {
      if ('earned' in item) return item.name ?? 'Top Earner';
      return `${item.sender_name ?? '?'} → ${item.recipient_name ?? '?'}`;
    }
    return '';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Rewards, Referrals & Gifts</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs - 2-row wrap grid so all tabs always visible */}
      <View style={styles.tabGrid}>
        {tabs.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <t.icon size={14} color={activeTab === t.key ? '#FFF' : '#6B7280'} />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BRAND.purple} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* ── POINTS TAB ── */}
          {activeTab === 'points' && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Total Earned" value={points.totalEarned.toLocaleString()} sub="pts" color="#F59E0B" />
                <StatCard label="Total Spent"  value={points.totalSpent.toLocaleString()}  sub="pts" color="#EF4444" />
                <StatCard label="Outstanding"  value={points.outstanding.toLocaleString()}  sub="pts" color="#10B981" />
              </View>

              <View style={styles.noteCard}>
                <TrendingUp size={14} color={BRAND.purple} />
                <Text style={styles.noteText}>
                  Outstanding ≈ <Text style={{ fontFamily: 'Inter-Bold' }}>₦{pointsToNaira(points.outstanding).toLocaleString()}</Text> in potential redemptions
                </Text>
              </View>

              {/* Top Earners */}
              <Text style={styles.sectionTitle}>Top Earners</Text>
              {points.topEarners.length === 0 ? (
                <EmptyState text="No points data yet" />
              ) : (
                points.topEarners.map((u, i) => (
                  <Pressable key={u.user_id} style={styles.rowCard} onPress={() => openDetail(u, 'giftcards')}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{u.name || u.email}</Text>
                      <Text style={styles.rowSub}>{u.email}</Text>
                    </View>
                    <View style={styles.pointsPill}>
                      <Star size={12} color={BRAND.gold} fill={BRAND.gold} />
                      <Text style={styles.pointsPillText}>{u.earned} pts</Text>
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ── PAY LINKS TAB ── */}
          {activeTab === 'paylinks' && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Total"   value={payLinks.total.toString()}   color="#3B82F6" />
                <StatCard label="Pending" value={payLinks.pending.toString()} color="#F59E0B" />
                <StatCard label="Paid"    value={payLinks.paid.toString()}    color="#10B981" />
                <StatCard label="Expired" value={payLinks.expired.toString()} color="#EF4444" />
              </View>

              <Text style={styles.sectionTitle}>Recent Links</Text>
              {payLinks.recentLinks.length === 0 ? (
                <EmptyState text="No payment links yet" />
              ) : (
                payLinks.recentLinks.map((l: any) => (
                  <Pressable key={l.id} style={styles.rowCard} onPress={() => openDetail(l, 'paylinks')}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{l.requester_name ?? (l.profiles as any)?.email ?? '-'}</Text>
                      <Text style={styles.rowSub}>Token: {l.token}</Text>
                      <Text style={styles.rowSub}>Expires: {fmtDate(l.expires_at)}</Text>
                    </View>
                    <View>
                      <Text style={styles.rowAmount}>{formatCurrency(l.amount_ngn, 'NGN')}</Text>
                      <StatusBadge status={l.status} />
                    </View>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ── BILLS TAB ── */}
          {activeTab === 'bills' && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Total Bills"   value={bills.total.toString()}              color="#5A2D82" />
                <StatCard label="Total Value"   value={formatCurrency(bills.totalAmountNGN, 'NGN')} color="#10B981" />
                <StatCard label="Airtime"       value={bills.airtimeCount.toString()}        color="#3B82F6" />
                <StatCard label="Electricity"   value={bills.electricityCount.toString()}    color="#F59E0B" />
                <StatCard label="Pts Used"      value={bills.pointsUsed.toLocaleString()}    sub="pts" color="#EF4444" />
              </View>

              <Text style={styles.sectionTitle}>Recent Bill Payments</Text>
              {bills.recentBills.length === 0 ? (
                <EmptyState text="No bill payments yet" />
              ) : (
                bills.recentBills.map((b: any) => (
                  <Pressable key={b.id} style={styles.rowCard} onPress={() => openDetail(b, 'bills')}>
                    <View style={[styles.billIcon, b.service_type === 'airtime' ? { backgroundColor: '#DBEAFE' } : { backgroundColor: '#FEF3C7' }]}>
                      {b.service_type === 'airtime'
                        ? <Zap size={16} color="#3B82F6" />
                        : <Zap size={16} color="#F59E0B" />
                      }
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>
                        {(b.profiles as any)?.full_name ?? (b.profiles as any)?.email ?? '-'}
                      </Text>
                      <Text style={styles.rowSub}>
                        {b.service_type} · {b.service_provider} · {b.beneficiary}
                      </Text>
                      <Text style={styles.rowSub}>
                        Paid via {b.payment_source === 'points' ? `${b.points_used} pts` : 'Wallet'} · {fmtDate(b.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>{formatCurrency(b.amount, 'NGN')}</Text>
                  </Pressable>
                ))
              )}
            </>
          )}

          {/* ── REFERRALS TAB ── */}
          {activeTab === 'referrals' && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Total Referrals" value={referrals.total.toString()} color="#5A2D82" />
                <StatCard label="Signup Rewards" value={referrals.rewardedSignups.toString()} color="#10B981" />
                <StatCard label="First Orders" value={referrals.firstOrders.toString()} color="#F59E0B" />
              </View>

              <Text style={styles.sectionTitle}>Top Referrers</Text>
              {referrals.topReferrers.length === 0 ? (
                <EmptyState text="No referrals yet" />
              ) : (
                referrals.topReferrers.map((u, i) => (
                  <Pressable key={u.user_id} style={styles.rowCard} onPress={() => openDetail(u, 'referrals')}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowName}>{u.name || u.email}</Text>
                      <Text style={styles.rowSub}>{u.email}</Text>
                    </View>
                    <View style={styles.pointsPill}>
                      <Users size={12} color={BRAND.purple} />
                      <Text style={[styles.pointsPillText, { color: BRAND.purple }]}>{u.count}</Text>
                    </View>
                  </Pressable>
                ))
              )}

              <Text style={styles.sectionTitle}>Recent Referrals</Text>
              {referrals.recentReferrals.length === 0 ? (
                <EmptyState text="No referral activity yet" />
              ) : (
                referrals.recentReferrals.map((r: any) => {
                  const referrer = Array.isArray(r.referrer) ? r.referrer[0] : r.referrer;
                  const referred = Array.isArray(r.referred) ? r.referred[0] : r.referred;

                  return (
                    <Pressable key={r.id} style={styles.rowCard} onPress={() => openDetail(r, 'referrals')}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>
                          {referrer?.full_name ?? referrer?.email ?? 'Unknown referrer'}
                        </Text>
                        <Text style={styles.rowSub}>
                          Referred {referred?.full_name ?? referred?.email ?? 'Unknown user'}
                        </Text>
                        <Text style={styles.rowSub}>
                          Code: {r.referral_code_used} · {fmtDate(r.created_at)}
                        </Text>
                      </View>
                      <StatusBadge status={r.first_paid_order_id ? 'paid' : 'pending'} />
                    </Pressable>
                  );
                })
              )}
            </>
          )}

          {/* ── GIFT CARDS TAB ── */}
          {activeTab === 'giftcards' && (
            <>
              <View style={styles.statsGrid}>
                <StatCard label="Total Cards" value={giftCards.total.toString()} color="#5A2D82" />
                <StatCard label="Active" value={giftCards.active.toString()} color="#10B981" />
                <StatCard label="Redeemed" value={giftCards.redeemed.toString()} color="#3B82F6" />
                <StatCard label="Total Value" value={formatCurrency(giftCards.totalValueNGN, 'NGN')} color="#F59E0B" />
              </View>

              <Text style={styles.sectionTitle}>Recent Gift Cards</Text>
              {giftCards.recentGiftCards.length === 0 ? (
                <EmptyState text="No gift cards yet" />
              ) : (
                giftCards.recentGiftCards.map((g: any) => {
                  const purchaser = Array.isArray(g.purchaser) ? g.purchaser[0] : g.purchaser;
                  const recipient = Array.isArray(g.recipient) ? g.recipient[0] : g.recipient;
                  const template = Array.isArray(g.template) ? g.template[0] : g.template;

                  return (
                    <Pressable key={g.id} style={styles.rowCard} onPress={() => openDetail(g, 'giftcards')}>
                      <View style={[styles.billIcon, { backgroundColor: '#FCE7F3' }]}>
                        <Gift size={16} color="#BE185D" />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>
                          {g.sender_name} to {g.recipient_name}
                        </Text>
                        <Text style={styles.rowSub}>
                          Buyer: {purchaser?.full_name ?? purchaser?.email ?? 'Unknown'}
                        </Text>
                        <Text style={styles.rowSub}>
                          {template?.name ?? 'Gift Card'} · {g.currency} · {g.code}
                        </Text>
                        <Text style={styles.rowSub}>
                          Recipient account: {recipient?.email ?? g.recipient_email ?? 'Link only'} · {fmtDate(g.created_at)}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.rowAmount}>
                          {formatCurrency(g.original_amount, g.currency)}
                        </Text>
                        <StatusBadge status={g.status} />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── Detail Bottom-Sheet Modal ── */}
      <Modal
        visible={selectedItem !== null}
        animationType="slide"
        transparent
        onRequestClose={closeDetail}
      >
        <View style={styles.modalOverlayContainer}>
          {/* Dark overlay - tap to close */}
          <Pressable style={styles.modalOverlay} onPress={closeDetail} />

          {/* Sheet */}
          <View style={styles.modalSheet}>
            {/* Drag handle */}
            <View style={styles.dragHandle} />

            {/* Title row */}
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle} numberOfLines={1}>{getDetailTitle()}</Text>
              <Pressable style={styles.modalCloseBtn} onPress={closeDetail}>
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            {/* Scrollable fields */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              {renderDetailRows()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Small reusable components ──
function StatCard({
  label, value, sub, color,
}: {
  label: string; value: string; sub?: string; color: string; onPress?: () => void;
}) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <Text
        style={[styles.statValue, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {value}{sub ? ` ${sub}` : ''}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: '#F59E0B', paid: '#10B981', expired: '#EF4444', cancelled: '#9CA3AF',
  };
  const color = colorMap[status] ?? '#6B7280';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },

  // Tab grid - wraps into 2 rows so all 5 tabs are always visible
  tabGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    // 3 per row on most screens (row1: Points, Pay Links, Bills; row2: Referrals, Gift Cards)
    minWidth: (screenWidth - 12 * 2 - 8 * 2) / 3,
  },
  tabActive: { backgroundColor: BRAND.purple },
  tabLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#6B7280' },
  tabLabelActive: { color: '#FFF' },

  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Stats 2-column grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: CARD_WIDTH,
    minHeight: 72,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 4,
    textAlign: 'center',
    width: '100%',
  },
  statLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },

  noteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EDE9F6', borderRadius: 10, padding: 12, marginBottom: 16,
  },
  noteText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', flex: 1 },

  sectionTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 10, marginTop: 4 },

  rowCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
    gap: 10,
  },
  rankBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center',
  },
  rankText: { fontSize: 12, fontFamily: 'Inter-Bold', color: BRAND.purple },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginBottom: 2 },
  rowSub: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280' },
  rowAmount: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'right' },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  pointsPillText: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#92400E' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-end', marginTop: 4 },
  badgeText: { fontSize: 11, fontFamily: 'Inter-SemiBold' },
  billIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  emptyState: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#9CA3AF' },

  // Detail modal
  modalOverlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  detailField: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailFieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailFieldValue: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
});
