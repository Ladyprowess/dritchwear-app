import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import type { EmailOtpType } from '@supabase/supabase-js';
import { resendConfirmation } from '@/lib/auth';
import { ArrowLeft, Mail, CheckCircle, RefreshCw, Download, Share as ShareIcon } from 'lucide-react-native';

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function ConfirmEmailScreen() {
  const [confirmed, setConfirmed] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [iosInstall, setIosInstall] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const email = params.email as string;
  const tokenHash = firstParam(params.token_hash as string | string[] | undefined);
  const otpType = (firstParam(params.type as string | string[] | undefined) || 'signup') as EmailOtpType;
  const confirmedFlag = firstParam(params.confirmed as string | string[] | undefined);

  // When the branded email links to /confirm-email?token_hash=…&type=signup, verify
  // the token here so the confirmation link lives on our own domain (not supabase.co).
  useEffect(() => {
    if (confirmedFlag === '1') { setConfirmed(true); return; }
    if (!tokenHash) return;

    let active = true;
    (async () => {
      setVerifying(true);
      setErrorMessage('');
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (!active) return;
      if (error) {
        setErrorMessage('This confirmation link is invalid or has expired. Request a new one below.');
      } else {
        setConfirmed(true);
      }
      setVerifying(false);
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenHash, otpType, confirmedFlag]);

  // Capture the PWA install opportunity so the confirmation modal can offer
  // "Add to Home Screen" right after the account is verified.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const standalone = (window.navigator as any).standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches;
    if (standalone) return;
    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (window.navigator as any).maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    if (isIOS && isSafari) setIosInstall(true);
    const onBeforeInstall = (event: any) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const handleAddToHomeScreen = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch {}
    setInstallPrompt(null);
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      Alert.alert('Error', 'Email address not found. Please try registering again.');
      return;
    }

    setResendLoading(true);
    const { error } = await resendConfirmation(email);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Email Sent',
        'A new confirmation email has been sent to your email address.'
      );
    }
    setResendLoading(false);
  };

  const handleContinue = () => {
    // verifyOtp already established a session, so send them into the app.
    router.replace('/');
  };

  if (verifying) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#5A2D82" />
        <Text style={styles.verifyingText}>Confirming your email…</Text>
      </View>
    );
  }

  if (confirmed) {
    const showInstall = Platform.OS === 'web' && (!!installPrompt || iosInstall);
    return (
      <View style={styles.container}>
        <StatusBar style="dark" />
        {/* Branded backdrop behind the confirmation modal */}
        <View style={styles.confirmBackdrop}>
          <Text style={styles.backdropBrand}>DRITCHWEAR</Text>
          <View style={styles.backdropAccent} />
        </View>

        <Modal visible transparent animationType="fade" onRequestClose={handleContinue}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIcon}>
                <CheckCircle size={44} color="#10B981" />
              </View>
              <Text style={styles.modalTitle}>Email confirmed!</Text>
              <Text style={styles.modalSubtitle}>
                Your Dritchwear account is active. Welcome in - you're all set to start shopping.
              </Text>

              <Pressable style={styles.modalPrimary} onPress={handleContinue}>
                <Text style={styles.modalPrimaryText}>Continue to Dritchwear</Text>
              </Pressable>

              {showInstall && (
                <View style={styles.installBox}>
                  <Text style={styles.installTitle}>Add Dritchwear to your home screen</Text>
                  <Text style={styles.installSub}>Open it like a real app - faster ordering and easy tracking.</Text>
                  {installPrompt ? (
                    <Pressable style={styles.installBtn} onPress={handleAddToHomeScreen}>
                      <Download size={16} color="#FFFFFF" />
                      <Text style={styles.installBtnText}>Add to Home Screen</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.installHintRow}>
                      <ShareIcon size={14} color="#5A2D82" />
                      <Text style={styles.installHint}>Tap the Share icon in Safari, then <Text style={styles.installHintBold}>Add to Home Screen</Text>.</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>
          
          <Text style={styles.title}>Confirm Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a confirmation email to verify your Dritchwear account.
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.emailIcon}>
            <Mail size={64} color="#5A2D82" />
          </View>

          <Text style={styles.instructionTitle}>Check Your Email</Text>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {email && (
            <Text style={styles.emailText}>
              We sent a confirmation link to{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
          )}

          <Text style={styles.instructionText}>
            Click the link in the email to confirm your account and start shopping at Dritchwear. If you don't see the email, check your spam folder.
          </Text>

          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.resendButton, resendLoading && styles.resendButtonDisabled]}
              onPress={handleResendConfirmation}
              disabled={resendLoading}
            >
              <RefreshCw size={16} color="#5A2D82" />
              <Text style={styles.resendButtonText}>
                {resendLoading ? 'Sending...' : 'Resend Confirmation Email'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => router.push('/(auth)/resend-confirmation')}
            >
              <Text style={styles.secondaryButtonText}>Use Different Email</Text>
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already confirmed?{' '}
              <Text 
                style={styles.footerLink}
                onPress={() => router.push('/(auth)/login')}
              >
                Sign In
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#32154E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropBrand: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    letterSpacing: 3,
    color: '#FFFFFF',
  },
  backdropAccent: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FDB813',
    marginTop: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23,19,28,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 26,
    alignItems: 'center',
  },
  modalIcon: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ECFDF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#17131C',
    textAlign: 'center',
  },
  modalSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Inter-Regular',
    color: '#665F6C',
    textAlign: 'center',
  },
  modalPrimary: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  modalPrimaryText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  installBox: {
    width: '100%',
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F0ECF4',
    alignItems: 'center',
  },
  installTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#17131C',
    textAlign: 'center',
  },
  installSub: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#8A8490',
    textAlign: 'center',
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 11,
    backgroundColor: '#5A2D82',
    marginTop: 14,
  },
  installBtnText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  installHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  installHint: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
    color: '#665F6C',
  },
  installHintBold: {
    fontFamily: 'Inter-SemiBold',
    color: '#17131C',
  },
  verifyingText: {
    marginTop: 16,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FEE4E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Inter-Medium',
    color: '#B42318',
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  emailIcon: {
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  emailHighlight: {
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  instructionText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5A2D82',
    gap: 8,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  secondaryButton: {
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  footerLink: {
    color: '#5A2D82',
    fontFamily: 'Inter-SemiBold',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#5A2D82',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});