import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  MessageCircle, 
  Phone, 
  Mail, 
  Clock, 
  ChevronRight,
  Send,
  HelpCircle,
  FileText,
  Shield,
  Plus,
  X
} from 'lucide-react-native';
import SupportTicketModal from '@/components/SupportTicketModal';

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_message_at: string;
  created_at: string;
  support_categories: {
    name: string;
  } | null;
  _count?: {
    messages: number;
  };
}

interface SupportCategory {
  id: string;
  name: string;
  description: string;
}

const faqData = [
  {
    question: 'How do I track my order?',
    answer: 'You can track your order by going to the Orders tab in the app. Each order shows its current status and estimated delivery time.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept wallet payments and online payments through Paystack (cards, bank transfers, USSD) for Nigerians and Paypal for International payments.',
  },
  {
    question: 'How long does delivery take?',
    answer: 'Delivery typically takes 3-7 business days within Lagos and 5-10 business days for other locations in Nigeria. While international delivery takes 3-4 weeks.',
  },
  {
    question: 'Can I return or exchange items?',
    answer: 'Yes, we accept returns within 2 days of receiving your item(s). Item(s) must be in original condition with tags attached.',
  },
  {
    question: 'How do custom orders work?',
    answer: 'Submit your custom order request with details and budget. Our team will review and provide a quote within 24-48 hours.',
  },
];

const contactMethods = [
  {
    icon: Phone,
    title: 'Call Us',
    subtitle: '+234 (0) 911 016 3722',
    action: () => {
      // For web, we can't make actual calls, so show an alert
      Alert.alert('Call Support', 'Please call +234 (0) 911 016 3722 for immediate assistance.');
    },
    color: '#10B981',
  },
  {
    icon: Mail,
    title: 'Email Support',
    subtitle: 'support@dritchwear.com',
    action: () => {
      Alert.alert('Email Support', 'Please send your inquiry to support@dritchwear.com');
    },
    color: '#3B82F6',
  },
];

