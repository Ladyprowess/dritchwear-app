import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/lib/auth';
import type { EmailOtpType } from '@supabase/supabase-js';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react-native';

const BRAND_PURPLE = '#5A2D82';

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default function ResetPasswordScreen() {
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');

  const router = useRouter();
  const params = useLocalSearchParams();
  const tokenHash = firstParam(params.token_hash as string | string[] | undefined);
  const otpType = (firstParam(params.type as string | string[] | undefined) || 'recovery') as EmailOtpType;

  // The branded email links to /reset-password?token_hash=…&type=recovery so
  // the link lives on our own domain - verify it here the same way
  // /confirm-email verifies a signup token.
  useEffect(() => {
    if (!tokenHash) {
      setVerifying(false);
      setTokenError('This password reset link is missing or incomplete. Request a new one below.');
      return;
    }

    let active = true;
    (async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
      if (!active) return;
      if (error) {
        setTokenError('This password reset link is invalid or has expired. Request a new one below.');
      } else {
        setTokenValid(true);
      }
      setVerifying(false);
    })();

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenHash, otpType]);

  const handleSetPassword = async () => {
    setFormError('');
    if (password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);

    if (error) {
      setFormError('Could not update your password. Please request a new reset link and try again.');
      return;
    }

    // The recovery token granted a temporary session - sign out so the user
    // re-authenticates cleanly with their new password.
    await supabase.auth.signOut();
    setDone(true);
  };

  if (verifying) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={BRAND_PURPLE} />
        <Text style={styles.verifyingText}>Verifying your link…</Text>
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.container, styles.centerAll]}>
        <StatusBar style="dark" />
        <View style={styles.successIcon}>
          <CheckCircle size={64} color="#10B981" />
        </View>
        <Text style={styles.successTitle}>Password updated</Text>
        <Text style={styles.successSubtitle}>
          Your password has been changed. Sign in with your new password to continue.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Continue to Sign In</Text>
        </Pressable>
      </View>
    );
  }

  if (!tokenValid) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={24} color="#1F2937" />
            </Pressable>
            <Text style={styles.title}>Reset Password</Text>
          </View>

          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{tokenError}</Text>
          </View>

          <Pressable style={styles.primaryButton} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.primaryButtonText}>Request New Link</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>

          <Text style={styles.title}>Set a New Password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your Dritchwear account.
          </Text>
        </View>

        <View style={styles.form}>
          {!!formError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{formError}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(v) => { setPassword(v); setFormError(''); }}
                placeholder="Enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setFormError(''); }}
                placeholder="Re-enter new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
            </View>
          </View>

          <Pressable
            style={[styles.resetButton, saving && styles.resetButtonDisabled]}
            onPress={handleSetPassword}
            disabled={saving}
          >
            <Text style={styles.resetButtonText}>{saving ? 'Saving...' : 'Update Password'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centerAll: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  verifyingText: { marginTop: 16, fontSize: 16, fontFamily: 'Inter-Medium', color: '#6B7280' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 40 },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  title: { fontSize: 32, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 24 },
  form: { flex: 1 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#374151', marginBottom: 8 },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1,
    borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', paddingLeft: 16,
  },
  inputIcon: { marginRight: 12 },
  passwordInput: { flex: 1, height: 56, fontSize: 16, fontFamily: 'Inter-Regular', color: '#1F2937' },
  eyeButton: { padding: 16 },
  errorBox: {
    width: '100%', backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FEE4E2',
    borderRadius: 12, padding: 14, marginBottom: 20,
  },
  errorText: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter-Medium', color: '#B42318', textAlign: 'center' },
  resetButton: {
    height: 56, backgroundColor: BRAND_PURPLE, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  resetButtonDisabled: { opacity: 0.6 },
  resetButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  successIcon: { marginBottom: 24 },
  successTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 16, textAlign: 'center' },
  successSubtitle: {
    fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280',
    textAlign: 'center', lineHeight: 24, marginBottom: 32,
  },
  primaryButton: {
    width: '100%', height: 56, backgroundColor: BRAND_PURPLE, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  primaryButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
});
