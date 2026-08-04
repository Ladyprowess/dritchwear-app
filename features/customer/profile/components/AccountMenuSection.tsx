import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, Lock, HelpCircle } from 'lucide-react-native';
import { styles } from '../styles';

interface AccountMenuSectionProps {
  onNotificationSettings: () => void;
  onChangePassword: () => void;
  onMessaging: () => void;
}

export function AccountMenuSection({ onNotificationSettings, onChangePassword, onMessaging }: AccountMenuSectionProps) {
  const menuItems = [
    { icon: Bell, title: 'Notification Settings', subtitle: 'Manage push and cart reminders', onPress: onNotificationSettings },
    { icon: Lock, title: 'Change Password', subtitle: 'Update your password', onPress: onChangePassword },
    { icon: HelpCircle, title: 'Messaging', subtitle: 'Chat with us & get help', onPress: onMessaging },
  ];

  return (
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
  );
}
