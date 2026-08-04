import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, useWindowDimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Shirt, Sparkles, Check, Award, Lock } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { colorToHex } from '@/lib/colors';
import { fetchLooks } from '@/lib/outfits';
import { useAuth } from '@/contexts/AuthContext';
import ProductModal from '@/features/customer/shared/productModal/components/ProductModal';
import { getProductCategories, type StoreProduct } from '@/types/product';
import type { OutfitWithProducts } from '@/types/outfit';
import { TIERS, tierIndexFor } from '@/lib/wardrobe';

const BRAND_PURPLE = '#5A2D82';
const BRAND_GOLD = '#FDB813';

const SUCCESS_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];

// Simple complementary-category rules for "pairs with" suggestions.
const TOPS = ['T-Shirts', 'Shirts', 'Hoodies', 'Polos', 'Sweatshirt'];
const BOTTOMS = ['Joggers', 'Trousers', 'Shorts'];
const OUTER = ['Jackets'];

const complementOf = (category: string): string[] => {
  if (TOPS.includes(category)) return [...BOTTOMS, ...OUTER];
  if (BOTTOMS.includes(category)) return [...TOPS, ...OUTER];
  if (OUTER.includes(category)) return [...TOPS, ...BOTTOMS];
  return [];
};

// Coarse wardrobe groups for the summary counts.
const GROUPS = [
  { key: 'Tops', emoji: '👕', cats: TOPS },
  { key: 'Bottoms', emoji: '👖', cats: BOTTOMS },
  { key: 'Outerwear', emoji: '🧥', cats: OUTER },
  { key: 'Other', emoji: '🎒', cats: [] as string[] },
] as const;
const groupOf = (cats: string[]): string => {
  for (const g of GROUPS) if (g.cats.some((c) => cats.includes(c))) return g.key;
  return 'Other';
};

