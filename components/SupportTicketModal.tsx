import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Send, User, Clock, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { loadAttachmentsForMessages, type AttachmentRow } from '@/lib/attachments';
import MessageAttachments from '@/components/MessageAttachments';

interface SupportTicket {
  id: string;
  ticket_code: string | null; 
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_message_at: string;
  created_at: string;
  user_profile?: {
    full_name: string | null;
    email: string;
  };
  admin_profile?: {
    full_name: string | null;
    email: string;
  };
  support_categories: {
    name: string;
  } | null;
}


interface SupportMessage {
  id: string;
  ticket_code: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  sender_profile: {
    full_name: string | null;
    email: string;
    role: string;
  };
}

interface SupportTicketModalProps {
  ticket: SupportTicket | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const statusOptions = [
  { value: 'open', label: 'Open', color: '#3B82F6', icon: AlertCircle },
  { value: 'in_progress', label: 'In Progress', color: '#F59E0B', icon: Clock },
  { value: 'waiting_customer', label: 'Waiting Customer', color: '#8B5CF6', icon: MessageCircle },
  { value: 'resolved', label: 'Resolved', color: '#10B981', icon: CheckCircle },
  { value: 'closed', label: 'Closed', color: '#6B7280', icon: CheckCircle },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
  { value: 'urgent', label: 'Urgent', color: '#DC2626' },
];

export default function SupportTicketModal({ ticket, visible, onClose, onUpdate }: SupportTicketModalProps) {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, AttachmentRow[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  // Only auto-scroll to the bottom when a genuinely new message arrives, not
  // on every re-fetch (realtime fires on attachments too, and a re-fetch
  // after e.g. a status change carries no new messages) - otherwise every
  // fetch yanked the thread back down mid-read, making it feel impossible
  // to scroll up through history.
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    if (ticket && visible) {
      previousMessageCountRef.current = 0;
      fetchMessages();
    }
  }, [ticket, visible]);

