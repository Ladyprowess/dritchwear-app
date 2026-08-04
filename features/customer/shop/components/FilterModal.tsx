import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../styles';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLOR_OPTIONS = ['Black', 'White', 'Navy', 'Grey', 'Beige', 'Brown'];

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSizes: string[];
  onToggleSize: (size: string) => void;
  selectedColors: string[];
  onToggleColor: (color: string) => void;
  minPrice: number | null;
  onMinPriceChange: (value: number | null) => void;
  maxPrice: number | null;
  onMaxPriceChange: (value: number | null) => void;
  preferredCurrency: string;
  onClearFilters: () => void;
}

export function FilterModal({
  visible,
  onClose,
  selectedSizes,
  onToggleSize,
  selectedColors,
  onToggleColor,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  preferredCurrency,
  onClearFilters,
}: FilterModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.modalScrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Products</Text>

            <Text style={styles.filterLabel}>Filter by Size</Text>
            <View style={styles.filterGroup}>
              {SIZE_OPTIONS.map(size => (
                <Pressable
                  key={size}
                  onPress={() => onToggleSize(size)}
                  style={[
                    styles.filterChip,
                    selectedSizes.includes(size) && styles.filterChipActive,
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedSizes.includes(size) && styles.filterChipTextActive,
                  ]}>
                    {size}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Filter by Color</Text>
            <View style={styles.filterGroup}>
              {COLOR_OPTIONS.map(color => (
                <Pressable
                  key={color}
                  onPress={() => onToggleColor(color)}
                  style={[
                    styles.filterChip,
                    selectedColors.includes(color) && styles.filterChipActive,
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    selectedColors.includes(color) && styles.filterChipTextActive,
                  ]}>
                    {color}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>
              Price Range ({preferredCurrency})
            </Text>
            <View style={styles.priceInputs}>
              <TextInput
                placeholder="Min Price"
                keyboardType="numeric"
                style={styles.priceInput}
                value={minPrice !== null ? minPrice.toString() : ''}
                onChangeText={(text) => {
                  const parsed = parseInt(text);
                  onMinPriceChange(isNaN(parsed) ? null : parsed);
                }}
              />
              <TextInput
                placeholder="Max Price"
                keyboardType="numeric"
                style={styles.priceInput}
                value={maxPrice !== null ? maxPrice.toString() : ''}
                onChangeText={(text) => {
                  const parsed = parseInt(text);
                  onMaxPriceChange(isNaN(parsed) ? null : parsed);
                }}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.applyButton}
                onPress={onClose}
              >
                <Text style={styles.applyButtonText}>Apply Filter</Text>
              </Pressable>

              <Pressable
                style={styles.clearButton}
                onPress={onClearFilters}
              >
                <Text style={styles.clearButtonText}>Clear Filter</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