const mode = (arr: string[]): string | null => {
  if (!arr.length) return null;
  const counts = new Map<string, number>();
  arr.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

const relTime = (iso: string | null): string => {
  if (!iso) return '-';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  if (d < 30) { const w = Math.floor(d / 7); return `${w} week${w > 1 ? 's' : ''} ago`; }
  if (d < 365) { const m = Math.floor(d / 30); return `${m} month${m > 1 ? 's' : ''} ago`; }
  const y = Math.floor(d / 365); return `${y} year${y > 1 ? 's' : ''} ago`;
};

interface Suggestion { product: StoreProduct; pairsWith: string; }
interface FitProgress { look: OutfitWithProducts; owned: number; total: number; remainingNgn: number; }
interface Stats { total: number; groups: Record<string, number>; favouriteCategory: string | null; topColour: string | null; latestPurchase: string | null; }

export default function WardrobeScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 4 : 3;

  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<StoreProduct[]>([]);
  const [recent, setRecent] = useState<StoreProduct[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [fits, setFits] = useState<FitProgress[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [stylingRequesting, setStylingRequesting] = useState(false);

  const userCurrency = profile?.preferred_currency || 'NGN';
  const toUserPrice = (ngn: number) => (userCurrency === 'NGN' ? ngn : convertFromNGN(ngn, userCurrency));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) { setLoading(false); return; }
      setLoading(true);

      const [{ data: orders }, allLooks] = await Promise.all([
        supabase.from('orders').select('items, payment_status, order_status, created_at').eq('user_id', user.id),
        fetchLooks(),
      ]);

      const ownedIds = new Set<string>();
      const ownedDate = new Map<string, string>(); // product_id -> latest order date
      const purchasedColours: string[] = [];
      let latestPurchase: string | null = null;

      (orders ?? []).forEach((o: any) => {
        const successful = o.payment_status === 'paid' || SUCCESS_STATUSES.includes((o.order_status || '').toLowerCase());
        if (!successful || !Array.isArray(o.items)) return;
        if (o.created_at && (!latestPurchase || o.created_at > latestPurchase)) latestPurchase = o.created_at;
        o.items.forEach((it: any) => {
          if (it?.product_id) {
            const pid = String(it.product_id);
            ownedIds.add(pid);
            const prev = ownedDate.get(pid);
            if (o.created_at && (!prev || o.created_at > prev)) ownedDate.set(pid, o.created_at);
          }
          if (it?.color) purchasedColours.push(String(it.color));
        });
      });

      const ownedArr = [...ownedIds];
      const [{ data: ownedRows }, { data: activeRows }] = await Promise.all([
        ownedArr.length
          ? supabase.from('products').select('*').in('id', ownedArr)
          : Promise.resolve({ data: [] as StoreProduct[] }),
        supabase.from('products').select('*').eq('is_active', true),
      ]);

      const ownedProducts = (ownedRows ?? []) as StoreProduct[];
      const active = (activeRows ?? []) as StoreProduct[];

      // Suggestions: complementary categories to what they already own.
      const ownedCategoryToName = new Map<string, string>();
      ownedProducts.forEach((p) => {
        getProductCategories(p).forEach((cat) => { if (!ownedCategoryToName.has(cat)) ownedCategoryToName.set(cat, p.name); });
      });
      const desired = new Map<string, string>();
      ownedCategoryToName.forEach((name, cat) => {
        complementOf(cat).forEach((target) => { if (!desired.has(target)) desired.set(target, name); });
      });
      const suggestionList: Suggestion[] = [];
      const seen = new Set<string>();
      for (const p of active) {
        if (ownedIds.has(p.id) || seen.has(p.id)) continue;
        const cats = getProductCategories(p);
        const match = cats.find((c) => desired.has(c));
        if (match) { suggestionList.push({ product: p, pairsWith: desired.get(match) as string }); seen.add(p.id); }
        if (suggestionList.length >= 8) break;
      }

      // Primary gallery images for owned + suggestions.
      const idsForImages = [...new Set([...ownedProducts.map((p) => p.id), ...suggestionList.map((s) => s.product.id)])];
      if (idsForImages.length) {
        const { data: imgs } = await supabase
          .from('product_images').select('product_id, image_url').eq('is_primary', true).in('product_id', idsForImages);
        const primary = new Map<string, string>((imgs ?? []).map((r: any) => [String(r.product_id), r.image_url]));
        ownedProducts.forEach((p) => { const u = primary.get(p.id); if (u) p.image_url = u; });
        suggestionList.forEach((s) => { const u = primary.get(s.product.id); if (u) s.product.image_url = u; });
      }

      // Stats + summary counts.
      const groups: Record<string, number> = { Tops: 0, Bottoms: 0, Outerwear: 0, Other: 0 };
      const catList: string[] = [];
      ownedProducts.forEach((p) => {
        const cats = getProductCategories(p);
        groups[groupOf(cats)] += 1;
        if (cats[0]) catList.push(cats[0]);
      });
      const statsObj: Stats = {
        total: ownedProducts.length,
        groups,
        favouriteCategory: mode(catList),
        topColour: mode(purchasedColours),
        latestPurchase,
      };

      // Recently added: newest owned pieces first.
      const recentList = [...ownedProducts]
        .sort((a, b) => (ownedDate.get(b.id) ?? '').localeCompare(ownedDate.get(a.id) ?? ''))
        .slice(0, 8);

      // Fit progress: fits the shopper has started (owns ≥1 piece of).
      const fitList: FitProgress[] = allLooks
        .map((l) => {
          const ownedCount = l.products.filter((p) => ownedIds.has(p.id)).length;
          const remainingNgn = l.products.filter((p) => !ownedIds.has(p.id)).reduce((s, p) => s + p.price, 0);
          return { look: l, owned: ownedCount, total: l.products.length, remainingNgn };
        })
        .filter((f) => f.owned > 0)
        .sort((a, b) => (b.owned / b.total) - (a.owned / a.total))
        .slice(0, 6);

      if (!cancelled) {
        setOwned(ownedProducts);
        setRecent(recentList);
        setSuggestions(suggestionList);
        setStats(statsObj);
        setFits(fitList);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.id]);

  const openProduct = (product: StoreProduct) => { setSelectedProduct(product); setShowModal(true); };

  // Platinum perk: file a real styling-session request the admin sees (priority ticket).
  const requestStyling = async () => {
    if (!user?.id || stylingRequesting) return;
    setStylingRequesting(true);
    try {
      const ticketCode = `DRW-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        ticket_code: ticketCode,
        subject: 'VIP Styling Session Request',
        description: 'Platinum member requested a personal styling session.',
        category_id: null,
        status: 'open',
        priority: 'high',
      });
      if (error) throw error;
      Alert.alert('Request sent', 'Our stylist will reach out shortly to book your session.');
    } catch {
      Alert.alert('Could not send', 'Please try again in a moment.');
    } finally {
      setStylingRequesting(false);
    }
  };

  // Season-aware nudge (Nigeria: rainy ~Apr–Oct, harmattan/dry otherwise) that
  // links to genuinely relevant categories in the shop.
  const month = new Date().getMonth();
  const season = month >= 3 && month <= 9
    ? { emoji: '🌧️', title: 'Rainy season is here', copy: 'Layer up - hoodies and jackets to stay dry and warm.', category: 'Hoodies' }
    : { emoji: '🧥', title: 'Harmattan & dry season', copy: 'Keep cosy - sweatshirts and hoodies for the cool, dusty months.', category: 'Sweatshirt' };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={22} color={BRAND_PURPLE} />
        </Pressable>
        <Text style={styles.headerTitle}>My Wardrobe</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <View style={styles.introBadge}><Shirt size={14} color={BRAND_GOLD} /><Text style={styles.introBadgeText}>YOUR PIECES</Text></View>
          <Text style={styles.introTitle}>Everything you own</Text>
          <Text style={styles.introSubtitle}>The Dritchwear pieces from your past orders - restyle them, complete your fits, and see what pairs.</Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={BRAND_PURPLE} /></View>
        ) : !user ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Sign in to see your wardrobe</Text>
            <Pressable style={styles.cta} onPress={() => router.push('/(auth)/welcome')}><Text style={styles.ctaText}>Sign in</Text></Pressable>
          </View>
        ) : owned.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
            <Text style={styles.emptyText}>Pieces you buy will appear here so you can restyle and pair them.</Text>
            <Pressable style={styles.cta} onPress={() => router.push('/(customer)/shop')}><Text style={styles.ctaText}>Start shopping</Text></Pressable>
          </View>
        ) : (
          <>
            {/* Season-aware nudge */}
            <Pressable
              style={styles.seasonCard}
              onPress={() => router.push({ pathname: '/(customer)/shop', params: { category: season.category } } as any)}
            >
              <Text style={styles.seasonEmoji}>{season.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.seasonTitle}>{season.title}</Text>
                <Text style={styles.seasonCopy}>{season.copy}</Text>
              </View>
              <Text style={styles.seasonCta}>Shop {season.category} →</Text>
            </Pressable>

            {/* Summary + stats */}
            {stats && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCount}>{stats.total} piece{stats.total === 1 ? '' : 's'}</Text>
                <View style={styles.groupRow}>
                  {GROUPS.filter((g) => stats.groups[g.key] > 0).map((g) => (
                    <View key={g.key} style={styles.groupPill}>
                      <Text style={styles.groupEmoji}>{g.emoji}</Text>
                      <Text style={styles.groupText}>{stats.groups[g.key]} {g.key}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Favourite</Text>
                    <Text style={styles.statValue} numberOfLines={1}>{stats.favouriteCategory ?? '-'}</Text>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Top colour</Text>
                    <View style={styles.colourRow}>
                      {!!stats.topColour && <View style={[styles.colourDot, { backgroundColor: colorToHex(stats.topColour) }]} />}
                      <Text style={styles.statValue} numberOfLines={1}>{stats.topColour ?? '-'}</Text>
                    </View>
                  </View>
                  <View style={styles.statTile}>
                    <Text style={styles.statLabel}>Last buy</Text>
                    <Text style={styles.statValue} numberOfLines={1}>{relTime(stats.latestPurchase)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Wardrobe level */}
            {stats && (() => {
              const idx = tierIndexFor(stats.total);
              const current = TIERS[idx];
              const next = TIERS[idx + 1];
              const span = next ? next.min - current.min : 1;
              const progress = next ? Math.min(1, Math.max(0, (stats.total - current.min) / span)) : 1;
              const remaining = next ? Math.max(0, next.min - stats.total) : 0;
              return (
                <View style={styles.levelCard}>
                  <View style={styles.levelTop}>
                    <View style={[styles.levelMedal, { backgroundColor: current.color }]}><Award size={18} color="#FFFFFF" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.levelLabel}>WARDROBE LEVEL</Text>
                      <Text style={styles.levelName}>{current.name}</Text>
                    </View>
                    <Text style={styles.levelPieces}>{stats.total} piece{stats.total === 1 ? '' : 's'}</Text>
                  </View>
                  {next ? (
                    <>
                      <View style={styles.levelTrack}><View style={[styles.levelFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: current.color }]} /></View>
                      <Text style={styles.levelNextText}>Buy {remaining} more piece{remaining === 1 ? '' : 's'} to unlock <Text style={[styles.levelNextName, { color: next.color }]}>{next.name}</Text></Text>
                      <View style={styles.perkList}>
                        {next.perks.map((p) => (
                          <View key={p} style={styles.perkRow}><Lock size={13} color="rgba(255,255,255,0.5)" /><Text style={styles.perkText}>{p}</Text></View>
                        ))}
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.levelNextText}>You&apos;ve reached the top tier - Dritchwear royalty. 👑</Text>
                      <View style={styles.perkList}>
                        {current.perks.map((p) => (
                          <View key={p} style={styles.perkRow}><Check size={13} color="#34D399" strokeWidth={3} /><Text style={styles.perkText}>{p}</Text></View>
                        ))}
                      </View>
                      <Pressable style={[styles.stylingBtn, stylingRequesting && { opacity: 0.6 }]} onPress={requestStyling} disabled={stylingRequesting}>
                        <Sparkles size={15} color="#17131C" />
                        <Text style={styles.stylingBtnText}>{stylingRequesting ? 'Sending…' : 'Request a styling session'}</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            })()}

            {/* Fit progress */}
            {fits.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHead}><Sparkles size={16} color={BRAND_PURPLE} /><Text style={styles.sectionTitle}>Your fits</Text></View>
                {fits.map(({ look, owned: ownedCount, total, remainingNgn }) => {
                  const complete = ownedCount >= total;
                  const cover = look.cover_image || look.products[0]?.image_url;
                  return (
                    <Pressable key={look.id} style={styles.fitRow} onPress={() => router.push(`/(customer)/look/${look.id}` as any)}>
                      {!!cover && <Image source={{ uri: optimizeImageUrl(cover, { width: 160 }) as string }} style={styles.fitThumb} resizeMode="cover" />}
                      <View style={styles.fitInfo}>
                        <Text style={styles.fitName} numberOfLines={1}>{look.title}</Text>
                        {complete ? (
                          <View style={styles.fitDoneRow}><Check size={13} color="#059669" strokeWidth={3} /><Text style={styles.fitDoneText}>You own this fit</Text></View>
                        ) : (
                          <Text style={styles.fitProgressText}>{ownedCount}/{total} owned · Complete for {formatCurrency(toUserPrice(remainingNgn), userCurrency)}</Text>
                        )}
                        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((ownedCount / total) * 100)}%` }]} /></View>
                      </View>
                      <ArrowRight size={18} color="#9CA3AF" />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Recently added */}
            {recent.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recently added</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                  {recent.map((p) => (
                    <Pressable key={p.id} style={styles.recentCard} onPress={() => openProduct(p)}>
                      <Image source={{ uri: optimizeImageUrl(p.image_url, { width: 300 }) as string }} style={styles.recentImage} resizeMode="cover" />
                      <Text style={styles.recentName} numberOfLines={1}>{p.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* All pieces */}
            <Text style={[styles.sectionTitle, { paddingHorizontal: 20, marginTop: 18 }]}>All pieces</Text>
            <View style={styles.grid}>
              {owned.map((p) => (
                <Pressable key={p.id} style={[styles.ownedCard, { width: `${100 / columns}%` }]} onPress={() => openProduct(p)}>
                  <Image source={{ uri: optimizeImageUrl(p.image_url, { width: 300 }) as string }} style={styles.ownedImage} resizeMode="cover" />
                  <Text style={styles.ownedName} numberOfLines={1}>{p.name}</Text>
                </Pressable>
              ))}
            </View>

            {suggestions.length > 0 && (
              <View style={styles.suggestSection}>
                <View style={styles.suggestHeader}>
                  <Sparkles size={16} color={BRAND_PURPLE} />
                  <Text style={styles.suggestTitle}>Complete your wardrobe</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRow}>
                  {suggestions.map(({ product, pairsWith }) => (
                    <Pressable key={product.id} style={styles.suggestCard} onPress={() => openProduct(product)}>
                      <Image source={{ uri: optimizeImageUrl(product.image_url, { width: 300 }) as string }} style={styles.suggestImage} resizeMode="cover" />
                      <Text style={styles.pairsWith} numberOfLines={1}>Pairs with your {pairsWith}</Text>
                      <Text style={styles.suggestName} numberOfLines={1}>{product.name}</Text>
                      <Text style={styles.suggestPrice}>{formatCurrency(toUserPrice(product.price), userCurrency)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ProductModal
        product={selectedProduct}
        visible={showModal}
        onClose={() => { setShowModal(false); setSelectedProduct(null); }}
        onOrderSuccess={() => {}}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E3EB' },
  backButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scroll: { paddingBottom: 60 },
  intro: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  introBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  introBadgeText: { color: BRAND_PURPLE, fontFamily: 'Inter-Bold', fontSize: 11, letterSpacing: 1.4 },
  introTitle: { fontSize: 26, fontFamily: 'Inter-Bold', color: '#17131C', letterSpacing: -0.5 },
  introSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#665F6C', lineHeight: 20, marginTop: 8, maxWidth: 460 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  emptyText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center' },
  cta: { marginTop: 12, backgroundColor: BRAND_PURPLE, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  ctaText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },

  seasonCard: { marginHorizontal: 16, marginTop: 10, marginBottom: 2, backgroundColor: '#F3EFF7', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#E7DEF3' },
  seasonEmoji: { fontSize: 24 },
  seasonTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#17131C' },
  seasonCopy: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#665F6C', marginTop: 2, lineHeight: 17 },
  seasonCta: { fontSize: 12, fontFamily: 'Inter-Bold', color: BRAND_PURPLE },
  summaryCard: { marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#EDEAF1' },
  summaryCount: { fontSize: 26, fontFamily: 'Inter-Bold', color: '#17131C', letterSpacing: -0.5 },
  groupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  groupPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F6F1FB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  groupEmoji: { fontSize: 14 },
  groupText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#4A4453' },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#F0EDF4', paddingTop: 14 },
  statTile: { flex: 1 },
  statLabel: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#9089A0', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 3 },
  colourRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  colourDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#E5E7EB' },

  levelCard: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#17131C', borderRadius: 16, padding: 18 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelMedal: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  levelLabel: { fontSize: 10, fontFamily: 'Inter-Bold', color: 'rgba(255,255,255,0.55)', letterSpacing: 1.4 },
  levelName: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#FFFFFF', marginTop: 1 },
  levelPieces: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: 'rgba(255,255,255,0.85)' },
  levelTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 16, overflow: 'hidden' },
  levelFill: { height: 6, borderRadius: 3 },
  levelNextText: { fontSize: 13, fontFamily: 'Inter-Regular', color: 'rgba(255,255,255,0.85)', marginTop: 10, lineHeight: 19 },
  levelNextName: { fontFamily: 'Inter-Bold' },
  perkList: { marginTop: 12, gap: 8 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { fontSize: 13, fontFamily: 'Inter-Medium', color: 'rgba(255,255,255,0.9)' },
  stylingBtn: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND_GOLD, borderRadius: 10, minHeight: 44 },
  stylingBtnText: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#17131C' },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C' },
  fitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EDF4' },
  fitThumb: { width: 46, height: 58, borderRadius: 8, backgroundColor: '#F3F4F6' },
  fitInfo: { flex: 1 },
  fitName: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#17131C' },
  fitDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  fitDoneText: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#059669' },
  fitProgressText: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#EDEAF1', marginTop: 7, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: BRAND_PURPLE },

  recentRow: { gap: 12, paddingHorizontal: 20, paddingVertical: 4, paddingRight: 8 },
  recentCard: { width: 120 },
  recentImage: { width: 120, height: 148, borderRadius: 12, backgroundColor: '#F3F4F6', marginBottom: 6 },
  recentName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#374151' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 8 },
  ownedCard: { paddingHorizontal: 6, marginBottom: 16 },
  ownedImage: { width: '100%', aspectRatio: 0.82, borderRadius: 12, backgroundColor: '#F3F4F6', marginBottom: 6 },
  ownedName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#374151' },
  suggestSection: { marginTop: 12 },
  suggestHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 4 },
  suggestTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C' },
  suggestRow: { gap: 12, paddingHorizontal: 20, paddingVertical: 12, paddingRight: 8 },
  suggestCard: { width: 140 },
  suggestImage: { width: 140, height: 170, borderRadius: 12, backgroundColor: '#F3F4F6', marginBottom: 6 },
  pairsWith: { fontSize: 10.5, fontFamily: 'Inter-SemiBold', color: BRAND_PURPLE },
  suggestName: { fontSize: 12.5, fontFamily: 'Inter-Medium', color: '#374151', marginTop: 2 },
  suggestPrice: { fontSize: 12.5, fontFamily: 'Inter-SemiBold', color: '#17131C', marginTop: 2 },
});
