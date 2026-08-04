import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Tag, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Percent,
  DollarSign,
  Calendar,
  Users,
  UserCheck,
  ShoppingBag
} from 'lucide-react-native';
import { smartBack } from '@/lib/navigation';

type PromoType = 'percentage' | 'free_delivery' | 'item_percentage';

interface PromoCode {
  id: string;
  code: string;
  type: PromoType;
  discount_percentage: number;
  discount_amount: number | null;
  min_order_amount: number | null;
  min_quantity: number | null;
  max_usage: number | null;
  used_count: number;
  is_active: boolean;
  first_time_only: boolean;
  expires_at: string | null;
  created_at: string;
  applicable_product_id: string | null;
}

interface PromoCodeFormData {
  code: string;
  type: PromoType;
  discount_percentage: string;
  applicable_product_id: string;
  discount_amount: string;
  min_order_amount: string;
  min_quantity: string;
  max_usage: string;
  expires_at: string;
  is_active: boolean;
  first_time_only: boolean;
}

export default function PromoCodesScreen() {
  const router = useRouter();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [formData, setFormData] = useState<PromoCodeFormData>({
    code: '',
    type: 'percentage',
    discount_percentage: '10',
    applicable_product_id: '',
    discount_amount: '',
    min_order_amount: '',
    min_quantity: '',
    max_usage: '',
    expires_at: '',
    is_active: true,
    first_time_only: false,
  });

  const fetchPromoCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (data) {
        setPromoCodes(data);
      }
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      Alert.alert('Error', 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      discount_percentage: '10',
      applicable_product_id: '',
      discount_amount: '',
      min_order_amount: '',
      min_quantity: '',
      max_usage: '',
      expires_at: '',
      is_active: true,
      first_time_only: false,
    });
    setEditingPromo(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (promo: PromoCode) => {
    setEditingPromo(promo);
    setFormData({
      code: promo.code,
      type: promo.type ?? 'percentage',
      discount_percentage: promo.discount_percentage.toString(),
      applicable_product_id: promo.applicable_product_id ?? '',
      discount_amount: promo.discount_amount?.toString() || '',
      min_order_amount: promo.min_order_amount?.toString() || '',
      min_quantity: promo.min_quantity?.toString() || '',
      max_usage: promo.max_usage?.toString() || '',
      expires_at: promo.expires_at ? new Date(promo.expires_at).toISOString().split('T')[0] : '',
      is_active: promo.is_active,
      first_time_only: promo.first_time_only,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const validateForm = (): string | null => {
    if (!formData.code.trim()) return 'Promo code is required';
    if (formData.type !== 'free_delivery') {
      if (!formData.discount_percentage || isNaN(Number(formData.discount_percentage)) || Number(formData.discount_percentage) <= 0) {
        return 'Valid discount percentage is required';
      }
      if (Number(formData.discount_percentage) > 100) {
        return 'Discount percentage cannot exceed 100%';
      }
    }
    if (formData.type === 'item_percentage' && !formData.applicable_product_id.trim()) {
      return 'Product ID is required for item discount';
    }
    if (formData.expires_at.trim() && isNaN(new Date(formData.expires_at.trim()).getTime())) {
      return 'Expiry date must be a valid date (YYYY-MM-DD)';
    }
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    const promoData = {
      type: formData.type,
      discount_percentage: formData.type === 'free_delivery' ? 0 : Number(formData.discount_percentage),
      applicable_product_id: formData.type === 'item_percentage' && formData.applicable_product_id.trim()
        ? formData.applicable_product_id.trim()
        : null,
      discount_amount: formData.discount_amount ? Number(formData.discount_amount) : null,
      min_order_amount: formData.min_order_amount ? Number(formData.min_order_amount) : null,
      min_quantity: formData.min_quantity ? Number(formData.min_quantity) : null,
      max_usage: formData.max_usage ? Number(formData.max_usage) : null,
      // Treat the date as "valid through end of this day" rather than UTC
      // midnight, so codes don't read as expired for most of the last day
      // the admin intended them to work (validateForm already confirmed
      // this parses to a valid date).
      expires_at: formData.expires_at.trim() ? new Date(`${formData.expires_at.trim()}T23:59:59`).toISOString() : null,
      is_active: formData.is_active,
      first_time_only: formData.first_time_only,
    };

    try {
      if (editingPromo) {
        // When editing, don't include the code field
        const { error } = await supabase
          .from('promo_codes')
          .update(promoData)
          .eq('id', editingPromo.id);

        if (error) throw error;
        Alert.alert('Success', 'Promo code updated successfully');
      } else {
        // When creating, include the code field
        const { error } = await supabase
          .from('promo_codes')
          .insert({
            ...promoData,
            code: formData.code.trim().toUpperCase(),
          });

        if (error) throw error;
        Alert.alert('Success', 'Promo code created successfully');
      }

      closeModal();
      fetchPromoCodes();
    } catch (error: any) {
      console.log('PROMO SAVE ERROR:', error);
      
      const code = error?.code ?? 'UNKNOWN';
      const message = error?.message ?? 'An error occurred';
      
      if (code === '23505') {
        Alert.alert('Error', 'This promo code already exists');
      } else if (code === '42501') {
        Alert.alert('Error', 'Permission denied. Please check your admin permissions.');
      } else {
        Alert.alert('Error', `Failed to save promo code: ${message}`);
      }
    }
  };

  const handleDelete = (promo: PromoCode) => {
    Alert.alert(
      'Delete Promo Code',
      `Are you sure you want to delete "${promo.code}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('promo_codes')
                .delete()
                .eq('id', promo.id);

              if (error) throw error;
              Alert.alert('Success', 'Promo code deleted successfully');
              fetchPromoCodes();
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete promo code');
            }
          },
        },
      ]
    );
  };

  const togglePromoStatus = async (promo: PromoCode) => {
    try {
      const { error } = await supabase
        .from('promo_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (error) throw error;
      fetchPromoCodes();
    } catch (error) {
      console.error('Toggle status error:', error);
      Alert.alert('Error', 'Failed to update promo code status');
    }
  };

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

  const renderPromoCode = (promo: PromoCode) => (
    <View key={promo.id} style={styles.promoCard}>
      <View style={styles.promoHeader}>
        <View style={styles.promoInfo}>
          <View style={styles.promoTitleRow}>
            <View style={styles.promoTitleContainer}>
              <Text style={styles.promoCode}>{promo.code}</Text>
              {promo.first_time_only && (
                <View style={styles.firstTimeBadge}>
                  <UserCheck size={12} color="#5A2D82" />
                  <Text style={styles.firstTimeBadgeText}>First Time Only</Text>
                </View>
              )}
            </View>
            <View style={styles.promoActions}>
              <Pressable
                style={[styles.actionButton, styles.editButton]}
                onPress={() => openEditModal(promo)}
              >
                <Edit3 size={14} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(promo)}
              >
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          
          <View style={styles.promoDetails}>
            <Text style={styles.discountText}>
              {promo.type === 'free_delivery'
                ? '🚚 Free Delivery'
                : promo.type === 'item_percentage'
                ? `${promo.discount_percentage}% off (selected item)`
                : `${promo.discount_percentage}% off`}
              {promo.discount_amount && promo.type !== 'free_delivery'
                ? ` (max ${formatCurrency(promo.discount_amount)})`
                : ''}
            </Text>
            {promo.min_order_amount && (
              <Text style={styles.minOrderText}>
                Min order: {formatCurrency(promo.min_order_amount)}
              </Text>
            )}
          </View>
          
          <View style={styles.promoMeta}>
            <Text style={styles.usageText}>
              Used: {promo.used_count}{promo.max_usage ? `/${promo.max_usage}` : ''}
            </Text>
            {promo.expires_at && (
              <Text style={styles.expiryText}>
                Expires: {formatDate(promo.expires_at)}
              </Text>
            )}
          </View>
        </View>
        
        <Pressable
          style={[
            styles.statusButton,
            promo.is_active ? styles.activeStatus : styles.inactiveStatus
          ]}
          onPress={() => togglePromoStatus(promo)}
        >
          <Text
            style={[
              styles.statusText,
              { color: promo.is_active ? '#10B981' : '#EF4444' }
            ]}
          >
            {promo.is_active ? 'Active' : 'Inactive'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.replace('/(admin)/settings')}
        >
          <ArrowLeft size={24} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Promo Codes</Text>
        <Pressable style={styles.addButton} onPress={openAddModal}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading promo codes...</Text>
          </View>
        ) : promoCodes.length > 0 ? (
          <View style={styles.promoContainer}>
            {promoCodes.map(renderPromoCode)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Tag size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Promo Codes</Text>
            <Text style={styles.emptySubtitle}>
              Create your first promo code to start offering discounts
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Promo Code Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingPromo ? 'Edit Promo Code' : 'Create Promo Code'}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={closeModal}>
                <X size={20} color="#6B7280" />
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Save size={16} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Promo Code */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                Promo Code *
                {editingPromo && <Text style={styles.disabledNote}> (Cannot be changed)</Text>}
              </Text>
              <TextInput
                style={[
                  styles.formInput,
                  editingPromo && styles.formInputDisabled
                ]}
                value={formData.code}
                onChangeText={(text) => setFormData(prev => ({ ...prev, code: text.toUpperCase() }))}
                placeholder="Enter promo code (e.g., SAVE20)"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                editable={!editingPromo}
              />
            </View>

            {/* Promo Type */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Promo Type *</Text>
              <View style={styles.typeRow}>
                {(['percentage', 'free_delivery', 'item_percentage'] as PromoType[]).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeBtn, formData.type === t && styles.typeBtnActive]}
                    onPress={() => setFormData(prev => ({ ...prev, type: t }))}
                  >
                    <Text style={[styles.typeBtnText, formData.type === t && styles.typeBtnTextActive]}>
                      {t === 'percentage' ? '% Off' : t === 'free_delivery' ? '🚚 Free Delivery' : '% Item'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Discount Percentage - hidden for free_delivery */}
            {formData.type !== 'free_delivery' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Discount Percentage *
                  {formData.type === 'item_percentage' ? ' (on selected item only)' : ''}
                </Text>
                <View style={styles.inputWithIcon}>
                  <Percent size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.formInputWithIcon}
                    value={formData.discount_percentage}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, discount_percentage: text }))}
                    placeholder="10"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}

            {/* Product ID - shown only for item_percentage */}
            {formData.type === 'item_percentage' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Product ID *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.applicable_product_id}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, applicable_product_id: text }))}
                  placeholder="Paste product UUID from Supabase"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Max Discount Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Max Discount Amount (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <DollarSign size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.discount_amount}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, discount_amount: text }))}
                  placeholder="5000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Minimum Order Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Minimum Order Amount (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <DollarSign size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.min_order_amount}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, min_order_amount: text }))}
                  placeholder="10000"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Minimum Quantity */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Minimum Quantity (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <ShoppingBag size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.min_quantity}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, min_quantity: text }))}
                  placeholder="e.g. 3 (great for 'free delivery on 3+ items')"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Max Usage */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Max Usage (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <Users size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.max_usage}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, max_usage: text }))}
                  placeholder="100"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Expiry Date */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Expiry Date (Optional)</Text>
              <View style={styles.inputWithIcon}>
                <Calendar size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.expires_at}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, expires_at: text }))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* First Time Users Only */}
            <View style={styles.formGroup}>
              <Pressable
                style={styles.toggleContainer}
                onPress={() => setFormData(prev => ({ ...prev, first_time_only: !prev.first_time_only }))}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.formLabel}>First Time Users Only</Text>
                  <Text style={styles.formHint}>
                    {formData.first_time_only 
                      ? 'Only users who have never placed an order can use this code' 
                      : 'All users can use this promo code'}
                  </Text>
                </View>
                <View style={[styles.toggle, formData.first_time_only && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.first_time_only && styles.toggleThumbActive]} />
                </View>
              </Pressable>
            </View>

            {/* Active Status */}
            <View style={styles.formGroup}>
              <Pressable
                style={styles.toggleContainer}
                onPress={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.formLabel}>Active Status</Text>
                  <Text style={styles.formHint}>
                    {formData.is_active ? 'Promo code is active and can be used' : 'Promo code is inactive'}
                  </Text>
                </View>
                <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.is_active && styles.toggleThumbActive]} />
                </View>
              </Pressable>
            </View>
          </ScrollView>
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5A2D82',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  typeBtnActive: {
    borderColor: '#5A2D82',
    backgroundColor: '#EDE9F6',
  },
  typeBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  typeBtnTextActive: {
    color: '#5A2D82',
  },
  scrollView: {
    flex: 1,
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
  promoContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  promoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  promoInfo: {
    flex: 1,
  },
  promoTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  promoTitleContainer: {
    flex: 1,
  },
  promoCode: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  firstTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  firstTimeBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
  },
  promoActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  promoDetails: {
    marginBottom: 8,
  },
  discountText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
    marginBottom: 2,
  },
  minOrderText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  promoMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
  },
  expiryText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  activeStatus: {
    backgroundColor: '#D1FAE5',
  },
  inactiveStatus: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
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
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5A2D82',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
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
  disabledNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
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
    backgroundColor: '#FFFFFF',
  },
  formInputDisabled: {
    backgroundColor: '#F9FAFB',
    color: '#9CA3AF',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  formInputWithIcon: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 8,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  formHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  toggleInfo: {
    flex: 1,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#5A2D82',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});