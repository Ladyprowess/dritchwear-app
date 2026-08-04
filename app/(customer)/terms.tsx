import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, FileText, Scale, BadgeCheck, AlertTriangle } from 'lucide-react-native';

const P = '#5A2D82';
const G = '#FDB813';

function Header({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={s.header}>
      <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
        <ArrowLeft size={20} color={P} />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function OverviewCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={s.overviewCard}>
      <View style={s.overviewIcon}>{icon}</View>
      <Text style={s.overviewTitle}>{title}</Text>
      <Text style={s.overviewText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <Text style={s.sectionTitle}>
      <Text style={{ color: P }}>{number}. </Text>{title}
    </Text>
  );
}

function SubTitle({ title }: { title: string }) {
  return <Text style={s.subTitle}>{title}</Text>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <Text style={s.body}>{children}</Text>;
}

function Bullet({ items }: { items: string[] }) {
  return (
    <View style={s.bulletWrap}>
      {items.map((t) => (
        <View key={t} style={s.bulletRow}>
          <View style={s.dot} />
          <Text style={s.bulletText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={s.infoText}><Text style={s.infoLabel}>{label}: </Text>{value}</Text>
  );
}

export default function TermsScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Header title="Terms of Service" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Terms <Text style={{ color: G }}>of Service</Text></Text>
        <Text style={s.pageSubtitle}>These terms explain how you can use Dritchwear services and what to expect when you place an order.</Text>
        <Text style={s.updated}>Last updated: 7th February 2026</Text>

        {/* Overview cards */}
        <View style={s.overviewGrid}>
          <OverviewCard icon={<FileText size={22} color={P} />} title="Agreement" text="By using our services, you agree to these terms and conditions." />
          <OverviewCard icon={<Scale size={22} color={P} />} title="Fair Use" text="Use our services responsibly and follow applicable laws and rules." />
          <OverviewCard icon={<BadgeCheck size={22} color={P} />} title="Your Rights" text="You keep ownership of your content and have rights over your account data." />
          <OverviewCard icon={<AlertTriangle size={22} color={P} />} title="Limitations" text="Our liability is limited and certain warranties are disclaimed as stated below." />
        </View>

        {/* Main content card */}
        <View style={s.card}>
          <SectionTitle number="1" title="Acceptance of Terms" />
          <Body>Welcome to Dritchwear. These Terms of Service ("Terms") govern your use of our website, mobile application, and services (collectively, the "Services") operated by Dritchwear ("we," "our," or "us").{"\n\n"}By accessing or using our Services, you agree to be bound by these Terms. If you disagree with any part of these Terms, then you may not access our Services.{"\n\n"}We reserve the right to update these Terms at any time. Your continued use of our Services after any changes constitutes acceptance of the new Terms.</Body>

          <Divider />

          <SectionTitle number="2" title="Use of Services" />
          <SubTitle title="Eligibility" />
          <Body>You must be at least 18 years old to use our Services. If you are under 18, you may use our Services only with the involvement and consent of a parent or guardian.</Body>
          <SubTitle title="Account Registration" />
          <Body>To access certain features of our Services, you may be required to create an account. You agree to:</Body>
          <Bullet items={['Provide accurate, current, and complete information', 'Maintain and update your account information', 'Keep your password secure and confidential', 'Accept responsibility for all activities under your account', 'Notify us immediately of any unauthorised use']} />
          <SubTitle title="Prohibited Uses" />
          <Body>You may not use our Services:</Body>
          <Bullet items={['For any unlawful purpose or to solicit others to perform unlawful acts', 'To violate any applicable laws or regulations', 'To infringe upon or violate our intellectual property rights or those of others', 'To harass, abuse, insult, harm, defame, slander, intimidate, or discriminate', 'To submit false or misleading information', 'To upload or transmit viruses or any type of malicious code', 'To spam, phish, crawl, scrape, or attempt to access systems without authorisation', 'For any obscene or immoral purpose', 'To interfere with or circumvent the security features of our Services']} />

          <Divider />

          <SectionTitle number="3" title="Products and Orders" />
          <SubTitle title="Product Information" />
          <Body>We strive to provide accurate product descriptions, images, and pricing. However, we do not warrant that product descriptions or other content is accurate, complete, reliable, current, or error-free.</Body>
          <SubTitle title="Pricing and Payment" />
          <Body>All prices are subject to change without notice. We reserve the right to modify or discontinue products at any time. Payment must be received by us before your order is processed.</Body>
          <SubTitle title="Order Acceptance" />
          <Body>We reserve the right to refuse or cancel any order for any reason, including product availability, errors in product or pricing information, or suspected fraudulent activity.</Body>

          <Divider />

          <SectionTitle number="4" title="Shipping and Returns" />
          <View style={s.tableCard}>
            {[
              { title: 'Return Policy', body: 'Items must be returned within 2 days of receiving your order. To return an item, contact us first through our contact form or mobile app to initiate the return process.' },
              { title: 'Return Shipping', body: 'Customers are responsible for covering the cost of return shipping to our Nigeria location. We recommend using a trackable shipping method.' },
              { title: 'Shipping Times', body: 'Standard shipping takes 3–5 business days within Nigeria. Express (1–2 business days) and overnight options are available. International shipping typically takes 7–14 business days.' },
              { title: 'Delays', body: 'We are not responsible for delays or damages caused by shipping carriers, customs, or other factors beyond our control.' },
            ].map((item, i, arr) => (
              <View key={item.title}>
                <View style={s.tableRow}>
                  <Text style={s.tableRowTitle}>{item.title}</Text>
                  <Text style={s.tableRowBody}>{item.body}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.tableDivider} />}
              </View>
            ))}
          </View>

          <Divider />

          <SectionTitle number="5" title="Intellectual Property Rights" />
          <SubTitle title="Our Content" />
          <Body>The Services and their original content, features, and functionality are the exclusive property of Dritchwear and its licensors, protected by copyright, trademark, and other laws.</Body>
          <SubTitle title="Your Content" />
          <Body>You retain ownership of any content you submit. By submitting content, you grant us a worldwide, non-exclusive, royalty-free licence to use, reproduce, modify, and display such content in connection with our Services.</Body>
          <SubTitle title="Trademark Information" />
          <Body>"Dritchwear" and our logo are trademarks of Dritchwear. You may not use our trademarks without our prior written consent.</Body>

          <Divider />

          <SectionTitle number="6" title="User Content and Conduct" />
          <Body>Our Services may allow you to post, link, store, share, and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content you post, including its legality, reliability, and appropriateness.{"\n\n"}By posting Content, you represent and warrant that:</Body>
          <Bullet items={['The Content is yours or you have the right to use it', 'The Content does not infringe any third-party rights', 'The Content complies with these Terms and applicable laws']} />

          <Divider />

          <SectionTitle number="7" title="Privacy" />
          <Body>Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Services, to understand our practices.</Body>

          <Divider />

          <SectionTitle number="8" title="Disclaimers" />
          <Body>The information on our Services is provided on an "as is" basis. To the fullest extent permitted by law, we exclude:</Body>
          <Bullet items={['All conditions, warranties, and other terms which might otherwise be implied by statute, common law, or the law of equity', 'Any liability for any direct, indirect, or consequential loss or damage incurred by any user in connection with our Services']} />
          <Body>This does not affect our liability for death or personal injury arising from our negligence, nor any liability which cannot be excluded under applicable law.</Body>

          <Divider />

          <SectionTitle number="9" title="Limitation of Liability" />
          <Body>In no event shall Dritchwear, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, goodwill, or other intangible losses, resulting from your use of the Services.{"\n\n"}Our total liability to you for all claims shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.</Body>

          <Divider />

          <SectionTitle number="10" title="Governing Law" />
          <Body>These Terms shall be interpreted and governed by the laws of Nigeria, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.</Body>

          <Divider />

          <SectionTitle number="11" title="Contact Information" />
          <Body>If you have any questions about these Terms of Service, please contact us:</Body>
          <View style={s.contactBox}>
            <InfoRow label="Email" value="support@dritchwear.com" />
            <InfoRow label="Phone" value="(+234) 911-016-3722" />
            <InfoRow label="Address" value="Shop 101 Tailoring Line, Tradefair Complex, Lagos, Nigeria" />
            <InfoRow label="Legal Department" value="support@dritchwear.com" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1F8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937' },
  scroll: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#1F2937', textAlign: 'center', marginBottom: 8 },
  pageSubtitle: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 4 },
  updated: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  overviewCard: { width: '47.5%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  overviewIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  overviewTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4, textAlign: 'center' },
  overviewText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 10 },
  subTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937', marginTop: 14, marginBottom: 6 },
  body: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 4 },
  bulletWrap: { marginTop: 6, gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  tableCard: { marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  tableRow: { padding: 14 },
  tableRowTitle: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginBottom: 4 },
  tableRowBody: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18 },
  tableDivider: { height: 1, backgroundColor: '#F3F4F6' },
  contactBox: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, gap: 8 },
  infoText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 20 },
  infoLabel: { fontFamily: 'Inter-SemiBold', color: '#1F2937' },
});
