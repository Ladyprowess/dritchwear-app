import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Lock, Eye, EyeOff } from 'lucide-react-native';
import { styles } from '../styles';

interface PasswordChangeSectionProps {
  newPassword: string;
  onNewPasswordChange: (text: string) => void;
  showNewPassword: boolean;
  onToggleShowNewPassword: () => void;
  confirmPassword: string;
  onConfirmPasswordChange: (text: string) => void;
  showConfirmPassword: boolean;
  onToggleShowConfirmPassword: () => void;
}

export function PasswordChangeSection({
  newPassword,
  onNewPasswordChange,
  showNewPassword,
  onToggleShowNewPassword,
  confirmPassword,
  onConfirmPasswordChange,
  showConfirmPassword,
  onToggleShowConfirmPassword,
}: PasswordChangeSectionProps) {
  return (
    <>
      <View style={styles.detailItem}>
        <View style={styles.detailHeader}>
          <Lock size={20} color="#6B7280" />
          <Text style={styles.detailLabel}>New Password</Text>
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            value={newPassword}
            onChangeText={onNewPasswordChange}
            placeholder="Enter new password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showNewPassword}
          />
          <Pressable style={styles.eyeButton} onPress={onToggleShowNewPassword}>
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
            value={confirmPassword}
            onChangeText={onConfirmPasswordChange}
            placeholder="Confirm new password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={!showConfirmPassword}
          />
          <Pressable style={styles.eyeButton} onPress={onToggleShowConfirmPassword}>
            {showConfirmPassword ? (
              <EyeOff size={16} color="#9CA3AF" />
            ) : (
              <Eye size={16} color="#9CA3AF" />
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}
