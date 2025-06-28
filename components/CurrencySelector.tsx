import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronDown, Check } from 'lucide-react-native';
import { SUPPORTED_CURRENCIES, Currency, formatCurrency } from '@/lib/currency';

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currencyCode: string) => void;
  showLabel?: boolean;
  style?: any;
}

export default function CurrencySelector({ 
  selectedCurrency, 
  onCurrencyChange, 
  showLabel = true,
  style 
}: CurrencySelectorProps) {
  const [showModal, setShowModal] = useState(false);

  const selectedCurrencyData = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);

  const handleCurrencySelect = (currencyCode: string) => {
    onCurrencyChange(currencyCode);
    setShowModal(false);
  };

  return (
    <>
      <Pressable 
        style={[styles.selector, style]} 
        onPress={() => setShowModal(true)}
      >
        <View style={styles.selectorContent}>
          {showLabel && (
            <Text style={styles.label}>Currency</Text>
          )}
          <View style={styles.selectedCurrency}>
            <Text style={styles.flag}>{selectedCurrencyData?.flag}</Text>
            <Text style={styles.currencyCode}>{selectedCurrency}</Text>
            <ChevronDown size={16} color="#6B7280" />
          </View>
        </View>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Currency</Text>
            <Pressable style={styles.closeButton} onPress={() => setShowModal(false)}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>

          <ScrollView style={styles.currencyList} showsVerticalScrollIndicator={false}>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <Pressable
                key={currency.code}
                style={[
                  styles.currencyItem,
                  selectedCurrency === currency.code && styles.currencyItemSelected
                ]}
                onPress={() => handleCurrencySelect(currency.code)}
              >
                <View style={styles.currencyInfo}>
                  <Text style={styles.currencyFlag}>{currency.flag}</Text>
                  <View style={styles.currencyDetails}>
                    <Text style={styles.currencyItemCode}>{currency.code}</Text>
                    <Text style={styles.currencyItemName}>{currency.name}</Text>
                    <Text style={styles.currencySymbol}>
                      Example: {formatCurrency(100, currency.code)}
                    </Text>
                  </View>
                </View>
                {selectedCurrency === currency.code && (
                  <Check size={20} color="#7C3AED" />
                )}
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Text style={styles.footerNote}>
              💡 Naira payments use Paystack, international currencies use PayPal
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
  },
  selectorContent: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#374151',
  },
  selectedCurrency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flag: {
    fontSize: 20,
  },
  currencyCode: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  currencyName: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
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
  currencyList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
  },
  currencyItemSelected: {
    backgroundColor: '#F3F4F6',
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  currencyFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  currencyDetails: {
    flex: 1,
  },
  currencyItemCode: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 2,
  },
  currencyItemName: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    marginBottom: 2,
  },
  currencySymbol: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
  },
});