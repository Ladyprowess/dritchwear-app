import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
} from 'lucide-react-native';
import SupportTicketModal from '@/components/SupportTicketModal';
import { getOwnedCountsForUsers, getTier, tierRankByName, TIERS } from '@/lib/wardrobe';
import { getSupportOnline, setSupportOnline } from '@/lib/messaging';

interface SupportTicket {
  id: string;
  ticket_code: string;
  user_id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  last_message_at: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string;
  };
  support_categories: {
    name: string;
  } | null;
  _count?: {
    messages: number;
  };
  _tier?: string; // requester's wardrobe tier (for priority support)
}

const statusConfig: Record<
  SupportTicket['status'],
  { color: string; label: string; icon: any }
> = {
  open: { color: '#3B82F6', label: 'Open', icon: AlertCircle },
  in_progress: { color: '#F59E0B', label: 'In Progress', icon: Clock },
  waiting_customer: { color: '#8B5CF6', label: 'Waiting Customer', icon: MessageCircle },
  resolved: { color: '#10B981', label: 'Resolved', icon: CheckCircle },
  closed: { color: '#6B7280', label: 'Closed', icon: CheckCircle },
};

const priorityConfig: Record<
  SupportTicket['priority'],
  { color: string; label: string }
> = {
  low: { color: '#10B981', label: 'Low' },
  medium: { color: '#F59E0B', label: 'Medium' },
  high: { color: '#EF4444', label: 'High' },
  urgent: { color: '#DC2626', label: 'Urgent' },
};

