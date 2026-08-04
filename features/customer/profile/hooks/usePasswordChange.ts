import { useState } from 'react';
import { Alert } from 'react-native';
import { updatePassword } from '@/lib/auth';

export function usePasswordChange() {
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    // updatePassword() never throws - it always resolves { error } - so the
    // result has to be checked explicitly or a real failure (weak/reused
    // password, expired session) gets reported to the user as a success.
    const { error } = await updatePassword(passwordData.newPassword);
    if (error) {
      Alert.alert('Error', error.message || 'Failed to update password');
      return;
    }
    setChangingPassword(false);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    Alert.alert('Success', 'Password updated successfully');
  };

  const cancelPasswordChange = () => {
    setChangingPassword(false);
    setPasswordData({ newPassword: '', confirmPassword: '' });
  };

  return {
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
  };
}
