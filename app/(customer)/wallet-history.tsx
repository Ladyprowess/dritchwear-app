import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TouchableOpacity, Clipboard, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Calendar, Zap, Smartphone, Tv, Wifi, Copy, X, ChevronRight } from 'lucide-react-native';
import { formatCurrency, convertFromNGN } from '@/lib/currency';
import { smartBack } from '@/lib/navigation';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  original_amount: number | null;
  description: string;
  status: string;
  created_at: string;
  payment_provider: string;
}

interface BillTransaction {
  id: string;
  service_type: 'airtime' | 'data' | 'electricity' | 'cable';
  service_provider: string;
  amount: number;
  payment_source: string;
  points_used: number;
  vtpass_reference: string;
  vtpass_response: any;
  status: string;
  beneficiary: string;
  created_at: string;
}

export default function WalletHistoryScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [billTransactions, setBillTransactions] = useState<BillTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'bills'>('wallet');
  const [selectedBill, setSelectedBill] = useState<BillTransaction | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState(profile?.preferred_currency || 'NGN');

  const getBillPaymentLabel = (bill: BillTransaction) => {
    const pointsUsed = Number(bill.points_used ?? 0);
    const pointsValue = pointsUsed * 0.1;
    const walletPortion = Math.max(0, Number(bill.amount ?? 0) - pointsValue);

    if (bill.payment_source === 'points') return `${pointsUsed} Points`;
    if (bill.payment_source === 'mixed') {
      return `${pointsUsed} Points + ${formatCurrency(walletPortion, 'NGN')} Wallet`;
    }
    return 'Wallet';
  };

  const fetchTransactions = useCallback(async () => {
    if (!user) return;

    try {
      const [walletRes, billsRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('bill_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      if (walletRes.error) throw walletRes.error;
      if (billsRes.error) throw billsRes.error;

      setTransactions(walletRes.data || []);
      setBillTransactions((billsRes.data as BillTransaction[]) || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTransactions();
    if (profile) {
      setDisplayCurrency(profile.preferred_currency || 'NGN');
    }
  }, [fetchTransactions, profile]);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
    }, [fetchTransactions])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const getTransactionIcon = (type: string) => {
    return type === 'credit' ? TrendingUp : TrendingDown;
  };

  const getTransactionColor = (type: string) => {
    return type === 'credit' ? '#10B981' : '#EF4444';
  };

  const getPaymentProviderIcon = (provider: string) => {
    switch (provider) {
      case 'paystack':
        return '🇳🇬';
      case 'wallet':
        return '👛';
      case 'gift_card':
        return '🎁';
      default:
        return '💳';
    }
  };

  const getPaymentProviderName = (provider: string) => {
    switch (provider) {
      case 'paystack':
        return 'Paystack';
      case 'wallet':
        return 'Wallet';
      case 'gift_card':
        return 'Gift Card';
      default:
        return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Unknown';
    }
  };

  // Convert transaction amount to display currency
  const getDisplayAmount = (transaction: Transaction) => {
    // If transaction is already in the display currency, use it directly
    if (transaction.currency === displayCurrency) {
      return transaction.original_amount || transaction.amount;
    }
    
    // If transaction has original amount in a non-NGN currency
    if (transaction.original_amount && transaction.currency !== 'NGN' && transaction.currency === displayCurrency) {
      return transaction.original_amount;
    }
    
    // Otherwise convert from NGN to display currency
    return convertFromNGN(transaction.amount, displayCurrency);
  };

  const getBillIcon = (type: string) => {
    switch (type) {
      case 'electricity': return Zap;
      case 'airtime': return Smartphone;
      case 'cable': return Tv;
      case 'data': return Wifi;
      default: return Smartphone;
    }
  };

  const getBillLabel = (type: string) => {
    switch (type) {
      case 'electricity': return 'Electricity';
      case 'airtime': return 'Airtime';
      case 'cable': return 'Cable TV';
      case 'data': return 'Data';
      default: return type;
    }
  };

  const formatProviderName = (id: string) =>
    id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied!', `${label} copied to clipboard.`);
  };

  const renderBillCard = (bill: BillTransaction) => {
    const IconComponent = getBillIcon(bill.service_type);
    const isElec = bill.service_type === 'electricity';
    const token = bill.vtpass_response?.token ?? null;
    const isSuccess = bill.status === 'success';

    return (
      <Pressable key={bill.id} style={styles.transactionCard} onPress={() => setSelectedBill(bill)}>
        <View style={styles.transactionHeader}>
          <View style={[styles.transactionIcon, { backgroundColor: isElec ? '#FEF3C720' : '#EDE9FE' }]}>
            <IconComponent size={20} color={isElec ? '#D97706' : '#5A2D82'} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>
              {getBillLabel(bill.service_type)} • {formatProviderName(bill.service_provider)}
            </Text>
            <View style={styles.transactionMeta}>
              <Text style={styles.transactionDate}>{formatDate(bill.created_at)}</Text>
              {isElec && token && (
                <View style={[styles.paymentProvider, { backgroundColor: '#FEF3C7' }]}>
                  <Zap size={10} color="#D97706" />
                  <Text style={[styles.providerText, { color: '#D97706' }]}>Token</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[styles.amountText, { color: '#EF4444' }]}>
              -{formatCurrency(bill.amount, 'NGN')}
            </Text>
            <Text style={[styles.statusText, { color: isSuccess ? '#10B981' : '#EF4444' }]}>
              {isSuccess ? 'Success' : bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
            </Text>
          </View>
          <ChevronRight size={16} color="#9CA3AF" style={{ marginLeft: 4 }} />
        </View>
      </Pressable>
    );
  };

  const renderBillDetailModal = () => {
    if (!selectedBill) return null;
    const r = selectedBill.vtpass_response ?? {};
    const token: string | null = r.token ?? null;
    const isElec = selectedBill.service_type === 'electricity';

    const rows: { label: string; value: string; highlight?: boolean; copyable?: boolean }[] = [
      { label: 'Reference', value: selectedBill.vtpass_reference },
      { label: 'Service', value: getBillLabel(selectedBill.service_type) },
      { label: isElec ? 'Meter No.' : 'Beneficiary', value: selectedBill.beneficiary },
      { label: 'Provider', value: formatProviderName(selectedBill.service_provider) },
      { label: 'Date', value: new Date(selectedBill.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) },
      { label: 'Amount', value: formatCurrency(selectedBill.amount, 'NGN') },
      { label: 'Paid With', value: getBillPaymentLabel(selectedBill) },
      ...(r.old_balance != null ? [{ label: 'Old Balance', value: String(r.old_balance) }] : []),
      ...(r.new_balance != null ? [{ label: 'New Balance', value: String(r.new_balance) }] : []),
      { label: 'Status', value: selectedBill.status === 'success' ? 'SUCCESS' : selectedBill.status.toUpperCase(), highlight: true },
    ];

    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedBill(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Payment Details</Text>
              <Pressable onPress={() => setSelectedBill(null)} hitSlop={12}>
                <X size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Electricity token - prominent */}
            {isElec && token && (
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>⚡ Electricity Token</Text>
                <Text style={styles.tokenValue}>{token}</Text>
                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(token, 'Token')}>
                  <Copy size={14} color="#FFFFFF" />
                  <Text style={styles.copyBtnText}>Copy Token</Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>
              {rows.map(row => (
                <View key={row.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={[styles.detailValue, row.highlight && { color: '#10B981', fontFamily: 'Inter-Bold' }]} numberOfLines={2}>
                      {row.value}
                    </Text>
                    {row.copyable && (
                      <Pressable onPress={() => copyToClipboard(row.value, row.label)} hitSlop={8}>
                        <Copy size={12} color="#6B7280" />
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedBill(null)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  };

  const renderTransaction = (transaction: Transaction) => {
    const IconComponent = getTransactionIcon(transaction.type);
    const color = getTransactionColor(transaction.type);
    const providerIcon = getPaymentProviderIcon(transaction.payment_provider || 'wallet');
    const displayAmount = getDisplayAmount(transaction);
    const providerName = getPaymentProviderName(transaction.payment_provider || 'wallet');

    return (
      <View key={transaction.id} style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={[styles.transactionIcon, { backgroundColor: `${color}20` }]}>
            <IconComponent size={20} color={color} />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>
              {transaction.description}
            </Text>
            <View style={styles.transactionMeta}>
              <Text style={styles.transactionDate}>
                {formatDate(transaction.created_at)}
              </Text>
              {transaction.payment_provider && (
                <View style={styles.paymentProvider}>
                  <Text style={styles.providerIcon}>{providerIcon}</Text>
                  <Text style={styles.providerText}>
                    {providerName}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[styles.amountText, { color }]}>
              {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(displayAmount, displayCurrency)}
            </Text>
            {transaction.currency !== displayCurrency && (
              <Text style={styles.originalAmount}>
                {formatCurrency(transaction.amount, transaction.currency || 'NGN')}
              </Text>
            )}
            <Text style={styles.statusText}>
              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Calculate totals in display currency
  const totalCredits = transactions
    .filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + getDisplayAmount(t), 0);

  const totalDebits = transactions
    .filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + getDisplayAmount(t), 0);

  // Get wallet balance in display currency
  const walletBalanceInDisplayCurrency = profile ? 
    (displayCurrency === 'NGN' ? 
      profile.wallet_balance : 
      convertFromNGN(profile.wallet_balance, displayCurrency)
    ) : 0;

  return (
    <SafeAreaView style={styles.container}>
      {renderBillDetailModal()}

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.replace('/(customer)/profile')}>
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Wallet History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        <Pressable style={[styles.tab, activeTab === 'wallet' && styles.tabActive]} onPress={() => setActiveTab('wallet')}>
          <Text style={[styles.tabText, activeTab === 'wallet' && styles.tabTextActive]}>Wallet</Text>
        </Pressable>
        <Pressable style={[styles.tab, activeTab === 'bills' && styles.tabActive]} onPress={() => setActiveTab('bills')}>
          <Text style={[styles.tabText, activeTab === 'bills' && styles.tabTextActive]}>Bills</Text>
          {billTransactions.length > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{billTransactions.length}</Text></View>}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'wallet' ? (
          <>
            {/* Current Balance */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Wallet size={24} color="#5A2D82" />
                <Text style={styles.balanceLabel}>Current Balance</Text>
              </View>
              <Text style={styles.balanceAmount}>
                {formatCurrency(walletBalanceInDisplayCurrency, displayCurrency)}
              </Text>
              <Text style={styles.balanceNote}>
                {displayCurrency !== 'NGN' ?
                  `Equivalent to ${formatCurrency(profile?.wallet_balance || 0, 'NGN')} in Nigerian Naira` :
                  'Your wallet balance is maintained in Nigerian Naira (NGN)'}
              </Text>
            </View>

            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <TrendingUp size={20} color="#10B981" />
                <Text style={styles.summaryLabel}>Total Credits</Text>
                <Text style={[styles.summaryAmount, { color: '#10B981' }]}>
                  {formatCurrency(totalCredits, displayCurrency)}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <TrendingDown size={20} color="#EF4444" />
                <Text style={styles.summaryLabel}>Total Debits</Text>
                <Text style={[styles.summaryAmount, { color: '#EF4444' }]}>
                  {formatCurrency(totalDebits, displayCurrency)}
                </Text>
              </View>
            </View>

            {/* Wallet Transactions */}
            <View style={styles.transactionsContainer}>
              <View style={styles.sectionHeader}>
                <Calendar size={20} color="#6B7280" />
                <Text style={styles.sectionTitle}>Transaction History</Text>
              </View>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <Text style={styles.loadingText}>Loading transactions...</Text>
                </View>
              ) : transactions.length > 0 ? (
                <View style={styles.transactionsList}>{transactions.map(renderTransaction)}</View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Wallet size={64} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No Transactions Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Your wallet transactions will appear here once you start funding or spending
                  </Text>
                </View>
              )}
            </View>
          </>
        ) : (
          /* Bills Tab */
          <View style={styles.transactionsContainer}>
            <View style={styles.sectionHeader}>
              <Zap size={20} color="#6B7280" />
              <Text style={styles.sectionTitle}>Bill Payments</Text>
            </View>
            <Text style={styles.billsHint}>Tap any entry to see full details. Electricity tokens are shown inside.</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : billTransactions.length > 0 ? (
              <View style={styles.transactionsList}>{billTransactions.map(renderBillCard)}</View>
            ) : (
              <View style={styles.emptyContainer}>
                <Zap size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>No Bill Payments Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your airtime, data, electricity and cable payments will appear here
                </Text>
              </View>
            )}
          </View>
        )}
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
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  balanceLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  balanceNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
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
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  transactionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  transactionsList: {
    gap: 12,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transactionDate: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  paymentProvider: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  providerIcon: {
    fontSize: 12,
  },
  providerText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    marginBottom: 2,
  },
  originalAmount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 20,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  tabActive: {
    borderBottomColor: '#5A2D82',
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#5A2D82',
    fontFamily: 'Inter-SemiBold',
  },
  tabBadge: {
    backgroundColor: '#5A2D82',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  billsHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  tokenBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tokenLabel: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#92400E',
    marginBottom: 8,
  },
  tokenValue: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    letterSpacing: 2,
    marginBottom: 12,
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  copyBtnText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    textAlign: 'right',
    flexShrink: 1,
  },
  modalCloseBtn: {
    marginTop: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
});
