import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { signOut, updateProfile, updatePassword } from '@/lib/auth';
import { useRouter } from 'expo-router';
import { 
  User, 
  Phone, 
  MapPin, 
  Wallet, 
  Settings, 
  HelpCircle, 
  LogOut, 
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  History,
  Globe
} from 'lucide-react-native';
import CurrencySelector from '@/components/CurrencySelector';
import { formatCurrency, convertFromNGN } from '@/lib/currency';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    location: profile?.location || '',
    preferred_currency: profile?.preferred_currency || 'NGN',
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Show loading state if profile is not loaded yet
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      await refreshProfile();
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      location: profile.location || '',
      preferred_currency: profile.preferred_currency || 'NGN',
    });
    setEditing(false);
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      await updatePassword(passwordData.newPassword);
      setChangingPassword(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
      Alert.alert('Success', 'Password updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update password');
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/welcome');
          },
        },
      ]
    );
  };

  const handleWalletHistory = () => {
    router.push('/(customer)/wallet-history');
  };

  const handleSettings = () => {
    Alert.alert(
      'Settings',
      'Settings feature will be implemented soon!',
      [{ text: 'OK' }]
    );
  };

  const handleHelpSupport = () => {
    router.push('/(customer)/help-support');
  };

  const handleCurrencyChange = (currencyCode: string) => {
    setFormData(prev => ({ ...prev, preferred_currency: currencyCode }));
  };

  // Get wallet balance in preferred currency
  const walletBalanceInPreferredCurrency = profile.preferred_currency === 'NGN' ? 
    profile.wallet_balance : 
    convertFromNGN(profile.wallet_balance, profile.preferred_currency);

  const menuItems = [
    { icon: History, title: 'Wallet History', subtitle: 'View all transactions', onPress: handleWalletHistory },
    { icon: Lock, title: 'Change Password', subtitle: 'Update your password', onPress: () => setChangingPassword(true) },
    { icon: Settings, title: 'Settings', subtitle: 'App preferences', onPress: handleSettings },
    { icon: HelpCircle, title: 'Help & Support', subtitle: 'Get assistance', onPress: handleHelpSupport },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        {!editing && !changingPassword ? (
          <Pressable style={styles.editButton} onPress={() => setEditing(true)}>
            <Edit3 size={16} color="#7C3AED" />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
        ) : (
          <View style={styles.editActions}>
            <Pressable 
              style={styles.cancelButton} 
              onPress={() => {
                if (changingPassword) {
                  setChangingPassword(false);
                  setPasswordData({ newPassword: '', confirmPassword: '' });
                } else {
                  handleCancel();
                }
              }}
            >
              <X size={16} color="#6B7280" />
            </Pressable>
            <Pressable 
              style={styles.saveButton} 
              onPress={changingPassword ? handlePasswordChange : handleSave}
            >
              <Save size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(profile.full_name || profile.email || 'U')
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.userName}>
              {profile.full_name || 'Add your name'}
            </Text>
            <Text style={styles.userEmail}>{profile.email}</Text>
            
            {/* Wallet Balance */}
            <View style={styles.walletContainer}>
              <Wallet size={16} color="#7C3AED" />
              <Text style={styles.walletBalance}>
                {formatCurrency(walletBalanceInPreferredCurrency, profile.preferred_currency || 'NGN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile Details or Password Change */}
        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>
            {changingPassword ? 'Change Password' : 'Personal Information'}
          </Text>
          
          <View style={styles.detailsCard}>
            {changingPassword ? (
              <>
                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <Lock size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>New Password</Text>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.newPassword}
                      onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                      placeholder="Enter new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showNewPassword}
                    />
                    <Pressable
                      style={styles.eyeButton}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff size={16} color="#9CA3AF" />
                      ) : (
                        <Eye size={16} color="#9CA3AF" />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <Lock size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>Confirm New Password</Text>
                  </View>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={passwordData.confirmPassword}
                      onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showConfirmPassword}
                    />
                    <Pressable
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} color="#9CA3AF" />
                      ) : (
                        <Eye size={16} color="#9CA3AF" />
                      )}
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <User size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>Full Name</Text>
                  </View>
                  {editing ? (
                    <TextInput
                      style={styles.detailInput}
                      value={formData.full_name}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, full_name: text }))}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9CA3AF"
                    />
                  ) : (
                    <Text style={styles.detailValue}>
                      {profile.full_name || 'Not provided'}
                    </Text>
                  )}
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <Phone size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>Phone Number</Text>
                  </View>
                  {editing ? (
                    <TextInput
                      style={styles.detailInput}
                      value={formData.phone}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={styles.detailValue}>
                      {profile.phone || 'Not provided'}
                    </Text>
                  )}
                </View>

                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <MapPin size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>Location</Text>
                  </View>
                  {editing ? (
                    <TextInput
                      style={styles.detailInput}
                      value={formData.location}
                      onChangeText={(text) => setFormData(prev => ({ ...prev, location: text }))}
                      placeholder="Enter your location"
                      placeholderTextColor="#9CA3AF"
                    />
                  ) : (
                    <Text style={styles.detailValue}>
                      {profile.location || 'Not provided'}
                    </Text>
                  )}
                </View>

                {/* Currency Preference */}
                <View style={styles.detailItem}>
                  <View style={styles.detailHeader}>
                    <Globe size={20} color="#6B7280" />
                    <Text style={styles.detailLabel}>Preferred Currency</Text>
                  </View>
                  {editing ? (
                    <CurrencySelector
                      selectedCurrency={formData.preferred_currency}
                      onCurrencyChange={handleCurrencyChange}
                      showLabel={false}
                      style={styles.currencySelector}
                    />
                  ) : (
                    <Text style={styles.detailValue}>
                      {profile.preferred_currency || 'NGN'}
                    </Text>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {/* Menu Items - Only show when not editing */}
        {!editing && !changingPassword && (
          <View style={styles.menuContainer}>
            <Text style={styles.sectionTitle}>Account</Text>
            
            <View style={styles.menuCard}>
              {menuItems.map((item, index) => (
                <Pressable 
                  key={index} 
                  style={[styles.menuItem, index === menuItems.length - 1 && styles.lastMenuItem]}
                  onPress={item.onPress}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIconContainer}>
                      <item.icon size={20} color="#6B7280" />
                    </View>
                    <View style={styles.menuTextContainer}>
                      <Text style={styles.menuItemTitle}>{item.title}</Text>
                      <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Sign Out - Only show when not editing */}
        {!editing && !changingPassword && (
          <View style={styles.signOutContainer}>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut size={20} color="#EF4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  saveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  profileInfo: {
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 12,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  walletBalance: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  detailsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailItem: {
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  detailValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginLeft: 28,
  },
  detailInput: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    marginLeft: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    paddingBottom: 4,
  },
  eyeButton: {
    padding: 4,
  },
  currencySelector: {
    marginLeft: 28,
    marginTop: 8,
  },
  menuContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  signOutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  signOutText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
});