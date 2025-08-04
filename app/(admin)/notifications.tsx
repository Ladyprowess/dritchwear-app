import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Send, Users, User, Gift, CircleAlert as AlertCircle, Bell, Search, X, Check } from 'lucide-react-native';

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
  { id: 'custom', label: 'Custom Message', icon: Bell, color: '#7C3AED' },
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
  const [sending, setSending] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Customer[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

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

    if (selectedAudience === 'individual' && selectedCustomers.length === 0) {
      Alert.alert('Error', 'Please select at least one customer');
      return;
    }

    setSending(true);

    try {
      if (selectedAudience === 'individual') {
        // Send to selected individual customers
        if (selectedCustomers.length === 0) {
          throw new Error('No customers selected');
        }

        const notifications = selectedCustomers.map(customer => ({
          user_id: customer.id,
          title: title.trim(),
          message: message.trim(),
          type: selectedType as any,
        }));

        console.log('📤 Sending individual notifications to:', notifications.length, 'customers');
        console.log('📋 Selected customer IDs:', selectedCustomers.map(c => c.id));
        console.log('📋 Notification data:', notifications);

        const { data, error } = await supabase
          .from('notifications')
          .insert(notifications)
          .select();

        if (error) {
          console.error('❌ Error inserting individual notifications:', error);
          throw error;
        }
        
        console.log('✅ Individual notifications sent successfully:', data?.length);
        console.log('📊 Inserted notifications:', data);
      } else if (selectedAudience === 'customers') {
        // Send to all customers
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
      } else {
        // Send to all users (broadcast)
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: null, // Broadcast to all users
            title: title.trim(),
            message: message.trim(),
            type: selectedType as any,
          });

        if (error) throw error;
      }

      Alert.alert(
        'Success',
        'Notification sent successfully!',
        [{ text: 'OK', onPress: () => {
          setTitle('');
          setMessage('');
          setSelectedCustomers([]);
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
                onPress={() => handleAudienceChange(option.id)}
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
  selectedCustomersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedCustomerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED20',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  selectedCustomerName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
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
    backgroundColor: '#7C3AED10',
    borderWidth: 1,
    borderColor: '#7C3AED',
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
    backgroundColor: '#7C3AED',
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
    backgroundColor: '#7C3AED',
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
    backgroundColor: '#7C3AED',
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