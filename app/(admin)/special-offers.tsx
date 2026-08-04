import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  Plus, 
  Gift, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Percent,
  Type,
  FileText
} from 'lucide-react-native';

interface SpecialOffer {
  id: string;
  title: string;
  subtitle: string;
  discount_text: string;
  promo_code: string;
  is_active: boolean;
  created_at: string;
}

interface OfferFormData {
  title: string;
  subtitle: string;
  discount_text: string;
  promo_code: string;
  is_active: boolean;
}

export default function SpecialOffersScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<SpecialOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState<SpecialOffer | null>(null);
  const [formData, setFormData] = useState<OfferFormData>({
    title: '',
    subtitle: '',
    discount_text: '',
    promo_code: '',
    is_active: true,
  });

  const fetchOffers = async () => {
    const { data } = await supabase
      .from('special_offers')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setOffers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const resetForm = () => {
    setFormData({
      title: '',
      subtitle: '',
      discount_text: '',
      promo_code: '',
      is_active: true,
    });
    setEditingOffer(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (offer: SpecialOffer) => {
    setEditingOffer(offer);
    setFormData({
      title: offer.title,
      subtitle: offer.subtitle,
      discount_text: offer.discount_text,
      promo_code: offer.promo_code,
      is_active: offer.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const validateForm = (): string | null => {
    if (!formData.title.trim()) return 'Title is required';
    if (!formData.subtitle.trim()) return 'Subtitle is required';
    if (!formData.discount_text.trim()) return 'Discount text is required';
    if (!formData.promo_code.trim()) return 'Promo code is required';
    return null;
  };

  const handleSave = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    const offerData = {
      title: formData.title.trim(),
      subtitle: formData.subtitle.trim(),
      discount_text: formData.discount_text.trim(),
      promo_code: formData.promo_code.trim().toUpperCase(),
      is_active: formData.is_active,
    };

    try {
      if (editingOffer) {
        const { error } = await supabase
          .from('special_offers')
          .update(offerData)
          .eq('id', editingOffer.id);

        if (error) throw error;
        Alert.alert('Success', 'Special offer updated successfully');
      } else {
        const { error } = await supabase
          .from('special_offers')
          .insert(offerData);

        if (error) throw error;
        Alert.alert('Success', 'Special offer created successfully');
      }

      closeModal();
      fetchOffers();
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save special offer');
    }
  };

  const handleDelete = (offer: SpecialOffer) => {
    Alert.alert(
      'Delete Special Offer',
      `Are you sure you want to delete "${offer.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('special_offers')
                .delete()
                .eq('id', offer.id);

              if (error) throw error;
              Alert.alert('Success', 'Special offer deleted successfully');
              fetchOffers();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete special offer');
            }
          },
        },
      ]
    );
  };

  const toggleOfferStatus = async (offer: SpecialOffer) => {
    try {
      const { error } = await supabase
        .from('special_offers')
        .update({ is_active: !offer.is_active })
        .eq('id', offer.id);

      if (error) throw error;
      fetchOffers();
    } catch (error) {
      Alert.alert('Error', 'Failed to update offer status');
    }
  };

  const renderOffer = (offer: SpecialOffer) => (
    <View key={offer.id} style={styles.offerCard}>
      <View style={styles.offerHeader}>
        <View style={styles.offerInfo}>
          <View style={styles.offerTitleRow}>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            <View style={styles.offerActions}>
              <Pressable
                style={[styles.actionButton, styles.editButton]}
                onPress={() => openEditModal(offer)}
              >
                <Edit3 size={14} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(offer)}
              >
                <Trash2 size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
          
          <Text style={styles.offerSubtitle}>{offer.subtitle}</Text>
          
          <View style={styles.offerDetails}>
            <Text style={styles.discountText}>{offer.discount_text}</Text>
            <Text style={styles.promoCode}>Code: {offer.promo_code}</Text>
          </View>
        </View>
        
        <Pressable
          style={[
            styles.statusButton,
            offer.is_active ? styles.activeStatus : styles.inactiveStatus
          ]}
          onPress={() => toggleOfferStatus(offer)}
        >
          <Text
            style={[
              styles.statusText,
              { color: offer.is_active ? '#10B981' : '#EF4444' }
            ]}
          >
            {offer.is_active ? 'Active' : 'Inactive'}
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
        <Text style={styles.headerTitle}>Special Offers</Text>
        <Pressable style={styles.addButton} onPress={openAddModal}>
          <Plus size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading special offers...</Text>
          </View>
        ) : offers.length > 0 ? (
          <View style={styles.offersContainer}>
            {offers.map(renderOffer)}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Gift size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Special Offers</Text>
            <Text style={styles.emptySubtitle}>
              Create your first special offer to display on the customer homepage
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit Offer Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingOffer ? 'Edit Special Offer' : 'Create Special Offer'}
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
            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title *</Text>
              <View style={styles.inputWithIcon}>
                <Type size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.title}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
                  placeholder="Special Offer!"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Subtitle */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Subtitle *</Text>
              <View style={styles.inputWithIcon}>
                <FileText size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.subtitle}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, subtitle: text }))}
                  placeholder="Get 20% off your first order"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Discount Text */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Discount Text *</Text>
              <View style={styles.inputWithIcon}>
                <Percent size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.discount_text}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, discount_text: text }))}
                  placeholder="Use code: FIRST20"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            {/* Promo Code */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Promo Code *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.promo_code}
                onChangeText={(text) => setFormData(prev => ({ ...prev, promo_code: text.toUpperCase() }))}
                placeholder="FIRST20"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
              />
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
                    {formData.is_active ? 'Offer is visible on homepage' : 'Offer is hidden from homepage'}
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
  offersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  offerCard: {
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
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  offerInfo: {
    flex: 1,
  },
  offerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    flex: 1,
  },
  offerActions: {
    flexDirection: 'row',
    gap: 6,
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
  offerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 8,
  },
  offerDetails: {
    marginBottom: 8,
  },
  discountText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#5A2D82',
    marginBottom: 4,
  },
  promoCode: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
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