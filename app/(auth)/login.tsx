import React, { useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { signIn } from '@/lib/auth';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getFriendlyAuthError } from '@/lib/authMessages';
import { usePostHog } from 'posthog-react-native';

const BRAND_PURPLE = '#5A2D82';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();
  const posthog = usePostHog();

  const confirmedParam = Array.isArray(params.confirmed)
    ? params.confirmed[0]
    : params.confirmed;

  const [showConfirmedModal, setShowConfirmedModal] = useState(
    confirmedParam === 'true'
  );

  const handleLogin = async () => {
    setErrorMessage('');
    setNeedsEmailConfirmation(false);
    if (!email || !password) {
      setErrorMessage('Enter your email address and password.');
      return;
    }

    setLoading(true);

    const { data, error, needsConfirmation, email: userEmail } =
      await signIn({ email, password });

    if (error) {
      if (needsConfirmation) {
        setNeedsEmailConfirmation(true);
        setErrorMessage('Confirm your email address before signing in. Check your inbox or resend the confirmation email.');
      } else {
        posthog.captureException(new Error(error.message ?? 'Login failed'), { context: 'login' });
        setErrorMessage(getFriendlyAuthError(error, 'login'));
      }
    } else {
      posthog.identify(data?.user?.id || email, { $set: { email } })
      posthog.capture('user_signed_in', { email })
      router.replace('/');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />

      {showConfirmedModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Account Created</Text>
            <Text style={styles.modalText}>
              Your account has been successfully registered. You can now log in.
            </Text>

            <Pressable
              style={styles.modalButton}
              onPress={() => {
                setShowConfirmedModal(false);
                router.replace('/(auth)/login');
              }}
            >
              <Text style={styles.modalButtonText}>Back to Login</Text>
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Sign in to your Dritchwear account
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errorMessage && styles.inputError]}
              value={email}
              onChangeText={(value) => { setEmail(value); setErrorMessage(''); }}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={(value) => { setPassword(value); setErrorMessage(''); }}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </Pressable>
            </View>
          </View>

          {!!errorMessage && (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Sign-in unsuccessful</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
              {needsEmailConfirmation && (
                <Pressable
                  style={styles.errorAction}
                  onPress={() => router.push({ pathname: '/(auth)/resend-confirmation', params: { email } })}
                >
                  <Text style={styles.errorActionText}>Resend confirmation email</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.forgotPasswordContainer}>
            <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? 'Signing In...' : 'Sign In'}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text
                style={styles.footerLink}
                onPress={() => router.push('/(auth)/register')}
              >
                Sign Up
              </Text>
            </Text>
          </View>

          <View style={styles.helpSection}>
            <Text style={styles.helpText}>
              Need help with your account?{' '}
              <Text
                style={styles.helpLink}
                onPress={() => router.push('/(auth)/resend-confirmation')}
              >
                Resend confirmation email
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
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputError: { borderColor: '#B42318' },
  errorBanner: { backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', borderRadius: 12, padding: 14, marginBottom: 18 },
  errorTitle: { color: '#912018', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  errorMessage: { color: '#912018', fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  errorAction: { minHeight: 40, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 6 },
  errorActionText: { color: BRAND_PURPLE, fontFamily: 'Inter-SemiBold', fontSize: 13 },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  passwordInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  eyeButton: {
    padding: 16,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: BRAND_PURPLE,
  },
  loginButton: {
    height: 56,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  footerLink: {
    color: BRAND_PURPLE,
    fontFamily: 'Inter-SemiBold',
  },
  helpSection: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  helpText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  helpLink: {
    color: BRAND_PURPLE,
    fontFamily: 'Inter-SemiBold',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    elevation: 100,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    width: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: BRAND_PURPLE,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
});
