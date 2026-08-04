import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles } from 'lucide-react-native';
import { convertFromNGN, getCurrencyByCode } from '@/lib/currency';
import { useAuth } from '@/contexts/AuthContext';
import { OCCASIONS, BUDGET_TIERS, type OutfitWithProducts } from '@/types/outfit';
import { fetchLooks } from '@/lib/outfits';
import { getOwnedProductIds } from '@/lib/wardrobe';
import LookCard from '@/components/LookCard';

const AUDIENCES = ['Everyone', 'Men', 'Women'] as const;

const BRAND_PURPLE = '#5A2D82';
const BRAND_GOLD = '#FDB813';

export default function LooksScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 760;

  const [outfits, setOutfits] = useState<OutfitWithProducts[]>([]);
  const [loading, setLoading] = useState(true);
  const [occasion, setOccasion] = useState<string>('All');
  const [audience, setAudience] = useState<string>('Everyone');
  const [budgetIndex, setBudgetIndex] = useState(0);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());

  const userCurrency = profile?.preferred_currency || 'NGN';
  const currencySymbol = getCurrencyByCode(userCurrency)?.symbol ?? '₦';

  // Budget chip labels shown in the user's currency (thresholds are stored in NGN).
  const budgetLabel = (tier: { min: number; max: number | null }): string => {
    if (tier.min === 0 && tier.max === null) return 'Any budget';
    const conv = (ngn: number) =>
      userCurrency === 'NGN'
        ? `₦${Math.round(ngn / 1000)}k`
        : `${currencySymbol}${Math.round(convertFromNGN(ngn, userCurrency)).toLocaleString()}`;
    if (tier.min === 0) return `Under ${conv(tier.max as number)}`;
    if (tier.max === null) return `${conv(tier.min)}+`;
    return `${conv(tier.min)}–${conv(tier.max)}`;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLooks().then((rows) => { if (!cancelled) { setOutfits(rows); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  // Owned pieces power the "from your wardrobe" ownership badges.
  useEffect(() => {
    if (!user?.id) { setOwnedIds(new Set()); return; }
    let active = true;
    getOwnedProductIds(user.id).then((ids) => { if (active) setOwnedIds(ids); });
    return () => { active = false; };
  }, [user?.id]);

  const ownedInfoFor = (look: OutfitWithProducts) =>
    ownedIds.size === 0
      ? undefined
      : { owned: look.products.filter((p) => ownedIds.has(p.id)).length, total: look.products.length };

  const availableOccasions = ['All', ...OCCASIONS.filter((occ) => outfits.some((o) => o.occasion === occ))];
  const budget = BUDGET_TIERS[budgetIndex];
  const visibleOutfits = outfits.filter((o) => {
    const forAudience = audience === 'Everyone' || (o.gender || 'Unisex') === audience || (o.gender || 'Unisex') === 'Unisex';
    const total = o.products.reduce((sum, p) => sum + p.price, 0);
    const inBudget = total >= budget.min && (budget.max === null || total <= budget.max);
    return (occasion === 'All' || o.occasion === occasion) && forAudience && inBudget;
  });

  const openLook = (id: string) => router.push(`/(customer)/look/${id}` as any);
  const resetFilters = () => { setOccasion('All'); setAudience('Everyone'); setBudgetIndex(0); };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={BRAND_PURPLE} />
        </Pressable>
        <Text style={styles.headerTitle}>Style me</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Intro */}
        <View style={styles.intro}>
          <View style={styles.introBadge}><Sparkles size={14} color={BRAND_GOLD} /><Text style={styles.introBadgeText}>PERSONAL STYLIST</Text></View>
          <Text style={styles.introTitle}>Where are you headed?</Text>
          <Text style={styles.introSubtitle}>Tell us the moment and we'll style the whole fit - then shop the pieces or grab the entire fit in one tap.</Text>
        </View>

        {/* Stylist quiz - feels like a stylist, not filters */}
        {!loading && outfits.length > 0 && (
          <View style={styles.quiz}>
            <Text style={styles.quizLabel}>Where are you headed today?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quizRow}>
              {availableOccasions.map((occ) => (
                <Pressable key={occ} style={[styles.occasionChip, occasion === occ && styles.occasionChipActive]} onPress={() => setOccasion(occ)}>
                  <Text style={[styles.occasionText, occasion === occ && styles.occasionTextActive]}>{occ}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.quizLabel}>What's your budget?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quizRow}>
              {BUDGET_TIERS.map((tier, index) => (
                <Pressable key={tier.label} style={[styles.occasionChip, budgetIndex === index && styles.occasionChipActive]} onPress={() => setBudgetIndex(index)}>
                  <Text style={[styles.occasionText, budgetIndex === index && styles.occasionTextActive]}>{budgetLabel(tier)}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.quizLabel}>Who are you shopping for?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quizRow}>
              {AUDIENCES.map((a) => (
                <Pressable key={a} style={[styles.occasionChip, audience === a && styles.occasionChipActive]} onPress={() => setAudience(a)}>
                  <Text style={[styles.occasionText, audience === a && styles.occasionTextActive]}>{a === 'Everyone' ? 'Anyone' : a}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={BRAND_PURPLE} /></View>
        ) : outfits.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Fits are coming soon</Text>
            <Text style={styles.emptyText}>Our stylists are putting the fits together. Check back shortly.</Text>
            <Pressable style={styles.shopButton} onPress={() => router.push('/(customer)/shop')}>
              <Text style={styles.shopButtonText}>Shop the collection</Text>
            </Pressable>
          </View>
        ) : visibleOutfits.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No fit for this yet</Text>
            <Text style={styles.emptyText}>We don't have a curated outfit for those choices yet. Browse our latest arrivals instead.</Text>
            <Pressable style={styles.shopButton} onPress={() => router.push('/(customer)/shop')}>
              <Text style={styles.shopButtonText}>Shop the collection</Text>
            </Pressable>
            <Pressable onPress={resetFilters}><Text style={styles.noMatchReset}>Reset choices</Text></Pressable>
          </View>
        ) : (
          <>
            {ownedIds.size > 0 && (
              <Text style={styles.wardrobeHint}>
                {occasion === 'Vacation'
                  ? 'Packing list - ✓ means it’s already in your wardrobe.'
                  : '✓ marks fits you can already wear from your wardrobe.'}
              </Text>
            )}
            <View style={styles.gallery}>
              {visibleOutfits.map((look) => (
                <View key={look.id} style={isWide ? styles.tileWide : styles.tile}>
                  <LookCard look={look} variant="grid" onPress={() => openLook(look.id)} ownedInfo={ownedInfoFor(look)} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E8E3EB',
  },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scroll: { paddingBottom: 60 },
  intro: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  introBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  introBadgeText: { color: BRAND_PURPLE, fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1.4 },
  introTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#17131C', letterSpacing: -0.5 },
  introSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#665F6C', lineHeight: 20, marginTop: 8, maxWidth: 480 },
  quiz: { paddingTop: 8, paddingBottom: 4 },
  quizLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#374151', paddingHorizontal: 20, marginTop: 12, marginBottom: 2 },
  quizRow: { gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  occasionChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', minHeight: 40, justifyContent: 'center',
  },
  occasionChipActive: { backgroundColor: BRAND_PURPLE, borderColor: BRAND_PURPLE },
  occasionText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#6B7280' },
  occasionTextActive: { color: '#FFFFFF' },
  noMatchReset: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: BRAND_PURPLE, marginTop: 4 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  shopButton: { marginTop: 12, backgroundColor: BRAND_PURPLE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  shopButtonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  wardrobeHint: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#5A2D82', paddingHorizontal: 20, paddingTop: 12 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  tile: { width: '48%', marginBottom: 16 },
  tileWide: { width: '31.5%', marginBottom: 18 },
});
