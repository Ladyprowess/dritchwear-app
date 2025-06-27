import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Package, Tag, Eye, EyeOff, Calendar } from 'lucide-react-native';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  sizes: string[];
  colors: string[];
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductDetailsModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
}

export default function ProductDetailsModal({ product, visible, onClose }: ProductDetailsModalProps) {
  if (!product) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Product Details</Text>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <X size={24} color="#1F2937" />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Product Image */}
          <Image
            source={{ uri: product.image_url }}
            style={styles.productImage}
            resizeMode="cover"
          />

          {/* Product Info */}
          <View style={styles.productInfo}>
            <View style={styles.productHeader}>
              <Text style={styles.productName}>{product.name}</Text>
              <View style={styles.statusContainer}>
                {product.is_active ? (
                  <View style={styles.activeStatus}>
                    <Eye size={16} color="#10B981" />
                    <Text style={styles.activeText}>Active</Text>
                  </View>
                ) : (
                  <View style={styles.inactiveStatus}>
                    <EyeOff size={16} color="#EF4444" />
                    <Text style={styles.inactiveText}>Inactive</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
            <Text style={styles.productDescription}>{product.description}</Text>

            <View style={styles.categoryContainer}>
              <Tag size={16} color="#7C3AED" />
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          </View>

          {/* Product Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Product ID</Text>
                <Text style={styles.detailValue}>#{product.id.slice(0, 8)}</Text>
              </View>
              
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Stock Quantity</Text>
                <Text style={[
                  styles.detailValue,
                  { color: product.stock > 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {product.stock} {product.stock === 1 ? 'item' : 'items'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <Text style={[
                  styles.detailValue,
                  { color: product.is_active ? '#10B981' : '#EF4444' }
                ]}>
                  {product.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>

          {/* Variants */}
          <View style={styles.variantsSection}>
            <Text style={styles.sectionTitle}>Available Variants</Text>
            
            <View style={styles.variantCard}>
              <Text style={styles.variantTitle}>Sizes</Text>
              <View style={styles.variantOptions}>
                {product.sizes.map((size, index) => (
                  <View key={index} style={styles.variantChip}>
                    <Text style={styles.variantText}>{size}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.variantCard}>
              <Text style={styles.variantTitle}>Colors</Text>
              <View style={styles.variantOptions}>
                {product.colors.map((color, index) => (
                  <View key={index} style={styles.variantChip}>
                    <Text style={styles.variantText}>{color}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Timestamps */}
          <View style={styles.timestampsSection}>
            <Text style={styles.sectionTitle}>Timestamps</Text>
            
            <View style={styles.timestampCard}>
              <View style={styles.timestampRow}>
                <Calendar size={16} color="#6B7280" />
                <View style={styles.timestampInfo}>
                  <Text style={styles.timestampLabel}>Created</Text>
                  <Text style={styles.timestampValue}>
                    {formatDate(product.created_at)}
                  </Text>
                </View>
              </View>

              <View style={styles.timestampRow}>
                <Calendar size={16} color="#6B7280" />
                <View style={styles.timestampInfo}>
                  <Text style={styles.timestampLabel}>Last Updated</Text>
                  <Text style={styles.timestampValue}>
                    {formatDate(product.updated_at)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
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
  scrollView: {
    flex: 1,
  },
  productImage: {
    width: '100%',
    height: 300,
  },
  productInfo: {
    padding: 20,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productName: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginRight: 16,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  activeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  inactiveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  inactiveText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
  },
  productPrice: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
    marginBottom: 16,
  },
  productDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 16,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  detailsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  variantsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  variantCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  variantTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  variantOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  variantText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
  },
  timestampsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  timestampCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  timestampInfo: {
    flex: 1,
  },
  timestampLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  timestampValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
});