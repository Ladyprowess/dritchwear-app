import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { styles } from '../styles';

interface SignOutButtonProps {
  isSigningOut: boolean;
  onPress: () => void;
}

export function SignOutButton({ isSigningOut, onPress }: SignOutButtonProps) {
  return (
    <View style={styles.signOutContainer}>
      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutButtonPressed,
          isSigningOut && styles.signOutButtonDisabled,
        ]}
        android_ripple={{ color: '#FEE2E2' }}
        onPress={onPress}
        disabled={isSigningOut}
      >
        <LogOut size={20} color="#EF4444" />
        <Text style={styles.signOutText}>
          {isSigningOut ? 'Signing Out...' : 'Sign Out'}
        </Text>
      </Pressable>
    </View>
  );
}
