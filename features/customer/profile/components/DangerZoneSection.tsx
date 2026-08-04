import React from 'react';
import { Alert, Linking, Pressable, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import type { Profile } from '@/lib/auth';
import { styles } from '../styles';

interface DangerZoneSectionProps {
  profile: Profile;
}

export function DangerZoneSection({ profile }: DangerZoneSectionProps) {
  const tryOpenEmailClient = async (email: string) => {
    const subject = 'Account Deletion Request';
    const body = `Hi,

I would like to request the deletion of my account.

Email: ${profile.email}
Name: ${profile.full_name || 'Not provided'}

Please confirm once my account has been deleted.

Thank you.`;

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (supported) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert(
          'Email Client Not Available',
          `Please manually send an email to:\n\n${email}\n\nSubject: Account Deletion Request\n\nInclude your email (${profile.email}) in the message.`,
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert(
        'Contact Support',
        `Please send an email to:\n\n${email}\n\nSubject: Account Deletion Request\n\nInclude your account email (${profile.email}) in your request.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleDeleteAccount = () => {
    const supportEmail = 'dritchwear@gmail.com';

    Alert.alert(
      'Delete Account',
      'To delete your account, please contact our support team. Choose how you would like to proceed:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy Email Address',
          onPress: () => {
            Alert.alert(
              'Support Email',
              `Please email us at:\n\n${supportEmail}\n\nInclude your account email (${profile.email}) in the request.`,
              [
                {
                  text: 'Try Email App',
                  onPress: () => tryOpenEmailClient(supportEmail),
                },
                { text: 'OK' }
              ]
            );
          },
        },
        {
          text: 'Open Email App',
          style: 'destructive',
          onPress: () => tryOpenEmailClient(supportEmail),
        },
      ]
    );
  };

  return (
    <View style={styles.deleteAccountContainer}>
      <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
      <Pressable style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
        <View style={styles.deleteAccountContent}>
          <View style={styles.deleteAccountLeft}>
            <View style={styles.deleteIconContainer}>
              <Trash2 size={20} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.deleteAccountTitle}>Delete Account</Text>
              <Text style={styles.deleteAccountSubtitle}>Permanently delete your account</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
