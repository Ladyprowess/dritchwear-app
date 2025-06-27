import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Users, Search, Filter, Wallet, MoreHorizontal, Eye, X } from 'lucide-react-native';
import UserDetailsModal from '@/components/UserDetailsModal';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  location: string | null;
  wallet_balance: number;
  role: string;
  created_at: string;
}

const roleFilters = ['All', 'Customers', 'Admins'];

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setUsers(data);
      filterUsers(data, selectedRole, searchQuery);
    }
    setLoading(false);
  };

  const filterUsers = (usersList: User[], roleFilter: string, search: string) => {
    let filtered = [...usersList];

    // Apply role filter
    if (roleFilter === 'Customers') {
      filtered = filtered.filter(user => user.role === 'customer');
    } else if (roleFilter === 'Admins') {
      filtered = filtered.filter(user => user.role === 'admin');
    }

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchLower) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchLower)) ||
        (user.phone && user.phone.includes(search))
      );
    }

    setFilteredUsers(filtered);
  };

  const handleRoleFilterChange = (role: string) => {
    setSelectedRole(role);
    filterUsers(users, role, searchQuery);
    setShowFilterModal(false);
  };

  const handleSearchChange = (search: string) => {
    setSearchQuery(search);
    filterUsers(users, selectedRole, search);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRoleBadgeColor = (role: string) => {
    return role === 'admin' ? '#7C3AED' : '#10B981';
  };

  const handleUserPress = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const renderUser = (user: User) => (
    <Pressable 
      key={user.id} 
      style={styles.userCard}
      onPress={() => handleUserPress(user)}
    >
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>
            {(user.full_name || user.email).charAt(0).toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>
              {user.full_name || 'No name provided'}
            </Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: `${getRoleBadgeColor(user.role)}20` }
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  { color: getRoleBadgeColor(user.role) }
                ]}
              >
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.userEmail}>{user.email}</Text>
          
          <View style={styles.userMeta}>
            <Text style={styles.userMetaText}>
              Joined {formatDate(user.created_at)}
            </Text>
            {user.phone && (
              <Text style={styles.userMetaText}>• {user.phone}</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.userFooter}>
        <View style={styles.walletInfo}>
          <Wallet size={16} color="#7C3AED" />
          <Text style={styles.walletBalance}>
            {formatCurrency(user.wallet_balance)}
          </Text>
        </View>
        
        <View style={styles.userActions}>
          {user.location && (
            <Text style={styles.locationText} numberOfLines={1}>
              📍 {user.location}
            </Text>
          )}
          <Pressable style={styles.actionButton}>
            <Eye size={16} color="#6B7280" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );

  const customerCount = users.filter(user => user.role === 'customer').length;
  const adminCount = users.filter(user => user.role === 'admin').length;
  const totalWalletBalance = users.reduce((sum, user) => sum + user.wallet_balance, 0);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Users Management</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowSearchModal(true)}
          >
            <Search size={20} color="#6B7280" />
          </Pressable>
          <Pressable 
            style={styles.headerButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Filter size={20} color="#6B7280" />
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{customerCount}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{adminCount}</Text>
          <Text style={styles.statLabel}>Admins</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{formatCurrency(totalWalletBalance)}</Text>
          <Text style={styles.statLabel}>Total Wallet</Text>
        </View>
      </View>

      {/* Active Filters Display */}
      {(selectedRole !== 'All' || searchQuery) && (
        <View style={styles.activeFilters}>
          {selectedRole !== 'All' && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>{selectedRole}</Text>
              <Pressable onPress={() => handleRoleFilterChange('All')}>
                <X size={16} color="#7C3AED" />
              </Pressable>
            </View>
          )}
          {searchQuery && (
            <View style={styles.activeFilter}>
              <Text style={styles.activeFilterText}>"{searchQuery}"</Text>
              <Pressable onPress={() => handleSearchChange('')}>
                <X size={16} color="#7C3AED" />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Users List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading users...</Text>
          </View>
        ) : filteredUsers.length > 0 ? (
          <View style={styles.usersContainer}>
            {filteredUsers.map(renderUser)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Users size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedRole !== 'All'
                ? 'No users match your search criteria'
                : 'No users have registered yet'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Users</Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <X size={24} color="#1F2937" />
              </Pressable>
            </View>
            
            <View style={styles.filterOptions}>
              {roleFilters.map((role) => (
                <Pressable
                  key={role}
                  style={[
                    styles.filterOption,
                    selectedRole === role && styles.filterOptionActive
                  ]}
                  onPress={() => handleRoleFilterChange(role)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      selectedRole === role && styles.filterOptionTextActive
                    ]}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSearchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Users</Text>
              <Pressable onPress={() => setShowSearchModal(false)}>
                <X size={24} color="#1F2937" />
              </Pressable>
            </View>
            
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
            </View>

            <Pressable
              style={styles.searchButton}
              onPress={() => setShowSearchModal(false)}
            >
              <Text style={styles.searchButtonText}>Apply Search</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* User Details Modal */}
      <UserDetailsModal
        user={selectedUser}
        visible={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setSelectedUser(null);
        }}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
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
  statValue: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  usersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMetaText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginRight: 8,
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBalance: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  userActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    maxWidth: 100,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
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
  filterOptions: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
  },
  filterOptionActive: {
    backgroundColor: '#7C3AED',
  },
  filterOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
  },
  filterOptionTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  searchButton: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});