export default function HelpSupportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    description: '',
    category_id: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTickets();
      fetchCategories();
    }
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          id,
          subject,
          description,
          status,
          priority,
          last_message_at,
          created_at,
          support_categories(name)
        `)
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get message counts for each ticket
      const ticketsWithCounts = await Promise.all(
        (data || []).map(async (ticket) => {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('ticket_id', ticket.id);

          return {
            ...ticket,
            _count: { messages: count || 0 }
          };
        })
      );

      setTickets(ticketsWithCounts);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('support_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleCreateTicket = async () => {
    if (!newTicketForm.subject.trim() || !newTicketForm.description.trim()) {
      Alert.alert('Missing Information', 'Please fill in both subject and description');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a support ticket');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          subject: newTicketForm.subject.trim(),
          description: newTicketForm.description.trim(),
          category_id: newTicketForm.category_id || null,
          status: 'open',
          priority: 'medium',
        });

      if (error) throw error;

      Alert.alert(
        'Ticket Created',
        'Your support ticket has been created successfully. Our team will respond soon.',
        [{ text: 'OK', onPress: () => {
          setNewTicketForm({ subject: '', description: '', category_id: '' });
          setShowNewTicketModal(false);
          fetchTickets();
        }}]
      );
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('Error', 'Failed to create support ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTicketPress = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowTicketModal(true);
  };

  const handleTicketUpdate = () => {
    fetchTickets();
    setShowTicketModal(false);
    setSelectedTicket(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return '#3B82F6';
      case 'in_progress': return '#F59E0B';
      case 'waiting_customer': return '#8B5CF6';
      case 'resolved': return '#10B981';
      case 'closed': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'waiting_customer': return 'Waiting for You';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <Pressable 
          style={styles.newTicketButton}
          onPress={() => setShowNewTicketModal(true)}
        >
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* My Tickets */}
        {tickets.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Support Tickets</Text>
            <View style={styles.ticketsContainer}>
              {tickets.slice(0, 3).map((ticket) => (
                <Pressable
                  key={ticket.id}
                  style={styles.ticketCard}
                  onPress={() => handleTicketPress(ticket)}
                >
                  <View style={styles.ticketHeader}>
                    <Text style={styles.ticketSubject} numberOfLines={1}>
                      {ticket.subject}
                    </Text>
                    <View style={[
                      styles.ticketStatus,
                      { backgroundColor: `${getStatusColor(ticket.status)}20` }
                    ]}>
                      <Text style={[
                        styles.ticketStatusText,
                        { color: getStatusColor(ticket.status) }
                      ]}>
                        {getStatusLabel(ticket.status)}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.ticketDescription} numberOfLines={2}>
                    {ticket.description}
                  </Text>
                  
                  <View style={styles.ticketFooter}>
                    <Text style={styles.ticketTime}>
                      {formatDate(ticket.last_message_at)}
                    </Text>
                    <View style={styles.messageCount}>
                      <MessageCircle size={12} color="#6B7280" />
                      <Text style={styles.messageCountText}>
                        {ticket._count?.messages || 0}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              ))}
              
              {tickets.length > 3 && (
                <Pressable style={styles.viewAllTickets}>
                  <Text style={styles.viewAllText}>View All Tickets</Text>
                  <ChevronRight size={16} color="#7C3AED" />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Contact Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get in Touch</Text>
          <View style={styles.contactGrid}>
            {contactMethods.map((method, index) => (
              <Pressable
                key={index}
                style={styles.contactCard}
                onPress={method.action}
              >
                <View style={[styles.contactIcon, { backgroundColor: `${method.color}20` }]}>
                  <method.icon size={24} color={method.color} />
                </View>
                <Text style={styles.contactTitle}>{method.title}</Text>
                <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <View style={styles.hoursCard}>
            <Clock size={24} color="#7C3AED" />
            <View style={styles.hoursInfo}>
              <Text style={styles.hoursTitle}>Business Hours</Text>
              <Text style={styles.hoursText}>Monday - Friday: 9:00 AM - 6:00 PM</Text>
              <Text style={styles.hoursText}>Saturday: 10:00 AM - 4:00 PM</Text>
              <Text style={styles.hoursText}>Sunday: Closed</Text>
            </View>
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqContainer}>
            {faqData.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <Pressable
                  style={styles.faqQuestion}
                  onPress={() => toggleFaq(index)}
                >
                  <HelpCircle size={20} color="#7C3AED" />
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <ChevronRight 
                    size={20} 
                    color="#9CA3AF"
                    style={[
                      styles.faqChevron,
                      expandedFaq === index && styles.faqChevronExpanded
                    ]}
                  />
                </Pressable>
                {expandedFaq === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Additional Resources */}
        <View style={styles.section}>
  <Text style={styles.sectionTitle}>Additional Resources</Text>
  <View style={styles.resourcesContainer}>
    <Pressable
      style={styles.resourceItem}
      onPress={() => Linking.openURL('https://dritchwear.com/terms-of-service')}
    >
      <FileText size={20} color="#6B7280" />
      <Text style={styles.resourceText}>Terms of Service</Text>
      <ChevronRight size={16} color="#9CA3AF" />
    </Pressable>

    <Pressable
      style={styles.resourceItem}
      onPress={() => Linking.openURL('https://dritchwear.com/privacy-policy')}
    >
      <Shield size={20} color="#6B7280" />
      <Text style={styles.resourceText}>Privacy Policy</Text>
      <ChevronRight size={16} color="#9CA3AF" />
    </Pressable>
  </View>
</View>
      </ScrollView>

      {/* New Ticket Modal */}
      <Modal
        visible={showNewTicketModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewTicketModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Support Ticket</Text>
            <Pressable 
              style={styles.closeButton} 
              onPress={() => setShowNewTicketModal(false)}
            >
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoriesContainer}>
                  {categories.map((category) => (
                    <Pressable
                      key={category.id}
                      style={[
                        styles.categoryChip,
                        newTicketForm.category_id === category.id && styles.categoryChipActive
                      ]}
                      onPress={() => setNewTicketForm(prev => ({ ...prev, category_id: category.id }))}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          newTicketForm.category_id === category.id && styles.categoryChipTextActive
                        ]}
                      >
                        {category.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subject *</Text>
              <TextInput
                style={styles.formInput}
                value={newTicketForm.subject}
                onChangeText={(text) => setNewTicketForm(prev => ({ ...prev, subject: text }))}
                placeholder="Brief description of your issue"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={styles.messageInput}
                value={newTicketForm.description}
                onChangeText={(text) => setNewTicketForm(prev => ({ ...prev, description: text }))}
                placeholder="Describe your issue or question in detail..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleCreateTicket}
              disabled={submitting}
            >
              <Send size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>
                {submitting ? 'Creating...' : 'Create Ticket'}
              </Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Support Ticket Modal */}
      <SupportTicketModal
        ticket={selectedTicket}
        visible={showTicketModal}
        onClose={() => {
          setShowTicketModal(false);
          setSelectedTicket(null);
        }}
        onUpdate={handleTicketUpdate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  newTicketButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  ticketsContainer: {
    gap: 12,
  },
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketSubject: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginRight: 12,
  },
  ticketStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ticketStatusText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  ticketDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 12,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  messageCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageCountText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  viewAllTickets: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  viewAllText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  contactGrid: {
    gap: 12,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
  hoursCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  hoursInfo: {
    marginLeft: 12,
    flex: 1,
  },
  hoursTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  hoursText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  faqContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginLeft: 12,
  },
  faqChevron: {
    transform: [{ rotate: '0deg' }],
  },
  faqChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  faqAnswer: {
    paddingHorizontal: 48,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  resourcesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resourceText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    marginLeft: 12,
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
    marginBottom: 8,
  },
  categoriesContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 120,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});