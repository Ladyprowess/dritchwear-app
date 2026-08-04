import React from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { usePoints } from '@/contexts/PointsContext';

import { useProfileForm } from '@/features/customer/profile/hooks/useProfileForm';
import { usePasswordChange } from '@/features/customer/profile/hooks/usePasswordChange';
import { useSignOut } from '@/features/customer/profile/hooks/useSignOut';
import { useReferralStats } from '@/features/customer/profile/hooks/useReferralStats';

import { ProfileHeader } from '@/features/customer/profile/components/ProfileHeader';
import { ProfileCard } from '@/features/customer/profile/components/ProfileCard';
import { WalletQuickActions } from '@/features/customer/profile/components/WalletQuickActions';
import { LoyaltyPointsCard } from '@/features/customer/profile/components/LoyaltyPointsCard';
import { PasswordChangeSection } from '@/features/customer/profile/components/PasswordChangeSection';
import { PersonalInfoSection } from '@/features/customer/profile/components/PersonalInfoSection';
import { ServicesSection } from '@/features/customer/profile/components/ServicesSection';
import { AccountMenuSection } from '@/features/customer/profile/components/AccountMenuSection';
import { SignOutButton } from '@/features/customer/profile/components/SignOutButton';
import { LegalSection } from '@/features/customer/profile/components/LegalSection';
import { DangerZoneSection } from '@/features/customer/profile/components/DangerZoneSection';
import { ReferralDetailsModal } from '@/features/customer/profile/components/ReferralDetailsModal';
import { styles } from '@/features/customer/profile/styles';

export default function ProfileScreen() {
  const { profile, user, refreshProfile, hardSignOut } = useAuth();
  const { pointsBalance } = usePoints();
  const router = useRouter();

  const {
    editing,
    setEditing,
    formData,
    setFormData,
    parsedLoc,
    handleSave,
    handleCancel,
    handleCurrencyChange,
  } = useProfileForm(profile, refreshProfile);

  const {
    changingPassword,
    setChangingPassword,
    passwordData,
    setPasswordData,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handlePasswordChange,
    cancelPasswordChange,
  } = usePasswordChange();

  const { isSigningOut, confirmAndSignOut, handleSignOut } = useSignOut(user, hardSignOut);

  const {
    referralStats,
    referralCode,
    showReferralDetails,
    setShowReferralDetails,
    handleCopyReferralLink,
    handleShareReferralLink,
  } = useReferralStats(user?.id, profile?.referral_code);

  // Once the user is signed out, don't keep rendering the profile page.
  if (!user) {
    return null;
  }

  // Show loading state if profile is not loaded yet - but always show sign out
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.signOutFallback,
            pressed && styles.signOutButtonPressed,
            isSigningOut && styles.signOutButtonDisabled,
          ]}
          android_ripple={{ color: '#FEE2E2' }}
          disabled={isSigningOut}
          onPress={confirmAndSignOut}
        >
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.signOutFallbackText}>
            {isSigningOut ? 'Signing Out...' : 'Sign Out'}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ProfileHeader
            editing={editing}
            changingPassword={changingPassword}
            onEdit={() => setEditing(true)}
            onCancelEdit={handleCancel}
            onCancelPasswordChange={cancelPasswordChange}
            onSave={handleSave}
            onSavePassword={handlePasswordChange}
          />

          <ProfileCard profile={profile} />

          {!editing && !changingPassword && (
            <WalletQuickActions
              onFundWallet={() => router.push('/(customer)/fund-wallet')}
              onWalletHistory={() => router.push('/(customer)/wallet-history')}
            />
          )}

          {!editing && !changingPassword && (
            <LoyaltyPointsCard
              profile={profile}
              pointsBalance={pointsBalance}
              onRedeem={() => router.push('/(customer)/bill-payment')}
            />
          )}

          <View style={styles.detailsContainer}>
            <Text style={styles.sectionTitle}>
              {changingPassword ? 'Change Password' : 'Personal Information'}
            </Text>

            <View style={styles.detailsCard}>
              {changingPassword ? (
                <PasswordChangeSection
                  newPassword={passwordData.newPassword}
                  onNewPasswordChange={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                  showNewPassword={showNewPassword}
                  onToggleShowNewPassword={() => setShowNewPassword(!showNewPassword)}
                  confirmPassword={passwordData.confirmPassword}
                  onConfirmPasswordChange={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                  showConfirmPassword={showConfirmPassword}
                  onToggleShowConfirmPassword={() => setShowConfirmPassword(!showConfirmPassword)}
                />
              ) : (
                <PersonalInfoSection
                  profile={profile}
                  editing={editing}
                  formData={formData}
                  onFormDataChange={setFormData}
                  parsedLoc={parsedLoc}
                  onCurrencyChange={handleCurrencyChange}
                />
              )}
            </View>
          </View>

          {!editing && !changingPassword && (
            <ServicesSection
              onInviteAndEarn={() => setShowReferralDetails(true)}
              onGiftCards={() => router.push('/(customer)/gift-cards')}
            />
          )}

          {!editing && !changingPassword && (
            <AccountMenuSection
              onNotificationSettings={() => router.push('/(customer)/notification-settings')}
              onChangePassword={() => setChangingPassword(true)}
              onMessaging={() => router.push('/(customer)/help-support')}
            />
          )}

          {!editing && !changingPassword && (
            <SignOutButton isSigningOut={isSigningOut} onPress={handleSignOut} />
          )}

          {!editing && !changingPassword && <LegalSection />}

          {!editing && !changingPassword && <DangerZoneSection profile={profile} />}
        </ScrollView>

        <ReferralDetailsModal
          visible={showReferralDetails}
          onClose={() => setShowReferralDetails(false)}
          referralCode={referralCode}
          referralStats={referralStats}
          onShare={handleShareReferralLink}
          onCopy={handleCopyReferralLink}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
