import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Shield, Eye, Lock, Users } from 'lucide-react-native';

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

function PrincipleCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <View style={s.principleCard}>
      <View style={s.principleIcon}>{icon}</View>
      <Text style={s.principleTitle}>{title}</Text>
      <Text style={s.principleText}>{text}</Text>
    </View>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return <Text style={s.sectionTitle}><Text style={{ color: P }}>{number}. </Text>{title}</Text>;
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
  return <Text style={s.infoText}><Text style={s.infoLabel}>{label}: </Text>{value}</Text>;
}

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={s.container}>
      <Header title="Privacy Policy" />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.pageTitle}>Privacy <Text style={{ color: G }}>Policy</Text></Text>
        <Text style={s.pageSubtitle}>We are committed to protecting your privacy and being transparent about how we handle your data.</Text>
        <Text style={s.updated}>Last updated: 7th February 2026</Text>

        <View style={s.principleGrid}>
          <PrincipleCard icon={<Shield size={22} color={P} />} title="Data Protection" text="We use industry-standard security measures to protect your personal information from unauthorised access." />
          <PrincipleCard icon={<Eye size={22} color={P} />} title="Transparency" text="We clearly explain what data we collect, why we collect it, and how we use it." />
          <PrincipleCard icon={<Lock size={22} color={P} />} title="Your Control" text="You have control over your data. You can access, update, or delete your information at any time." />
          <PrincipleCard icon={<Users size={22} color={P} />} title="No Selling" text="We never sell your personal information to third parties." />
        </View>

        <View style={s.card}>
          <SectionTitle number="1" title="Introduction" />
          <Body>Dritchwear ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our mobile application, or make a purchase from us.{"\n\n"}Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy, please do not access our website or use our services.</Body>

          <Divider />

          <SectionTitle number="2" title="Information We Collect" />
          <SubTitle title="Personal Information" />
          <Body>We may collect personal information when you:</Body>
          <Bullet items={['Create an account on our website or mobile app', 'Make a purchase or attempt to make a purchase', 'Subscribe to our newsletter or marketing communications', 'Contact us for customer support', 'Participate in surveys, contests, or promotions', 'Leave reviews or comments on our products']} />
          <SubTitle title="Automatically Collected Information" />
          <Bullet items={['IP address and location data', 'Browser type and version', 'Device information (type, operating system, screen resolution)', 'Pages visited and time spent on our site', 'Referring website or app', 'Search terms used to find our website']} />

          <Divider />

          <SectionTitle number="3" title="How We Use Your Information" />
          <Bullet items={['Processing and fulfilling your orders', 'Providing customer support and responding to enquiries', 'Personalising your shopping experience and product recommendations', 'Sending you marketing communications (with your consent)', 'Improving our website, mobile app, and services', 'Analysing usage patterns and trends', 'Preventing fraud and ensuring security', 'Complying with legal obligations']} />

          <Divider />

          <SectionTitle number="4" title="Information Sharing and Disclosure" />
          <Body>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:</Body>
          <SubTitle title="Service Providers" />
          <Bullet items={['Payment processors', 'Shipping and logistics companies', 'Email marketing platforms', 'Analytics providers', 'Customer support tools']} />
          <SubTitle title="Legal Requirements" />
          <Body>We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to protect our rights, property, or safety, or that of others.</Body>

          <Divider />

          <SectionTitle number="5" title="Data Security" />
          <Body>We implement appropriate technical and organisational security measures to protect your personal information. These measures include:</Body>
          <Bullet items={['SSL encryption for data transmission', 'Secure servers and databases', 'Regular security audits and updates', 'Access controls and authentication', 'Employee training on data protection']} />
          <Body>However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</Body>

          <Divider />

          <SectionTitle number="6" title="Your Rights and Choices" />
          <Body>Depending on your location, you may have certain rights regarding your personal information:</Body>
          <Bullet items={['Access: Request a copy of the personal information we hold about you', 'Correction: Request correction of inaccurate or incomplete information', 'Deletion: Request deletion of your personal information', 'Portability: Request transfer of your data to another service', 'Opt-out: Unsubscribe from marketing communications', 'Restriction: Request limitation of how we process your data']} />
          <Body>To exercise these rights, please contact us at support@dritchwear.com or through our mobile app.</Body>

          <Divider />

          <SectionTitle number="7" title="Cookies and Tracking Technologies" />
          <Body>We use cookies and similar tracking technologies to enhance your browsing experience, analyse website traffic, and personalise content. You can control cookie settings through your browser preferences.{"\n\n"}Our mobile app may also use analytics tools and advertising identifiers to improve functionality and provide personalised experiences.</Body>

          <Divider />

          <SectionTitle number="8" title="Children's Privacy" />
          <Body>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.</Body>

          <Divider />

          <SectionTitle number="9" title="International Data Transfers" />
          <Body>Your information may be transferred to and processed in countries other than your own. We ensure that such transfers comply with applicable data protection laws and implement appropriate safeguards to protect your information.</Body>

          <Divider />

          <SectionTitle number="10" title="Changes to This Privacy Policy" />
          <Body>We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on our website and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.</Body>

          <Divider />

          <SectionTitle number="11" title="Data Retention" />
          <Body>We retain personal information only for as long as necessary to fulfil the purposes outlined in this Privacy Policy, including providing our services, complying with legal obligations, resolving disputes, and enforcing our agreements.{"\n\n"}Account information will be retained while your account is active. If you request deletion of your account, we will begin the deletion process and complete removal within 30 days, except where we are required to retain certain information for legal, accounting, or security purposes.{"\n\n"}Transaction records may be retained for regulatory and financial reporting requirements.</Body>

          <Divider />

          <SectionTitle number="12" title="Contact Us" />
          <Body>If you have any questions about this Privacy Policy or our data practices, please contact us:</Body>
          <View style={s.contactBox}>
            <InfoRow label="Email" value="support@dritchwear.com" />
            <InfoRow label="Phone" value="(+234) 911-016-3722" />
            <InfoRow label="Address" value="Shop 101 tailoring line off trade fair complex Lagos, Nigeria" />
            <InfoRow label="Data Protection Officer" value="support@dritchwear.com" />
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
  principleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  principleCard: { width: '47.5%', backgroundColor: '#FFF', borderRadius: 14, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  principleIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F3F0F8', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  principleTitle: { fontSize: 13, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4, textAlign: 'center' },
  principleText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 16 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 10 },
  subTitle: { fontSize: 14, fontFamily: 'Inter-Bold', color: '#1F2937', marginTop: 14, marginBottom: 6 },
  body: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 21, marginBottom: 4 },
  bulletWrap: { marginTop: 6, gap: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: P, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 20 },
  contactBox: { marginTop: 12, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, gap: 8 },
  infoText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#4B5563', lineHeight: 20 },
  infoLabel: { fontFamily: 'Inter-SemiBold', color: '#1F2937' },
});
