import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Briefcase } from 'lucide-react-native';

const BRAND_PURPLE = '#5A2D82';

// "Once per session" - a browser tab close clears sessionStorage on web, and
// a cold app restart resets this in-memory flag on native. Reopening the app
// later (a new session) shows it again, but it never repeats mid-visit.
let shownThisNativeSession = false;

function wasShownThisSession(): boolean {
  if (Platform.OS === 'web') {
    try {
      return window.sessionStorage.getItem('dritchwear:corporate-announcement-shown') === '1';
    } catch {
      return shownThisNativeSession;
    }
  }
  return shownThisNativeSession;
}

function markShownThisSession() {
  shownThisNativeSession = true;
  if (Platform.OS === 'web') {
    try {
      window.sessionStorage.setItem('dritchwear:corporate-announcement-shown', '1');
    } catch {}
  }
}

export default function CorporateAnnouncementModal() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wasShownThisSession()) return;
    const timer = setTimeout(() => {
      markShownThisSession();
      setVisible(true);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  const close = () => setVisible(false);

  const handleGetQuote = () => {
    close();
    router.push('/corporate' as any);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.iconWrap}>
            <Briefcase size={24} color={BRAND_PURPLE} />
          </View>
          <Text style={s.headline}>Do You Want Custom Shirts or Merch for Your Company, Team, or Event?</Text>
          <Text style={s.body}>
            We make high-quality branded hoodies, polo shirts, caps, and souvenirs for companies, tech teams, and big events. Fast delivery and neat printing guaranteed.
          </Text>

          <Pressable style={s.primaryBtn} onPress={handleGetQuote}>
            <Text style={s.primaryBtnText}>Get a Fast Quote</Text>
          </Pressable>
          <Pressable style={s.portfolioLink} onPress={() => { close(); router.push('/portfolio' as any); }}>
            <Text style={s.portfolioLinkText}>See examples of our past work →</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={close}>
            <Text style={s.secondaryBtnText}>Just Shopping for Myself</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,6,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EDE9F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headline: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#17131C',
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 10,
  },
  body: {
    fontSize: 13.5,
    fontFamily: 'Inter-Regular',
    color: '#6B6470',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-Bold',
  },
  portfolioLink: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 8,
  },
  portfolioLinkText: {
    color: BRAND_PURPLE,
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
  },
  secondaryBtnText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
});
