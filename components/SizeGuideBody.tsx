import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ruler, UserRound, Users, Shirt } from 'lucide-react-native';

const P = '#5A2D82';
const G = '#FDB813';

// Single source of truth for the size chart, shared by the Size Guide screen
// and the in-product size-guide modal.
const SIZES = [
  { size: 'S',   chest: '92–96',   length: '68', waist: '72–76',   hip: '90–94'   },
  { size: 'M',   chest: '97–102',  length: '70', waist: '77–82',   hip: '95–100'  },
  { size: 'L',   chest: '103–108', length: '72', waist: '83–88',   hip: '101–106' },
  { size: 'XL',  chest: '109–114', length: '74', waist: '89–94',   hip: '107–112' },
  { size: 'XXL', chest: '115–120', length: '76', waist: '95–100',  hip: '113–118' },
  { size: '3XL', chest: '121–126', length: '78', waist: '101–106', hip: '119–124' },
  { size: '4XL', chest: '127–132', length: '80', waist: '107–112', hip: '125–130' },
];

function MeasureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={s.measureCard}>
      <View style={s.measureIcon}>{icon}</View>
      <Text style={s.measureTitle}>{title}</Text>
      <Text style={s.measureText}>{text}</Text>
    </View>
  );
}

function SizeTable() {
  return (
    <View style={s.table}>
      <View style={[s.tableRow, s.tableHead]}>
        <Text style={[s.tableCell, s.tableHeadCell, { color: P }]}>Size</Text>
        <Text style={[s.tableCell, s.tableHeadCell]}>Chest</Text>
        <Text style={[s.tableCell, s.tableHeadCell]}>Length</Text>
        <Text style={[s.tableCell, s.tableHeadCell]}>Waist</Text>
        <Text style={[s.tableCell, s.tableHeadCell]}>Hip</Text>
      </View>
      {SIZES.map((r, i) => (
        <View key={r.size} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
          <Text style={[s.tableCell, s.tableSizeCell]}>{r.size}</Text>
          <Text style={s.tableCell}>{r.chest}</Text>
          <Text style={s.tableCell}>{r.length}</Text>
          <Text style={s.tableCell}>{r.waist}</Text>
          <Text style={s.tableCell}>{r.hip}</Text>
        </View>
      ))}
      <Text style={s.tableNote}>All measurements in cm</Text>
    </View>
  );
}

