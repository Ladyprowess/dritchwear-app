import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Send, Users, User, Gift, CircleAlert as AlertCircle, Bell, CalendarClock, Search, X, Check } from 'lucide-react-native';

function showSupabaseError(error: any, title: string) {
  const message = error?.message || 'An error occurred';
  Alert.alert(title, message);
}

interface Customer {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  location: string | null;
}

const notificationTypes = [
  { id: 'system', label: 'System Alert', icon: AlertCircle, color: '#EF4444' },
  { id: 'promo', label: 'Promotion', icon: Gift, color: '#F59E0B' },
  { id: 'custom', label: 'Custom Message', icon: Bell, color: '#5A2D82' },
];

const audienceOptions = [
  { id: 'all', label: 'All Users', icon: Users },
  { id: 'customers', label: 'Customers Only', icon: User },
  { id: 'individual', label: 'Individual Customer', icon: User },
];

export default function AdminNotificationsScreen() {
  const [selectedType, setSelectedType] = useState('custom');
  const [selectedAudience, setSelectedAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const fetchCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, location')
        .eq('role', 'customer')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      Alert.alert('Error', 'Failed to load customers');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleAudienceChange = (audienceId: string) => {
    setSelectedAudience(audienceId);
    if (audienceId === 'individual') {
      fetchCustomers();
      setShowCustomerModal(true);
    } else {
      setSelectedCustomers([]);
    }
  };

  const toggleCustomerSelection = (customer: Customer) => {
    setSelectedCustomers(prev => {
      const isSelected = prev.some(c => c.id === customer.id);
      if (isSelected) {
        return prev.filter(c => c.id !== customer.id);
      } else {
        return [...prev, customer];
      }
    });
  };

  const filteredCustomers = customers.filter(customer => {
    if (!customerSearchQuery) return true;
    const query = customerSearchQuery.toLowerCase();
    return (
      customer.full_name?.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.phone?.includes(query)
    );
  });

  const sendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill in both title and message');
      return;
    }

    if (url.trim() && !/^https?:\/\/.+/i.test(url.trim())) {
      Alert.alert('Invalid link', 'Link must start with http:// or https://');
      return;
    }

    if (selectedAudience === 'individual' && selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    setSending(true);

    try {
      let userIds: string[] = [];
      let sendToAll = false;

      if (selectedAudience === 'individual') {
        userIds = selectedCustomers.map(c => c.id);
      } else if (selectedAudience === 'customers') {
        const { data: customers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'customer');
        userIds = customers?.map(c => c.id) || [];
      } else {
        sendToAll = true;
      }

      const scheduleCandidate = scheduleEnabled ? new Date(`${scheduleDate}T${scheduleTime}`) : null;
      const scheduledAt = scheduleCandidate && Number.isFinite(scheduleCandidate.getTime()) ? scheduleCandidate.toISOString() : null;
      if (scheduleEnabled && (!scheduledAt || scheduleCandidate!.getTime() <= Date.now() + 60_000)) throw new Error('Choose a schedule at least 1 minute in the future.');
      if (scheduleEnabled) {
        const { data: auth } = await supabase.auth.getUser();
        const { error: scheduleError } = await supabase.from('scheduled_communications').insert({
          created_by: auth.user?.id, channel: 'push', scheduled_at: scheduledAt,
          payload: { userIds, title: title.trim(), message: message.trim(), type: selectedType, sendToAll, url: url.trim() || null },
        });
        if (scheduleError) throw scheduleError;
        Alert.alert('Scheduled', `Notification will send ${new Date(scheduledAt!).toLocaleString()}.`);
        setTitle(''); setMessage(''); setUrl(''); setSelectedCustomers([]); setScheduleEnabled(false); setScheduleDate(''); setScheduleTime('');
        return;
      }

      const notifications = selectedAudience === 'individual'
        ? selectedCustomers.map(customer => ({
            user_id: customer.id,
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
            url: url.trim() ? url.trim() : null,
          }))
        : selectedAudience === 'customers'
        ? (userIds.map(id => ({
            user_id: id,
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
            url: url.trim() ? url.trim() : null,
          })))
        : {
            user_id: null,
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
            url: url.trim() ? url.trim() : null,
          };

      const { error: dbError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (dbError) throw dbError;

      const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notifications', {
        body: { userIds, title: title.trim(), message: message.trim(), type: selectedType, sendToAll, url: url.trim() || null },
      });

      const supabaseUrl = '';
      const anonKey = '';

      // Add app icon URL to the notification payload
      /* legacy direct fetch removed */ void (false && fetch(
        `${supabaseUrl}/functions/v1/send-push-notifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            userIds,
            title: title.trim(),
            message: message.trim(),
            type: selectedType,
            sendToAll,
            // Add icon URL - update this with your actual app icon URL
            icon: 'https://github.com/Ladyprowess/store-image/blob/main/images/icon.png?raw=true', // Replace with your app's icon URL
            // Or use a relative path if the icon is bundled with your app
            // icon: require('../../assets/icon.png'), // This won't work in the API call
          }),
        }
      ));

      if (pushError) console.warn('Push notification warning:', pushError);

      Alert.alert(
        'Success',
        `Notification saved.\n\nPush notifications sent: ${pushResult?.sent || 0}`,
        [{ text: 'OK', onPress: () => {
          setTitle('');
          setMessage('');
          setUrl('');
          setSelectedCustomers([]);
        }}]
      );
    } catch (error: any) {
      console.error('❌ Send notification error:', error);
      showSupabaseError(error, 'Failed to send notification');
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
                onPress={() => handleAudienceChange(option.id)}
              >
                <option.icon 
                  size={20} 
                  color={selectedAudience === option.id ? '#5A2D82' : '#6B7280'} 
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

        {/* Selected Customers Display */}
        {selectedAudience === 'individual' && selectedCustomers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Selected Customers ({selectedCustomers.length})
            </Text>
            <View style={styles.selectedCustomersContainer}>
              {selectedCustomers.map((customer) => (
                <View key={customer.id} style={styles.selectedCustomerChip}>
                  <Text style={styles.selectedCustomerName}>
                    {customer.full_name || customer.email}
                  </Text>
                  <Pressable
                    style={styles.removeCustomerButton}
                    onPress={() => toggleCustomerSelection(customer)}
                  >
                    <X size={14} color="#6B7280" />
                  </Pressable>
                </View>
              ))}
              <Pressable
                style={styles.addMoreCustomersButton}
                onPress={() => setShowCustomerModal(true)}
              >
                <Text style={styles.addMoreCustomersText}>+ Add More</Text>
              </Pressable>
            </View>
          </View>
        )}

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
      maxLength={1000}
    />
    <Text style={styles.characterCount}>{message.length}/1000</Text>
  </View>

  {/* ✅ Link input MUST be here (inside the same section) */}
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>Link (optional)</Text>
    <TextInput
      style={styles.titleInput}
      value={url}
      onChangeText={setUrl}
      placeholder="https://example.com"
      placeholderTextColor="#9CA3AF"
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="url"
      maxLength={300}
    />
    <Text style={styles.characterCount}>{url.length}/300</Text>
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
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: scheduleEnabled }} style={[styles.scheduleToggle, scheduleEnabled && styles.scheduleToggleActive]} onPress={() => setScheduleEnabled(value => !value)}><CalendarClock size={19} color="#5A2D82" /><View><Text style={styles.scheduleTitle}>{scheduleEnabled ? 'Scheduled delivery' : 'Send now'}</Text><Text style={styles.sendNote}>Schedule uses your current local time.</Text></View></Pressable>
          {scheduleEnabled && <View style={styles.scheduleFields}><View style={{ flex: 1 }}><Text style={styles.inputLabel}>Date</Text><TextInput style={styles.titleInput} value={scheduleDate} onChangeText={setScheduleDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" /></View><View style={{ flex: 1 }}><Text style={styles.inputLabel}>Time</Text><TextInput style={styles.titleInput} value={scheduleTime} onChangeText={setScheduleTime} placeholder="HH:MM" placeholderTextColor="#9CA3AF" /></View></View>}
          <Pressable
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendNotification}
            disabled={sending}
          >
            <Send size={20} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>
              {sending ? 'Working...' : scheduleEnabled ? 'Schedule Notification' : 'Send Notification'}
            </Text>
          </Pressable>
          
          <Text style={styles.sendNote}>
            This will send to {
              selectedAudience === 'all' ? 'all users' : 
              selectedAudience === 'customers' ? 'all customers' :
              `${selectedCustomers.length} selected customer${selectedCustomers.length !== 1 ? 's' : ''}`
            }
          </Text>
        </View>
      </ScrollView>

      {/* Customer Selection Modal */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Customers</Text>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowCustomerModal(false)}
            >
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                value={customerSearchQuery}
                onChangeText={setCustomerSearchQuery}
                placeholder="Search customers..."
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Selected Count */}
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionCount}>
              {selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected
            </Text>
            {selectedCustomers.length > 0 && (
              <Pressable
                style={styles.clearSelectionButton}
                onPress={() => setSelectedCustomers([])}
              >
                <Text style={styles.clearSelectionText}>Clear All</Text>
              </Pressable>
            )}
          </View>

          {/* Customer List */}
          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedCustomers.some(c => c.id === item.id);
              return (
                <Pressable
                  style={[
                    styles.customerItem,
                    isSelected && styles.customerItemSelected
                  ]}
                  onPress={() => toggleCustomerSelection(item)}
                >
                  <View style={styles.customerInfo}>
                    <View style={styles.customerAvatar}>
                      <Text style={styles.customerAvatarText}>
                        {(item.full_name || item.email).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.customerDetails}>
                      <Text style={styles.customerName}>
                        {item.full_name || 'No name provided'}
                      </Text>
                      <Text style={styles.customerEmail}>{item.email}</Text>
                      {item.phone && (
                        <Text style={styles.customerPhone}>{item.phone}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.customerSelection}>
                    {isSelected && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            }}
            style={styles.customerList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyCustomers}>
                <Text style={styles.emptyCustomersText}>
                  {customerSearchQuery ? 'No customers match your search' : 'No customers found'}
                </Text>
              </View>
            }
          />

          {/* Modal Actions */}
          <View style={styles.modalActions}>
            <Pressable
              style={styles.modalCancelButton}
              onPress={() => setShowCustomerModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modalConfirmButton,
                selectedCustomers.length === 0 && styles.modalConfirmButtonDisabled
              ]}
              onPress={() => setShowCustomerModal(false)}
              disabled={selectedCustomers.length === 0}
            >
              <Text style={styles.modalConfirmText}>
                Select {selectedCustomers.length} Customer{selectedCustomers.length !== 1 ? 's' : ''}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
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
    borderColor: '#5A2D82',
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
    color: '#5A2D82',
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
    borderColor: '#5A2D82',
    backgroundColor: '#FEFBFF',
  },
  audienceLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginLeft: 12,
  },
  audienceLabelActive: {
    color: '#5A2D82',
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
  scheduleToggle: {
    minHeight: 56,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleToggleActive: { borderColor: '#5A2D82', backgroundColor: '#F3EFF7' },
  scheduleTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#1F2937' },
  scheduleFields: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5A2D82',
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
  selectedCustomersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedCustomerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A2D8220',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  selectedCustomerName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  removeCustomerButton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMoreCustomersButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  addMoreCustomersText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectionCount: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  clearSelectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
  },
  clearSelectionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  customerList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: '#F9FAFB',
  },
  customerItemSelected: {
    backgroundColor: '#5A2D8210',
    borderWidth: 1,
    borderColor: '#5A2D82',
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  customerAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  customerEmail: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 1,
  },
  customerPhone: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  customerSelection: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCustomers: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCustomersText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#5A2D82',
    alignItems: 'center',
  },
  modalConfirmButtonDisabled: {
    opacity: 0.6,
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
