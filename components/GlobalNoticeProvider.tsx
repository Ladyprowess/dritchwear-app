import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type NoticeButton = { text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' };
type Notice = { title: string; message?: string; buttons: NoticeButton[] };

export default function GlobalNoticeProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const originalAlert = Alert.alert;
    (Alert as any).alert = (title?: string, message?: string, buttons?: NoticeButton[]) => {
      setNotice({
        title: title || 'Dritchwear',
        message,
        buttons: buttons?.length ? buttons : [{ text: 'OK' }],
      });
    };
    return () => { (Alert as any).alert = originalAlert; };
  }, []);

  const choose = (button: NoticeButton) => {
    setNotice(null);
    setTimeout(() => button.onPress?.(), 0);
  };

  // The notice is only ever raised on web (Alert is shimmed above only on web).
  // We render it as a top-most fixed overlay instead of an RN <Modal> so it
  // always sits ABOVE other open modals (e.g. the profile "Invite and Earn"
  // sheet) - RN web Modals share a stacking level and the notice could land
  // behind them. Native keeps the real Alert, so nothing renders here.
  return (
    <>
      {children}
      {notice && (
        <View
          style={[styles.overlay, Platform.OS === 'web' ? ({ position: 'fixed' } as any) : null]}
          accessibilityViewIsModal
        >
          <View style={styles.card} accessibilityRole="alert">
            <View style={styles.accent} />
            <Text style={styles.title}>{notice.title}</Text>
            {!!notice.message && <Text style={styles.message}>{notice.message}</Text>}
            <View style={styles.actions}>
              {notice.buttons.map((button, index) => (
                <Pressable
                  key={`${button.text || 'OK'}-${index}`}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    button.style === 'cancel' && styles.secondaryButton,
                    button.style === 'destructive' && styles.destructiveButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => choose(button)}
                >
                  <Text style={[styles.buttonText, button.style === 'cancel' && styles.secondaryButtonText]}>{button.text || 'OK'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(23,19,28,0.56)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 2147483647, elevation: 2147483647 },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: '#FDB813' },
  title: { color: '#17131C', fontFamily: 'Inter-Bold', fontSize: 20, lineHeight: 26 },
  message: { color: '#665F6C', fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 22, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  button: { minHeight: 44, minWidth: 96, paddingHorizontal: 18, borderRadius: 9, backgroundColor: '#5A2D82', alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: '#F3EFF7', borderWidth: 1, borderColor: '#DDD3E5' },
  destructiveButton: { backgroundColor: '#B42318' },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  secondaryButtonText: { color: '#5A2D82' },
});