  // Real-time: refresh the thread the instant the other party sends a message,
  // so this reads like a live chat for both the customer and the admin.
  useEffect(() => {
    if (!ticket?.id || !visible) return;
    const channel = supabase
      .channel(`support-ticket-${ticket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        () => { void fetchMessages(); },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_message_attachments', filter: `ticket_id=eq.${ticket.id}` },
        () => { void fetchMessages(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // fetchMessages is stable enough for this modal's lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, visible]);

  const fetchMessages = async () => {
    if (!ticket) return;
  
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          id,
          ticket_code,
          ticket_id,
          sender_id,
          message,
          is_internal,
          created_at,
          sender_profile:profiles!sender_id(full_name, email, role)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
  
      if (error) throw error;
  
      setMessages(data || []);
      const attMap = await loadAttachmentsForMessages((data || []).map((m: any) => m.id));
      setAttachmentsMap(attMap);

      const isNewMessage = (data || []).length > previousMessageCountRef.current;
      previousMessageCountRef.current = (data || []).length;
      if (isNewMessage) {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };
  

  const sendMessage = async () => {
    if (!ticket || !user || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          ticket_code: ticket.ticket_code,
          sender_id: user.id,
          message: newMessage.trim(),
          is_internal: false,
        });

      if (error) throw error;

      // ✅ Only notify customer when ADMIN replies
// ✅ Only notify customer when ADMIN replies
if (isAdmin) {
  await supabase.from('notifications').insert({
    user_id: ticket.user_id,
    title: 'New support message',
    message: `You have a new reply from our support team.`,
    type: 'custom',
    is_read: false,
  });

  // Push-notify the customer, even if their app is closed. Best-effort.
  const preview = newMessage.trim();
  supabase.functions.invoke('send-push-notifications', {
    body: { userIds: [ticket.user_id], title: 'New reply from support', message: preview.length > 90 ? `${preview.slice(0, 90)}…` : (preview || 'You have a new reply'), type: 'custom', url: '/help-support' },
  }).catch(() => {});
}


      
      


      setNewMessage('');
      await fetchMessages();

      // Update ticket status if admin is responding
      if (isAdmin && ticket.status === 'waiting_customer') {
        await updateTicketStatus('in_progress');
      } else if (!isAdmin && ticket.status === 'in_progress') {
        await updateTicketStatus('waiting_customer');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const updateTicketStatus = async (newStatus: string) => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (error) throw error;

      // Send notification to customer if admin resolves ticket
      if (isAdmin && newStatus === 'resolved') {
        await supabase
          .from('notifications')
          .insert({
            user_id: ticket.user_id,
            title: 'Support Ticket Resolved',
            message: `Your support ticket "${ticket.subject}" has been resolved.`,
            type: 'system'
          });
      }

      onUpdate();
    } catch (error) {
      console.error('Error updating ticket status:', error);
      Alert.alert('Error', 'Failed to update ticket status');
    }
  };

  const updateTicketPriority = async (newPriority: string) => {
    if (!ticket) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          priority: newPriority,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (error) throw error;
      onUpdate();
    } catch (error) {
      console.error('Error updating ticket priority:', error);
      Alert.alert('Error', 'Failed to update ticket priority');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (message: SupportMessage) => {
    const profile = message.sender_profile;
    const isOwnMessage = message.sender_id === user?.id;
    const isAdminMessage = profile?.role === 'admin';
  
    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage
        ]}
      >
        <View style={styles.messageHeader}>
          <View style={styles.senderInfo}>
            <View style={[
              styles.senderAvatar,
              { backgroundColor: isAdminMessage ? '#5A2D82' : '#10B981' }
            ]}>
              <Text style={styles.senderAvatarText}>
                {(profile?.full_name || profile?.email || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.senderName}>
                {profile?.full_name || profile?.email || 'Unknown'}
                {isAdminMessage && <Text style={styles.adminBadge}> (Admin)</Text>}
              </Text>
              <Text style={styles.messageTime}>
                {formatDate(message.created_at)}
              </Text>
            </View>
          </View>
        </View>
        {!!message.message?.trim() && <Text style={styles.messageText}>{message.message}</Text>}
        <MessageAttachments attachments={attachmentsMap[message.id] || []} />
      </View>
    );
  };
  

  if (!ticket) return null;

  const currentStatus = statusOptions.find(s => s.value === ticket.status);
  const currentPriority = priorityOptions.find(p => p.value === ticket.priority);

  return (
    <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="fullScreen"
    onRequestClose={onClose}
  >
   <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
>


        <SafeAreaView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <Text style={styles.headerSubtitle}>
                {ticket.user_profile?.full_name || ticket.user_profile?.email || 'Unknown'}
              </Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>
  
          {/* Ticket Info */}
          <View style={styles.ticketInfo}>
            <View style={styles.ticketMeta}>
              <View style={[styles.statusBadge, { backgroundColor: `${currentStatus?.color}20` }]}>
                {currentStatus && <currentStatus.icon size={12} color={currentStatus.color} />}
                <Text style={[styles.statusText, { color: currentStatus?.color }]}>
                  {currentStatus?.label}
                </Text>
              </View>
  
              <View style={[styles.priorityBadge, { backgroundColor: `${currentPriority?.color}20` }]}>
                <Text style={[styles.priorityText, { color: currentPriority?.color }]}>
                  {currentPriority?.label} Priority
                </Text>
              </View>
            </View>
  
            {ticket.support_categories && (
              <Text style={styles.categoryText}>
                Category: {ticket.support_categories.name}
              </Text>
            )}
          </View>
  
          {/* Admin Controls */}
          {isAdmin && (
          <View style={styles.adminControls}>
            <Text style={styles.controlsTitle}>Admin Controls</Text>
            <View style={styles.controlsRow}>
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Status</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionsContainer}>
                    {statusOptions.map((status) => (
                      <Pressable
                        key={status.value}
                        style={[
                          styles.optionChip,
                          ticket.status === status.value && styles.optionChipActive
                        ]}
                        onPress={() => updateTicketStatus(status.value)}
                      >
                        <status.icon size={12} color={ticket.status === status.value ? '#FFFFFF' : status.color} />
                        <Text
                          style={[
                            styles.optionText,
                            { color: ticket.status === status.value ? '#FFFFFF' : status.color }
                          ]}
                        >
                          {status.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Priority</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionsContainer}>
                    {priorityOptions.map((priority) => (
                      <Pressable
                        key={priority.value}
                        style={[
                          styles.optionChip,
                          ticket.priority === priority.value && styles.optionChipActive
                        ]}
                        onPress={() => updateTicketPriority(priority.value)}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { color: ticket.priority === priority.value ? '#FFFFFF' : priority.color }
                          ]}
                        >
                          {priority.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </View>
        )}


          {/* Messages */}
<View style={{ flex: 1 }}>
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.initialMessage}>
          <Text style={styles.initialMessageTitle}>Original Request</Text>
          <Text style={styles.initialMessageText}>{ticket.description}</Text>
          <Text style={styles.initialMessageTime}>
            {formatDate(ticket.created_at)}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          messages.map(renderMessage)
        )}
      </ScrollView>
    </View>
  </TouchableWithoutFeedback>
</View>

          {/* Message Input */}
          {ticket.status !== 'closed' && (
            <View style={styles.inputContainer}>
              <View style={styles.messageInputContainer}>
                <TextInput
                  style={styles.messageInput}
                  value={newMessage}
                  onChangeText={setNewMessage}
                  placeholder="Type your message..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={1000}
                />   
                <Pressable
                  style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim() || sending}
                >
                  <Send size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          )}
        </SafeAreaView>
      
    </KeyboardAvoidingView>
  </Modal>
  
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flex: 1,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketInfo: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ticketMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  adminControls: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  controlsTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  controlsRow: {
    gap: 16,
  },
  controlGroup: {
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  optionChipActive: {
    backgroundColor: '#5A2D82',
    borderColor: '#5A2D82',
  },
  optionText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  initialMessage: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  initialMessageTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  initialMessageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  initialMessageTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  ownMessage: {
    alignSelf: 'flex-end',
  },
  otherMessage: {
    alignSelf: 'flex-start',
  },
  messageHeader: {
    marginBottom: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  senderAvatarText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  senderName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  adminBadge: {
    color: '#5A2D82',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingBottom: Platform.OS === 'android' ? 8 : 0,
  },
  
  messageTime: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    lineHeight: 20,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});