function FitCard({ title, desc, bullets }: { title: string; desc: string; bullets: string[] }) {
  return (
    <View style={s.fitCard}>
      <Text style={s.fitTitle}>{title}</Text>
      <Text style={s.fitDesc}>{desc}</Text>
      {bullets.map(b => (
        <View key={b} style={s.fitRow}>
          <View style={s.fitDot} />
          <Text style={s.fitText}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}><Text style={{ color: P }}>{title.split(' ')[0]} </Text>{title.split(' ').slice(1).join(' ')}</Text>
      {subtitle ? <Text style={s.sectionSub}>{subtitle}</Text> : null}
    </View>
  );
}

export default function SizeGuideBody() {
  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Size <Text style={{ color: G }}>Guide</Text></Text>
      <Text style={s.pageSubtitle}>Use this guide to pick the best size before placing your order.</Text>

      <SectionHeader title="How To Measure" subtitle="Follow these simple steps to get accurate measurements for the perfect fit." />
      <View style={s.measureGrid}>
        <MeasureCard icon={<Ruler size={22} color={P} />} title="Use a Measuring Tape" text="Use a flexible measuring tape for the most accurate measurements. If you don't have one, use a string and measure it against a ruler." />
        <MeasureCard icon={<UserRound size={22} color={P} />} title="Wear Fitted Clothing" text="Take measurements over fitted clothing or undergarments for the most accurate results. Avoid bulky clothing." />
        <MeasureCard icon={<Users size={22} color={P} />} title="Get Help" text="Ask someone to help you measure for the most accurate results, especially for back measurements." />
      </View>

      <SectionHeader title="Size Tables" subtitle="Check your category below, then pick your size from the table." />
      <View style={s.card}>
        <View style={s.categoryRow}><Shirt size={18} color={P} /><Text style={s.categoryTitle}>Tops</Text></View>
        <Text style={s.categoryDesc}>T-shirts, sweatshirts, jackets, polos, hoodies, shirts, and more.</Text>
        <View style={s.accentBar} />
        <SizeTable />
      </View>
      <View style={[s.card, { marginTop: 12 }]}>
        <View style={s.categoryRow}><Shirt size={18} color={P} /><Text style={s.categoryTitle}>Bottoms</Text></View>
        <Text style={s.categoryDesc}>Joggers, shorts, trousers.</Text>
        <View style={s.accentBar} />
        <SizeTable />
      </View>

      <SectionHeader title="Fit Guide" subtitle="Understanding our different fits to help you choose the perfect style." />
      <View style={s.fitGrid}>
        <FitCard title="Slim Fit" desc="A tailored, close-to-body fit that follows your natural silhouette." bullets={['Fitted through chest and waist', 'Tapered sleeves', 'Contemporary styling', 'Best for athletic builds']} />
        <FitCard title="Regular Fit" desc="Our classic fit with comfortable room through the chest and waist." bullets={['Comfortable through chest', 'Relaxed but not loose', 'Classic styling', 'Suitable for all body types']} />
        <FitCard title="Relaxed Fit" desc="A loose, comfortable fit with extra room throughout." bullets={['Generous through chest and waist', 'Comfortable for layering', 'Casual styling', 'Great for comfort-focused wear']} />
      </View>

      <SectionHeader title="Sizing Tips" subtitle="Expert advice to help you find your perfect fit every time." />
      <View style={s.card}>
        <Text style={s.tipsTitle}>General Tips</Text>
        {['When in doubt, size up for a more comfortable fit', 'Consider the fabric - stretchy materials may fit differently', 'Check the product description for specific fit notes', 'Measure your favourite fitting garment for comparison'].map(t => (
          <View key={t} style={s.tipRow}><View style={s.tipDot} /><Text style={s.tipText}>{t}</Text></View>
        ))}
        <View style={s.divider} />
        <Text style={s.tipsTitle}>Extra Notes</Text>
        {['Streetwear fits may feel relaxed or oversized.', 'For custom or bulk orders, sizing can be adjusted.', 'Need help choosing a size? Contact support or use live chat in the app.'].map(t => (
          <View key={t} style={s.tipRow}><View style={s.tipDot} /><Text style={s.tipText}>{t}</Text></View>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  pageSubtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  sectionHeader: { marginTop: 24, marginBottom: 14, alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'center' },
  sectionSub: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', marginTop: 4 },
  measureGrid: { gap: 10, marginBottom: 4 },
  measureCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  measureIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  measureTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4, flex: 1 },
  measureText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18, flex: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  categoryTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  categoryDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', marginBottom: 10 },
  accentBar: { width: 36, height: 2, backgroundColor: G, marginBottom: 14 },
  table: { borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  tableHead: { backgroundColor: '#F9FAFB' },
  tableRow: { flexDirection: 'row' },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableCell: { flex: 1, fontSize: 11, fontFamily: 'Inter-Regular', color: '#4B5563', padding: 9, textAlign: 'center' },
  tableHeadCell: { fontFamily: 'Inter-SemiBold', color: '#374151' },
  tableSizeCell: { fontFamily: 'Inter-Bold', color: P },
  tableNote: { fontSize: 10, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', paddingVertical: 6, backgroundColor: '#F9FAFB' },
  fitGrid: { gap: 10, marginBottom: 4 },
  fitCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  fitTitle: { fontSize: 15, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4 },
  fitDesc: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', marginBottom: 10, lineHeight: 18 },
  fitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  fitDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P, marginTop: 6 },
  fitText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 18 },
  tipsTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 10 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: P, marginTop: 6 },
  tipText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 14 },
});
