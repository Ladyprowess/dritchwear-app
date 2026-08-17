import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Briefcase, ChevronRight, ShoppingBag, Images, FileText, ShieldCheck,
  ClipboardList, Search, FileCheck, Factory, Truck,
} from 'lucide-react-native';
import { smartBack } from '@/lib/navigation';
import { useDesktopLayout } from '@/hooks/useDesktopLayout';
import { useQuoteBasket } from '@/contexts/QuoteBasketContext';

const BRAND = { purple: '#5A2D82', gold: '#FDB813' };

const WHY_DRITCHWEAR = [
  '20-piece minimum, no smaller runs',
  'Volume pricing that drops as quantity grows',
  'Screen printing & embroidery in-house',
  'Logo/specification review before production',
  'Fixed production lead times',
  'Live order tracking',
  'Dedicated corporate/event support',
  'A real portfolio of past projects',
];

const PROCESS_STEPS = [
  { n: '01', icon: ClipboardList, title: 'Browse & build your quote', body: 'Pick products and quantities as you browse.' },
  { n: '02', icon: Search, title: 'Tell us the details', body: 'Branding, deadline, and your logo.' },
  { n: '03', icon: FileCheck, title: 'Receive your quote', body: 'We confirm volume pricing and lead time.' },
  { n: '04', icon: Factory, title: 'Approve production', body: 'We produce and prepare your order.' },
  { n: '05', icon: Truck, title: 'Receive your merchandise', body: 'Delivery coordinated around your deadline.' },
];

