import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Save, DollarSign, Image as ImageIcon } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { validateProductForm } from '@/lib/admin/productValidation';
import type { StoreProduct } from '@/types/product';
import type { ProductFormData } from '../types';
import { categories, defaultSizes, defaultColors } from '../constants';
import { styles } from '../styles';

interface ProductFormModalProps {
  visible: boolean;
  editingProduct: StoreProduct | null;
  isTabletOrWeb: boolean;
  onClose: () => void;
  onSave: (formData: ProductFormData, editingProduct: StoreProduct | null) => Promise<boolean>;
}

function defaultFormData(): ProductFormData {
  return {
    name: '',
    description: '',
    subtitle: '',
    price: '',
    image_url: '',
    categories: [],
    sizes: defaultSizes.join(', '),
    colors: defaultColors.join(', '),
    stock: '0',
    is_active: true,
    is_on_sale: false,
    sale_label: 'SALE',
    min_tier: '',
    compare_at_price: '',
    size_stock: {},
    allow_logo_upload: false,
  };
}

function formDataFromProduct(product: StoreProduct): ProductFormData {
  return {
    name: product.name,
    description: product.description,
    subtitle: product.subtitle || '',
    price: product.price.toString(),
    image_url: product.image_url,
    categories: product.categories || [],
    sizes: (product.sizes || []).join(', '),
    colors: (product.colors || []).join(', '),
    stock: (product.stock ?? 0).toString(),
    is_active: product.is_active ?? true,
    is_on_sale: product.is_on_sale || false,
    sale_label: product.sale_label || 'SALE',
    min_tier: product.min_tier || '',
    compare_at_price: product.compare_at_price?.toString() || '',
    size_stock: product.size_stock
      ? Object.fromEntries(Object.entries(product.size_stock).map(([k, v]) => [k, String(v)]))
      : {},
    allow_logo_upload: product.allow_logo_upload || false,
  };
}

