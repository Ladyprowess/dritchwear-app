import React, { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { signUp } from '@/lib/auth';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import PasswordStrengthIndicator from '@/components/PasswordStrengthIndicator';
import { getFriendlyAuthError } from '@/lib/authMessages';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { usePostHog } from 'posthog-react-native';

const BRAND_PURPLE = '#5A2D82';
const PENDING_REFERRAL_CODE_KEY = 'pending_referral_code';

async function readStoredReferralCode() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.localStorage.getItem(PENDING_REFERRAL_CODE_KEY)?.trim().toUpperCase() || '';
    }
    return (await AsyncStorage.getItem(PENDING_REFERRAL_CODE_KEY))?.trim().toUpperCase() || '';
  } catch (error) {
    console.log('Unable to read stored referral code:', error);
  }

  return '';
}

async function storeReferralCode(referralCode: string) {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_REFERRAL_CODE_KEY, referralCode);
      return;
    }
    await AsyncStorage.setItem(PENDING_REFERRAL_CODE_KEY, referralCode);
  } catch (error) {
    console.log('Unable to store referral code:', error);
  }
}

async function clearStoredReferralCode() {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
      return;
    }
    await AsyncStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
  } catch (error) {
    console.log('Unable to clear referral code:', error);
  }
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [referralMessage, setReferralMessage] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams();
  const posthog = usePostHog();

  const referralParam = Array.isArray(params.ref)
    ? params.ref[0]
    : params.ref;

  useEffect(() => {
    let active = true;

    const syncReferralCode = async () => {
      const codeFromParam = referralParam
        ? String(referralParam).trim().toUpperCase()
        : '';
      const referralCode = codeFromParam || await readStoredReferralCode();

      if (!referralCode || !active) return;
      if (codeFromParam) await storeReferralCode(codeFromParam);

      setFormData((prev) => ({
        ...prev,
        referralCode,
      }));
    };

    void syncReferralCode();

    return () => {
      active = false;
    };
  }, [referralParam]);

  const handleRegister = async () => {
    setErrorMessage('');
    const { fullName, email, phone, password, confirmPassword, referralCode } = formData;

    if (!fullName || !email || !phone || !password) {
      setErrorMessage('Fill in every required field before continuing.');
      return;
    }

    let phoneValue = phone.replace(/[^\d+]/g, '');

    if (!phoneValue.startsWith('+')) {
      setErrorMessage('Include your country code in the phone number, for example +2348012345678.');
      return;
    }

    if (!/^\+[1-9]\d{9,14}$/.test(phoneValue)) {
      setErrorMessage('Enter a valid phone number with its country code.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    const normalizedReferralCode = referralCode.trim().toUpperCase();
    if (normalizedReferralCode) {
      setReferralMessage('Checking referral code…');
      const { data: referralIsValid, error: referralError } = await supabase.rpc(
        'validate_referral_code',
        { p_code: normalizedReferralCode }
      );

      if (referralError) {
        setLoading(false);
        setReferralMessage('');
        setErrorMessage('We could not verify the referral code. Check your connection and try again.');
        return;
      }

      if (!referralIsValid) {
        setLoading(false);
        setReferralMessage('This referral code is not valid. Ask the sender for a new link.');
        setErrorMessage('The referral code could not be applied. Correct or remove it before continuing.');
        return;
      }

      setReferralMessage('Referral code applied. Your inviter will receive credit after signup.');
    }

    const { data, error, needsConfirmation, email: userEmail } = await signUp({
      email,
      password,
      fullName,
      phone: phoneValue,
      referralCode: normalizedReferralCode || undefined,
    });

    if (error) {
      setErrorMessage(getFriendlyAuthError(error, 'register'));
    } else if (needsConfirmation) {
      await clearStoredReferralCode();
      posthog.identify(data?.user?.id || email, { $set: { email, name: fullName }, $set_once: { registration_date: new Date().toISOString() } })
      posthog.capture('user_registered', { email, has_referral_code: !!normalizedReferralCode })
      router.replace({
        pathname: '/(auth)/confirm-email',
        params: { email: userEmail },
      });
    } else {
      await clearStoredReferralCode();
      posthog.identify(data?.user?.id || email, { $set: { email, name: fullName }, $set_once: { registration_date: new Date().toISOString() } })
      posthog.capture('user_registered', { email, has_referral_code: !!normalizedReferralCode })
      router.replace('/');
    }

    setLoading(false);
  };

  const updateFormData = (field: string, value: string) => {
    setErrorMessage('');
    if (field === 'referralCode') setReferralMessage('');
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>

          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join Dritchwear and start your fashion journey
          </Text>
        </View>

        <View style={styles.form}>
          {!!errorMessage && (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorTitle}>Account not created</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>
          )}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.fullName}
              onChangeText={(value) => updateFormData('fullName', value)}
              placeholder="Enter your full name"
              placeholderTextColor="#9CA3AF"
              autoComplete="name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Phone Number * <Text style={styles.hint}>(include country code, e.g. +234)</Text>
            </Text>

            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(value) => updateFormData('phone', value)}
              placeholder="Enter your phone number"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              autoComplete="tel"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Referral Code</Text>
            <TextInput
              style={styles.input}
              value={formData.referralCode}
              onChangeText={(value) => updateFormData('referralCode', value.toUpperCase())}
              placeholder="Enter a referral code if you have one"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
            {!!referralMessage && (
              <Text
                accessibilityRole="text"
                style={[
                  styles.referralMessage,
                  referralMessage.includes('not valid') && styles.referralMessageError,
                ]}
              >
                {referralMessage}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.password}
                onChangeText={(value) => updateFormData('password', value)}
                onFocus={() => setShowPasswordStrength(true)}
                onBlur={() => setShowPasswordStrength(false)}
                placeholder="Create a password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                autoComplete="password-new"
              />
              <Pressable style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </Pressable>
            </View>
            {(showPasswordStrength || formData.password) && (
              <PasswordStrengthIndicator password={formData.password} />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.confirmPassword}
                onChangeText={(value) => updateFormData('confirmPassword', value)}
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirmPassword}
                autoComplete="password-new"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#9CA3AF" />
                ) : (
                  <Eye size={20} color="#9CA3AF" />
                )}
              </Pressable>
            </View>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          <Pressable
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text style={styles.footerLink} onPress={() => router.push('/(auth)/login')}>
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
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  referralMessage: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Inter-Medium',
    color: '#5A2D82',
  },
  referralMessageError: {
    color: '#B42318',
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
  errorText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#EF4444',
    marginTop: 6,
  },
  errorBanner: { backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', borderRadius: 12, padding: 14, marginBottom: 20 },
  errorTitle: { color: '#912018', fontFamily: 'Inter-SemiBold', fontSize: 14 },
  errorMessage: { color: '#912018', fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, marginTop: 4 },
  registerButton: {
    height: 56,
    backgroundColor: BRAND_PURPLE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
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
});