export default function CorporateHubScreen() {
  const router = useRouter();
  const { isDesktop } = useDesktopLayout();
  const { getTotalPieces } = useQuoteBasket();
  const basketCount = getTotalPieces();

  const paths = [
    {
      icon: ShoppingBag,
      title: 'Browse Products & Prices',
      body: 'See available apparel, specifications, and volume pricing.',
      onPress: () => router.push('/corporate/products' as any),
    },
    {
      icon: Images,
      title: 'View Previous Work',
      body: 'Real corporate, team, and event projects we\'ve produced.',
      onPress: () => router.push('/portfolio' as any),
    },
    {
      icon: FileText,
      title: 'Request a Quote',
      body: 'Tell us what you need, upload your logo, get a tailored quote.',
      onPress: () => router.push('/corporate/quote' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isDesktop && styles.headerInnerDesktop]}>
          <Pressable
            style={styles.backButton}
            onPress={() => smartBack(router, '/(customer)/shop')}
            accessibilityRole="button"
            accessibilityLabel="Back to shop"
          >
            <ArrowLeft size={20} color={BRAND.purple} />
          </Pressable>
          <View style={styles.headerIcon}>
            <Briefcase size={22} color={BRAND.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Dritchwear for Business</Text>
            <Text style={styles.headerSub}>Corporate & event merchandise</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]} showsVerticalScrollIndicator={false}>
        <View style={isDesktop && styles.heroRow}>
          <View style={isDesktop && styles.heroCol}>
            <Text style={[styles.heroTitle, isDesktop && styles.heroTitleDesktop]}>Branded Merchandise for Teams, Companies & Events</Text>
            <Text style={[styles.heroSub, isDesktop && styles.heroSubDesktop]}>
              Premium apparel and branded merchandise for companies, tech teams and events - produced to your specifications, with clear pricing, volume discounts, and reliable lead times.
            </Text>
            <Text style={styles.heroMoq}>Minimum order: 20 pieces</Text>
          </View>

          {isDesktop && (
            <View style={styles.heroFactsCard}>
              <Text style={styles.heroFactsTitle}>At a glance</Text>
              {[
                ['Minimum order', '20 pieces'],
                ['Branding', 'Screen print & embroidery'],
                ['Lead time', 'Fixed, confirmed at quote'],
                ['Tracking', 'Live order status'],
              ].map(([label, value]) => (
                <View key={label} style={styles.heroFactRow}>
                  <Text style={styles.heroFactLabel}>{label}</Text>
                  <Text style={styles.heroFactValue}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.pathGrid, isDesktop && styles.pathGridDesktop]}>
          {paths.map((path) => (
            <Pressable key={path.title} style={[styles.pathCard, isDesktop && styles.pathCardDesktop]} onPress={path.onPress}>
              <View style={styles.pathIconWrap}>
                <path.icon size={20} color={BRAND.purple} />
              </View>
              <Text style={styles.pathTitle}>{path.title}</Text>
              <Text style={styles.pathBody}>{path.body}</Text>
              <View style={styles.pathLinkRow}>
                <Text style={styles.pathLinkText}>Explore</Text>
                <ChevronRight size={15} color={BRAND.purple} />
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Our Process</Text>
        <View style={isDesktop && styles.processRowDesktop}>
          {PROCESS_STEPS.map((step) => (
            <View key={step.n} style={[styles.stepRow, isDesktop && styles.stepColDesktop]}>
              <View style={styles.stepIconWrap}>
                <step.icon size={16} color={BRAND.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.n} - {step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Why Dritchwear</Text>
        <Text style={styles.sectionSub}>Built for real business orders.</Text>
        <View style={[styles.whyGrid, isDesktop && styles.whyGridDesktop]}>
          {WHY_DRITCHWEAR.map((point) => (
            <View key={point} style={[styles.whyRow, isDesktop && styles.whyRowDesktop]}>
              <ShieldCheck size={14} color={BRAND.gold} />
              <Text style={styles.whyText}>{point}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {basketCount > 0 && (
        <Pressable style={styles.basketBar} onPress={() => router.push('/corporate/quote' as any)}>
          <Text style={styles.basketBarText}>Build Your Quote ({basketCount} pieces)</Text>
          <ChevronRight size={16} color="#FFFFFF" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerInnerDesktop: { maxWidth: 1120, alignSelf: 'center', width: '100%' },
  backButton: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  headerSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', marginTop: 2 },

  content: { padding: 20, paddingBottom: 100 },
  contentDesktop: { paddingHorizontal: 40, paddingTop: 32, maxWidth: 1120, alignSelf: 'center', width: '100%' },

  heroRow: { flexDirection: 'row', gap: 32, alignItems: 'flex-start' },
  heroCol: { flex: 1.3 },
  heroTitle: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#17131C', lineHeight: 31, marginBottom: 10 },
  heroTitleDesktop: { fontSize: 40, lineHeight: 48, marginBottom: 16 },
  heroSub: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 12 },
  heroSubDesktop: { fontSize: 16, lineHeight: 25, marginBottom: 16, maxWidth: 480 },
  heroMoq: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: BRAND.purple, marginBottom: 28 },
  heroFactsCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9F6', padding: 24, marginTop: 4 },
  heroFactsTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  heroFactRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  heroFactLabel: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280' },
  heroFactValue: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#17131C', textAlign: 'right' },

  pathGrid: { gap: 12, marginBottom: 32 },
  pathGridDesktop: { flexDirection: 'row', gap: 16 },
  pathCard: { backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#EDE9F6', padding: 20 },
  pathCardDesktop: { flex: 1 },
  pathIconWrap: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  pathTitle: { fontSize: 16, fontFamily: 'Inter-Bold', color: '#17131C', marginBottom: 4 },
  pathBody: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  pathLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pathLinkText: { fontSize: 13, fontFamily: 'Inter-Bold', color: BRAND.purple },

  sectionTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#17131C', marginTop: 8, marginBottom: 6 },
  sectionSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 19, marginBottom: 16 },

  processRowDesktop: { flexDirection: 'row', gap: 16 },
  stepRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  stepColDesktop: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 10, marginBottom: 0 },
  stepIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 13.5, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 2 },
  stepBody: { fontSize: 12.5, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18 },

  whyGrid: { gap: 10, marginBottom: 8 },
  whyGridDesktop: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 12 },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  whyRowDesktop: { width: '46%' },
  whyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#374151' },

  basketBar: {
    position: 'absolute', left: 16, right: 16, bottom: 16,
    backgroundColor: BRAND.purple, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  basketBarText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter-Bold' },
});