export function ProductFormModal({ visible, editingProduct, isTabletOrWeb, onClose, onSave }: ProductFormModalProps) {
  const [formData, setFormData] = useState<ProductFormData>(defaultFormData());

  useEffect(() => {
    if (visible) {
      setFormData(editingProduct ? formDataFromProduct(editingProduct) : defaultFormData());
    }
  }, [visible, editingProduct]);

  const toggleCategory = (category: string) => {
    setFormData((prev) => {
      const current = prev.categories;

      if (current.includes(category)) {
        return { ...prev, categories: current.filter((c) => c !== category) };
      }

      if (current.length >= 2) {
        Alert.alert('Limit Reached', 'You can select a maximum of 2 categories');
        return prev;
      }

      return { ...prev, categories: [...current, category] };
    });
  };

  const handleSavePress = async () => {
    const errorMsg = validateProductForm(formData);
    if (errorMsg) {
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    const success = await onSave(formData, editingProduct);
    if (success) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add New Product'}</Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <X size={20} color="#6B7280" />
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSavePress}>
              <Save size={16} color="#FFFFFF" />
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            style={[styles.modalContent, isTabletOrWeb && styles.modalContentWide]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                value={formData.name}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
                placeholder="Enter product name"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Description *</Text>
              <TextInput
                style={[styles.formInput, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, description: text }))}
                placeholder="Enter product description"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Detail line</Text>
              <TextInput
                style={styles.formInput}
                value={formData.subtitle}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, subtitle: text }))}
                placeholder="e.g. 220 GSM • Oversized Fit"
                placeholderTextColor="#9CA3AF"
                maxLength={40}
              />
              <Text style={styles.helperText}>Short line shown under the product name on shop cards. Optional.</Text>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.formLabel}>Price (₦) *</Text>
                <View style={styles.inputWithIcon}>
                  <DollarSign size={16} color="#9CA3AF" />
                  <TextInput
                    style={styles.formInputWithIcon}
                    value={formData.price}
                    onChangeText={(text) => setFormData((prev) => ({ ...prev, price: text }))}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.formLabel}>Stock *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formData.stock}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, stock: text }))}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Compare-at price → real discount badge */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Compare-at price (₦) - optional</Text>
              <View style={styles.inputWithIcon}>
                <DollarSign size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.compare_at_price}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, compare_at_price: text }))}
                  placeholder="Original price"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.helperText}>Set higher than the price to show a strikethrough + real "-X%" badge. Leave blank for no discount.</Text>
            </View>

            {/* Per-size stock */}
            {formData.sizes.split(',').map((s) => s.trim()).filter(Boolean).length > 0 && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Stock per size - optional</Text>
                <Text style={styles.helperText}>Fill to show "X left" per size and block sold-out sizes. Leave all blank to use the single Stock above.</Text>
                <View style={styles.sizeStockGrid}>
                  {formData.sizes.split(',').map((s) => s.trim()).filter(Boolean).map((size) => (
                    <View key={size} style={styles.sizeStockItem}>
                      <Text style={styles.sizeStockLabel}>{size}</Text>
                      <TextInput
                        style={styles.sizeStockInput}
                        value={formData.size_stock[size] ?? ''}
                        onChangeText={(text) => setFormData((prev) => ({ ...prev, size_stock: { ...prev.size_stock, [size]: text } }))}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Categories * (Select up to 2)</Text>
              <Text style={styles.formHint}>Selected: {formData.categories.length}/2</Text>

              <View style={styles.categorySelector}>
                {categories.map((category) => (
                  <Pressable
                    key={category}
                    style={[
                      styles.categoryOption,
                      formData.categories.includes(category) && styles.categoryOptionActive,
                    ]}
                    onPress={() => toggleCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        formData.categories.includes(category) && styles.categoryOptionTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Member access</Text>
              <Text style={styles.formHint}>Restrict to a wardrobe tier - locked for shoppers below it.</Text>
              <View style={styles.categorySelector}>
                {[
                  { label: 'Everyone', value: '' },
                  { label: 'Silver+', value: 'Silver' },
                  { label: 'Gold+', value: 'Gold' },
                  { label: 'Platinum', value: 'Platinum' },
                ].map((opt) => (
                  <Pressable
                    key={opt.label}
                    style={[styles.categoryOption, formData.min_tier === opt.value && styles.categoryOptionActive]}
                    onPress={() => setFormData((prev) => ({ ...prev, min_tier: opt.value }))}
                  >
                    <Text style={[styles.categoryOptionText, formData.min_tier === opt.value && styles.categoryOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Image URL *</Text>
              <View style={styles.inputWithIcon}>
                <ImageIcon size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.formInputWithIcon}
                  value={formData.image_url}
                  onChangeText={(text) => setFormData((prev) => ({ ...prev, image_url: text }))}
                  placeholder="https://images.pexels.com/..."
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                />
              </View>

              {formData.image_url ? (
                <Image source={{ uri: optimizeImageUrl(formData.image_url, { width: 600 }) as string }} style={styles.imagePreview} resizeMode="cover" />
              ) : null}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Available Sizes</Text>
              <TextInput
                style={styles.formInput}
                value={formData.sizes}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, sizes: text }))}
                placeholder="XS, S, M, L, XL, XXL"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.formHint}>Separate sizes with commas</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Available Colors</Text>
              <TextInput
                style={styles.formInput}
                value={formData.colors}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, colors: text }))}
                placeholder="Black, White, Navy, Grey"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.formHint}>Separate colours with commas</Text>
            </View>

            <View style={styles.formGroup}>
              <Pressable
                style={styles.toggleContainer}
                onPress={() => setFormData((prev) => ({ ...prev, is_on_sale: !prev.is_on_sale }))}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.formLabel}>Sale label</Text>
                  <Text style={styles.formHint}>{formData.is_on_sale ? 'Customers will see a sale badge' : 'No sale badge'}</Text>
                </View>
                <View style={[styles.toggle, formData.is_on_sale && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.is_on_sale && styles.toggleThumbActive]} />
                </View>
              </Pressable>
              {formData.is_on_sale && <TextInput
                style={[styles.formInput, { marginTop: 10 }]}
                value={formData.sale_label}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, sale_label: text.toUpperCase().slice(0, 14) }))}
                placeholder="SALE, 20% OFF, NEW PRICE"
                placeholderTextColor="#9CA3AF"
                maxLength={14}
              />}
            </View>

            <View style={styles.formGroup}>
              <Pressable
                style={styles.toggleContainer}
                onPress={() => setFormData((prev) => ({ ...prev, allow_logo_upload: !prev.allow_logo_upload }))}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.formLabel}>Allow logo upload</Text>
                  <Text style={styles.formHint}>
                    {formData.allow_logo_upload
                      ? 'Customers can upload a logo / describe a design on this product'
                      : 'No logo box shown for this product'}
                  </Text>
                </View>
                <View style={[styles.toggle, formData.allow_logo_upload && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.allow_logo_upload && styles.toggleThumbActive]} />
                </View>
              </Pressable>
            </View>

            <View style={styles.formGroup}>
              <Pressable
                style={styles.toggleContainer}
                onPress={() => setFormData((prev) => ({ ...prev, is_active: !prev.is_active }))}
              >
                <View style={styles.toggleInfo}>
                  <Text style={styles.formLabel}>Product Status</Text>
                  <Text style={styles.formHint}>
                    {formData.is_active
                      ? 'Product is visible to customers'
                      : 'Product is hidden from customers'}
                  </Text>
                </View>

                <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
                  <View style={[styles.toggleThumb, formData.is_active && styles.toggleThumbActive]} />
                </View>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
