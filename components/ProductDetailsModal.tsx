import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Trash2, Save, Image as ImageIcon, Star, ArrowUp, ArrowDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'react-native';


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
}

interface ProductImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

interface ProductDetailsModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
}

export default function ProductDetailsModal({ product, visible, onClose }: ProductDetailsModalProps) {
  const { isAdmin } = useAuth();
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');

  useEffect(() => {
    if (visible && product) {
      fetchProductImages();
    }
  }, [visible, product]);

  const fetchProductImages = async () => {
    if (!product) return;

    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', product.id)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setProductImages(data);
      } else {
        // Fallback to main product image
        setProductImages([{
          id: 'main',
          image_url: product.image_url,
          alt_text: product.name,
          display_order: 0,
          is_primary: true
        }]);
      }
    } catch (error) {
      console.error('Error fetching product images:', error);
    }
  };

  const handleAddImage = async () => {
    if (!newImageUrl.trim() || !product) {
      Alert.alert('Error', 'Please enter a valid image URL');
      return;
    }

    setLoading(true);
    try {
      const nextOrder = Math.max(...productImages.map(img => img.display_order), -1) + 1;
      
      const { error } = await supabase
        .from('product_images')
        .insert({
          product_id: product.id,
          image_url: newImageUrl.trim(),
          alt_text: newImageAlt.trim() || null,
          display_order: nextOrder,
          is_primary: productImages.length === 0
        });

      if (error) throw error;

      setNewImageUrl('');
      setNewImageAlt('');
      setShowImageModal(false);
      await fetchProductImages();
      Alert.alert('Success', 'Image added successfully');
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (productImages.length <= 1) {
      Alert.alert('Error', 'Cannot delete the last image');
      return;
    }

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('product_images')
                .delete()
                .eq('id', imageId);

              if (error) throw error;
              await fetchProductImages();
              Alert.alert('Success', 'Image deleted successfully');
            } catch (error) {
              console.error('Error deleting image:', error);
              Alert.alert('Error', 'Failed to delete image');
            }
          }
        }
      ]
    );
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;
      await fetchProductImages();
      Alert.alert('Success', 'Primary image updated');
    } catch (error) {
      console.error('Error setting primary image:', error);
      Alert.alert('Error', 'Failed to update primary image');
    }
  };

  const handleMoveImage = async (imageId: string, direction: 'up' | 'down') => {
    const currentIndex = productImages.findIndex(img => img.id === imageId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= productImages.length) return;

    try {
      const currentImage = productImages[currentIndex];
      const swapImage = productImages[newIndex];

      // Swap display orders
      await supabase
        .from('product_images')
        .update({ display_order: swapImage.display_order })
        .eq('id', currentImage.id);

      await supabase
        .from('product_images')
        .update({ display_order: currentImage.display_order })
        .eq('id', swapImage.id);

      await fetchProductImages();
    } catch (error) {
      console.error('Error moving image:', error);
      Alert.alert('Error', 'Failed to reorder image');
    }
  };

  if (!product) return null;

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Product Details</Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Product Images Gallery */}
            <View style={styles.imageSection}>
              <View style={styles.imageSectionHeader}>
                <Text style={styles.sectionTitle}>Product Images</Text>
                {isAdmin && (
                  <Pressable
                    style={styles.addImageButton}
                    onPress={() => setShowImageModal(true)}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text style={styles.addImageText}>Add Image</Text>
                  </Pressable>
                )}
              </View>

              <FlatList
                data={productImages}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.imageGallery}
                renderItem={({ item, index }) => (
                  <View style={styles.imageContainer}>
                    <View style={styles.imageWrapper}>
                    <Image
  source={{ uri: item.image_url }}
  style={styles.productImage}
  resizeMode="cover"
/>

                      {item.is_primary && (
                        <View style={styles.primaryBadge}>
                          <Star size={12} color="#FFFFFF" fill="#FFFFFF" />
                          <Text style={styles.primaryText}>Primary</Text>
                        </View>
                      )}
                    </View>

                    {isAdmin && (
                      <View style={styles.imageControls}>
                        <View style={styles.imageControlsRow}>
                          <Pressable
                            style={[styles.controlButton, styles.moveButton]}
                            onPress={() => handleMoveImage(item.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp size={12} color={index === 0 ? "#9CA3AF" : "#6B7280"} />
                          </Pressable>
                          <Pressable
                            style={[styles.controlButton, styles.moveButton]}
                            onPress={() => handleMoveImage(item.id, 'down')}
                            disabled={index === productImages.length - 1}
                          >
                            <ArrowDown size={12} color={index === productImages.length - 1 ? "#9CA3AF" : "#6B7280"} />
                          </Pressable>
                        </View>
                        <View style={styles.imageControlsRow}>
                          {!item.is_primary && (
                            <Pressable
                              style={[styles.controlButton, styles.primaryButton]}
                              onPress={() => handleSetPrimary(item.id)}
                            >
                              <Star size={12} color="#FFFFFF" />
                            </Pressable>
                          )}
                          <Pressable
                            style={[styles.controlButton, styles.deleteButton]}
                            onPress={() => handleDeleteImage(item.id)}
                          >
                            <Trash2 size={12} color="#FFFFFF" />
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              />
            </View>

            {/* Product Information */}
            <View style={styles.infoSection}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productPrice}>₦{product.price.toLocaleString()}</Text>
              <Text style={styles.productDescription}>{product.description}</Text>
              
              <View style={styles.productMeta}>
                <Text style={styles.metaItem}>Category: {product.category}</Text>
                <Text style={styles.metaItem}>Stock: {product.stock}</Text>
                <Text style={styles.metaItem}>
                  Status: {product.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>

              {/* Sizes - Only show if available */}
              {product.sizes && product.sizes.length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.variantTitle}>Available Sizes</Text>
                  <View style={styles.variantList}>
                    {product.sizes.map((size, index) => (
                      <View key={index} style={styles.variantChip}>
                        <Text style={styles.variantText}>{size}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Colors - Only show if available */}
              {product.colors && product.colors.length > 0 && (
                <View style={styles.variantSection}>
                  <Text style={styles.variantTitle}>Available Colors</Text>
                  <View style={styles.variantList}>
                    {product.colors.map((color, index) => (
                      <View key={index} style={styles.variantChip}>
                        <Text style={styles.variantText}>{color}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add Image Modal */}
      <Modal
        visible={showImageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowImageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addImageModal}>
            <Text style={styles.addImageModalTitle}>Add Product Image</Text>
            
            <View style={styles.addImageForm}>
              <Text style={styles.formLabel}>Image URL *</Text>
              <TextInput
                style={styles.formInput}
                value={newImageUrl}
                onChangeText={setNewImageUrl}
                placeholder="https://images.pexels.com/..."
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />

              <Text style={styles.formLabel}>Alt Text</Text>
              <TextInput
                style={styles.formInput}
                value={newImageAlt}
                onChangeText={setNewImageAlt}
                placeholder="Describe the image"
                placeholderTextColor="#9CA3AF"
              />

              {newImageUrl ? (
                <View style={styles.imagePreviewContainer}>
                  <Text style={styles.previewLabel}>Preview:</Text>
                  <Image
  source={{ uri: newImageUrl }}
  style={styles.imagePreview}
  resizeMode="cover"
/>

                </View>
              ) : null}
            </View>

            <View style={styles.addImageModalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => {
                  setShowImageModal(false);
                  setNewImageUrl('');
                  setNewImageAlt('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddImage}
                disabled={loading || !newImageUrl.trim()}
              >
                <Save size={16} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {loading ? 'Adding...' : 'Add Image'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  imageSection: {
    paddingVertical: 20,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addImageText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  imageGallery: {
    paddingHorizontal: 20,
    gap: 12,
  },
  imageContainer: {
    width: 200,
    marginRight: 12,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  primaryText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  imageControls: {
    gap: 4,
  },
  imageControlsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButton: {
    backgroundColor: '#F3F4F6',
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  productName: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#7C3AED',
    marginBottom: 12,
  },
  productDescription: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 16,
  },
  productMeta: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metaItem: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 4,
  },
  variantSection: {
    marginBottom: 16,
  },
  variantTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  variantList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  variantText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  addImageModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  addImageForm: {
    marginBottom: 24,
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
    marginBottom: 16,
  },
  imagePreviewContainer: {
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
    marginBottom: 8,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
  },
  addImageModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});