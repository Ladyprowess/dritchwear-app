import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Send, Users, User, Gift, AlertCircle, Bell } from 'lucide-react-native';

const notificationTypes = [
  { id: 'system', label: 'System Alert', icon: AlertCircle, color: '#EF4444' },
  { id: 'promo', label: 'Promotion', icon: Gift, color: '#F59E0B' },
  { id: 'custom', label: 'Custom Message', icon: Bell, color: '#7C3AED' },
];

const audienceOptions = [
  { id: 'all', label: 'All Users', icon: Users },
  { id: 'customers', label: 'Customers Only', icon: User },
];

export default function AdminNotificationsScreen() {
  const [selectedType, setSelectedType] = useState('custom');
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    setSending(true);

    try {
      // For "all users", set user_id to null (broadcast)
      // For "customers", we'll need to send individual notifications
      if (selectedAudience === 'all') {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: null, // Broadcast to all users
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
          });

        if (error) throw error;
      } else {
        // Get all customer user IDs
        const { data: customers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'customer');

        if (customers && customers.length > 0) {
          const notifications = customers.map(customer => ({
            user_id: customer.id,
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
          }));

          const { error } = await supabase
            .from('notifications')
            .insert(notifications);

          if (error) throw error;
        }
      }

      Alert.alert(
        'Success',
        'Notification sent successfully!',
        [{ text: 'OK', onPress: () => {
          setTitle('');
          setMessage('');
        }}]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const selectedTypeConfig = notificationTypes.find(type => type.id === selectedType);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Send Notifications</Text>
        <Text style={styles.headerSubtitle}>
          Communicate with your users instantly
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Notification Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Type</Text>
          <View style={styles.typeContainer}>
            {notificationTypes.map((type) => (
              <Pressable
                key={type.id}
                style={[
                  styles.typeCard,
                  selectedType === type.id && styles.typeCardActive
                ]}
                onPress={() => setSelectedType(type.id)}
              >
                <View style={[styles.typeIcon, { backgroundColor: `${type.color}20` }]}>
                  <type.icon size={20} color={type.color} />
                </View>
                <Text
                  style={[
                    styles.typeLabel,
                    selectedType === type.id && styles.typeLabelActive
                  ]}
                >
                  {type.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Audience Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send To</Text>
          <View style={styles.audienceContainer}>
            {audienceOptions.map((option) => (
              <Pressable
                key={option.id}
                style={[
                  styles.audienceCard,
                  selectedAudience === option.id && styles.audienceCardActive
                ]}
                onPress={() => setSelectedAudience(option.id)}
              >
                <option.icon 
                  size={20} 
                  color={selectedAudience === option.id ? '#7C3AED' : '#6B7280'} 
                />
                <Text
                  style={[
                    styles.audienceLabel,
                    selectedAudience === option.id && styles.audienceLabelActive
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Message Composition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Message Details</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter notification title"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
            />
            <Text style={styles.characterCount}>{title.length}/100</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Enter your message here..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>{message.length}/500</Text>
          </View>
        </View>

        {/* Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View style={[styles.previewIcon, { backgroundColor: `${selectedTypeConfig?.color}20` }]}>
                {selectedTypeConfig && (
                  <selectedTypeConfig.icon size={16} color={selectedTypeConfig.color} />
                )}
              </View>
              <View style={styles.previewContent}>
                <Text style={styles.previewTitle}>
                  {title || 'Notification Title'}
                </Text>
                <Text style={styles.previewMessage}>
                  {message || 'Your notification message will appear here...'}
                </Text>
                <Text style={styles.previewTime}>Just now</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Send Button */}
        <View style={styles.sendContainer}>
          <Pressable
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendNotification}
            disabled={sending}
          >
            <Send size={20} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>
              {sending ? 'Sending...' : 'Send Notification'}
            </Text>
          </Pressable>
          
          <Text style={styles.sendNote}>
            This will send to {selectedAudience === 'all' ? 'all users' : 'customers only'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  typeCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FEFBFF',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    textAlign: 'center',
  },
  typeLabelActive: {
    color: '#7C3AED',
  },
  audienceContainer: {
    gap: 12,
  },
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  audienceCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FEFBFF',
  },
  audienceLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 12,
  },
  audienceLabelActive: {
    color: '#7C3AED',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
  },
  characterCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  previewContent: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  previewMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  previewTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  sendContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  sendNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
});