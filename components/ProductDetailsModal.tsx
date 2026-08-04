import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Alert, TextInput, FlatList, Platform } from 'react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StoreProduct } from '@/types/product';
import { X, Plus, Trash2, Save, Image as ImageIcon, Star, ArrowUp, ArrowDown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Image } from 'react-native';


interface ProductImage {
  id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

interface ProductDetailsModalProps {
  product: StoreProduct | null;
  visible: boolean;
  onClose: () => void;
  onImagesChange?: (primaryImageUrl?: string) => void | Promise<void>;
}

const orderImages = (images: ProductImage[]) => [...images].sort((a, b) => {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  return a.display_order - b.display_order;
});

export default function ProductDetailsModal({ product, visible, onClose, onImagesChange }: ProductDetailsModalProps) {
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
        .order('is_primary', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setProductImages(orderImages(data));
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
      // productImages always holds at least the synthetic 'main' fallback row, so
      // count only real rows to decide whether this is the product's first image.
      const realImages = productImages.filter((img) => img.id !== 'main');
      const isFirstRealImage = realImages.length === 0;
      const nextOrder = Math.max(...realImages.map((img) => img.display_order), -1) + 1;

      const trimmedUrl = newImageUrl.trim();
      const { error } = await supabase
        .from('product_images')
        .insert({
          product_id: product.id,
          image_url: trimmedUrl,
          alt_text: newImageAlt.trim() || null,
          display_order: nextOrder,
          is_primary: isFirstRealImage
        });

      if (error) throw error;

      // First real image becomes primary - mirror it to products.image_url.
      if (isFirstRealImage) {
        await supabase
          .from('products')
          .update({ image_url: trimmedUrl })
          .eq('id', product.id);
      }

      setNewImageUrl('');
      setNewImageAlt('');
      setShowImageModal(false);
      await fetchProductImages();
      await onImagesChange?.(isFirstRealImage ? trimmedUrl : undefined);
      Alert.alert('Success', 'Image added successfully');
    } catch (error) {
      console.error('Error adding image:', error);
      Alert.alert('Error', 'Failed to add image');
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (imageId: string) => {
    if (!product) return;
    try {
      const deleted = productImages.find((img) => img.id === imageId);

      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      // If we deleted the primary image, promote the next remaining one so the
      // product never ends up with no primary (which would make every customer
      // surface fall back to the stale products.image_url).
      if (deleted?.is_primary) {
        const remaining = productImages
          .filter((img) => img.id !== imageId)
          .sort((a, b) => a.display_order - b.display_order);

        if (remaining.length > 0) {
          const newPrimary = remaining[0];
          await supabase
            .from('product_images')
            .update({ is_primary: true })
            .eq('id', newPrimary.id);
          await supabase
            .from('products')
            .update({ image_url: newPrimary.image_url })
            .eq('id', product.id);
        }
      }

      await fetchProductImages();
      await onImagesChange?.();
      Alert.alert('Success', 'Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Error', 'Failed to delete image');
    }
  };

  const handleDeleteImage = (imageId: string) => {
    if (productImages.length <= 1) {
      Alert.alert('Error', 'Cannot delete the last image');
      return;
    }

    // Alert.alert with multiple buttons is a no-op on react-native-web, so the
    // web admin could never confirm a delete. Use the native confirm there.
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' &&
        window.confirm('Are you sure you want to delete this image?');
      if (confirmed) deleteImage(imageId);
      return;
    }

    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteImage(imageId) },
      ]
    );
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!product) return;
    try {
      // Clear the existing primary first. Setting a second is_primary=true without
      // clearing the old one fails when the table has a "one primary per product"
      // unique index, and otherwise leaves two primaries (ambiguous everywhere).
      const { error: clearError } = await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', product.id)
        .eq('is_primary', true);

      if (clearError) throw clearError;

      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;

      // Keep products.image_url in sync - the customer shop grid, home and cart
      // read products.image_url directly, not product_images.is_primary.
      const selected = productImages.find((img) => img.id === imageId);
      if (selected) {
        const { error: productSyncError } = await supabase
          .from('products')
          .update({ image_url: selected.image_url })
          .eq('id', product.id);
        if (productSyncError) throw productSyncError;
      }

      await fetchProductImages();
      await onImagesChange?.(selected?.image_url);
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
        presentationStyle="fullScreen"
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
  source={{ uri: optimizeImageUrl(item.image_url, { width: 800 }) as string }}
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
  source={{ uri: optimizeImageUrl(newImageUrl, { width: 600 }) as string }}
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
    backgroundColor: '#5A2D82',
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
    backgroundColor: '#5A2D82',
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
    color: '#5A2D82',
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
    backgroundColor: '#5A2D82',
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
    backgroundColor: '#5A2D82',
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