export default function AdminHelpSupportScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [online, setOnline] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);

  useEffect(() => { void getSupportOnline().then(setOnline).catch(() => {}); }, []);

  const toggleOnline = async () => {
    if (togglingOnline) return;
    setTogglingOnline(true);
    const next = !online;
    setOnline(next); // optimistic
    try { await setSupportOnline(next); } catch { setOnline(!next); }
    finally { setTogglingOnline(false); }
  };

  const fetchTickets = async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select(
          `
          id,
          ticket_code,
          user_id,
          subject,
          description,
          status,
          priority,
          last_message_at,
          created_at,
          profiles!support_tickets_user_id_fkey(full_name, email),
          support_categories(name)
        `
        )
        .order('last_message_at', { ascending: false });

      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Wardrobe tier per requester, so member (Silver+) tickets get priority.
      const userIds = [...new Set((data || []).map((t: any) => t.user_id).filter(Boolean))];
      const ownedCounts = await getOwnedCountsForUsers(userIds);

      const ticketsWithCounts = await Promise.all(
        (data || []).map(async (ticket: any) => {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('ticket_id', ticket.id);

          return {
            ...ticket,
            _count: { messages: count || 0 },
            _tier: getTier(ownedCounts.get(ticket.user_id) ?? 0).name,
          } as SupportTicket;
        })
      );

      // Surface higher-tier members first; recency order is preserved within a
      // tier because the DB query already sorted by last_message_at.
      ticketsWithCounts.sort((a, b) => tierRankByName(b._tier) - tierRankByName(a._tier));

      setTickets(ticketsWithCounts);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      Alert.alert('Error', 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTickets();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  const getTicketStats = () => ({
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  });

  const stats = getTicketStats();

  const renderTicket = (ticket: SupportTicket) => {
    const statusInfo = statusConfig[ticket.status];
    const priorityInfo = priorityConfig[ticket.priority];
    const StatusIcon = statusInfo.icon;

    return (
      <Pressable
        key={ticket.id}
        style={styles.ticketCard}
        onPress={() => handleTicketPress(ticket)}
      >
        <View style={styles.ticketHeader}>
          <View style={styles.ticketInfo}>
            <Text style={styles.ticketSubject} numberOfLines={1}>
              {ticket.subject}
            </Text>

            <View style={styles.ticketMeta}>
              <User size={12} color="#6B7280" />
              <Text style={styles.customerName}>
                {ticket.profiles?.full_name || ticket.profiles?.email || 'Unknown Customer'}
              </Text>

              {tierRankByName(ticket._tier) >= 1 && (() => {
                const tierColor = TIERS.find((t) => t.name === ticket._tier)?.color ?? '#8E9099';
                return (
                  <View style={[styles.tierBadge, { backgroundColor: `${tierColor}22`, borderColor: tierColor }]}>
                    <Text style={[styles.tierBadgeText, { color: tierColor }]}>{ticket._tier} member</Text>
                  </View>
                );
              })()}

              {ticket.support_categories && (
                <>
                  <Text style={styles.metaSeparator}>•</Text>
                  <Text style={styles.categoryName}>{ticket.support_categories.name}</Text>
                </>
              )}
            </View>

            <Text style={styles.ticketDescription} numberOfLines={2}>
              {ticket.description}
            </Text>
          </View>

          <View style={styles.ticketRight}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}20` }]}>
              <StatusIcon size={12} color={statusInfo.color} />
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>

            <View style={[styles.priorityBadge, { backgroundColor: `${priorityInfo.color}20` }]}>
              <Text style={[styles.priorityText, { color: priorityInfo.color }]}>
                {priorityInfo.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ticketFooter}>
          <Text style={styles.lastMessage}>Last activity: {formatDate(ticket.last_message_at)}</Text>
          <View style={styles.messageCount}>
            <MessageCircle size={12} color="#6B7280" />
            <Text style={styles.messageCountText}>{ticket._count?.messages || 0}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  const statusFilters = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'waiting_customer', label: 'Waiting Customer' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.replace('/(admin)/settings')}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Messaging</Text>
        <Pressable
          style={[styles.onlineToggle, online ? styles.onlineOn : styles.onlineOff]}
          onPress={toggleOnline}
          disabled={togglingOnline}
          accessibilityRole="button"
          accessibilityLabel={online ? 'Support online, tap to go offline' : 'Support offline, tap to go online'}
        >
          <View style={[styles.onlineDot, { backgroundColor: online ? '#1B9C63' : '#9CA3AF' }]} />
          <Text style={[styles.onlineText, { color: online ? '#1B7A50' : '#6B7280' }]}>{online ? 'Online' : 'Offline'}</Text>
        </Pressable>
      </View>

      {/* ✅ Keyboard-safe wrapper (important because SupportTicketModal has inputs) */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            {/* Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.open}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.inProgress}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.resolved}</Text>
                <Text style={styles.statLabel}>Resolved</Text>
              </View>
            </View>

            {/* Status Filter */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
              contentContainerStyle={styles.filtersContent}
              keyboardShouldPersistTaps="handled"
            >
              {statusFilters.map((filter) => (
                <Pressable
                  key={filter.key}
                  style={[
                    styles.filterChip,
                    selectedStatus === filter.key && styles.filterChipActive,
                  ]}
                  onPress={() => setSelectedStatus(filter.key)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selectedStatus === filter.key && styles.filterTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Tickets List */}
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading tickets...</Text>
                </View>
              ) : tickets.length > 0 ? (
                <View style={styles.ticketsContainer}>{tickets.map(renderTicket)}</View>
              ) : (
                <View style={styles.emptyContainer}>
                  <MessageCircle size={64} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptySubtitle}>
                    {selectedStatus === 'all'
                      ? 'No support tickets have been created yet'
                      : `No ${selectedStatus.replace('_', ' ')} tickets found`}
                  </Text>
                </View>
              )}
            </ScrollView>

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
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
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
  headerTitle: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#1F2937' },
  placeholder: { width: 40 },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  onlineOn: { backgroundColor: '#E7F6EE', borderColor: '#BBE7D0' },
  onlineOff: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },

  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
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
  statValue: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginBottom: 4 },
  statLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#6B7280' },

  filtersContainer: { maxHeight: 48, marginBottom: 16 },
  filtersContent: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: '#5A2D82', borderColor: '#5A2D82' },
  filterText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#6B7280' },
  filterTextActive: { color: '#FFFFFF' },

  scrollView: { flex: 1 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  loadingText: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280' },

  ticketsContainer: { paddingHorizontal: 20, paddingBottom: 20 },

  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  ticketInfo: { flex: 1, marginRight: 12 },

  ticketSubject: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#1F2937', marginBottom: 4 },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 4 },
  customerName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#6B7280' },
  metaSeparator: { fontSize: 12, color: '#9CA3AF' },
  categoryName: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#5A2D82' },
  ticketDescription: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#6B7280', lineHeight: 18 },

  ticketRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: { fontSize: 10, fontFamily: 'Inter-SemiBold' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tierBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  tierBadgeText: { fontSize: 10, fontFamily: 'Inter-Bold' },
  priorityText: { fontSize: 10, fontFamily: 'Inter-SemiBold' },

  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  lastMessage: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#9CA3AF' },
  messageCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  messageCountText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#6B7280' },

  emptyContainer: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontFamily: 'Inter-Bold', color: '#1F2937', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, fontFamily: 'Inter-Regular', color: '#6B7280', textAlign: 'center', lineHeight: 24 },
});
