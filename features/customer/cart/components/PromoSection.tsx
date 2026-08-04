import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Tag, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import type { AppliedPromo } from '@/contexts/CartContext';
import { styles } from '../styles';

interface PromoSectionProps {
  validatingPromo: boolean;
  appliedPromo: AppliedPromo | null;
  availablePromos: any[];
  showPromoDropdown: boolean;
  applyingPromo: boolean;
  promoError: string;
  onToggleDropdown: () => void;
  onSelectPromo: (promo: any) => void;
  onRemovePromo: () => void;
}

export function PromoSection({
  validatingPromo,
  appliedPromo,
  availablePromos,
  showPromoDropdown,
  applyingPromo,
  promoError,
  onToggleDropdown,
  onSelectPromo,
  onRemovePromo,
}: PromoSectionProps) {
  return (
    <View style={styles.promoSection}>
      {validatingPromo ? (
        <View style={styles.validatingRow}>
          <ActivityIndicator size="small" color="#5A2D82" />
          <Text style={styles.validatingText}>Validating promo code...</Text>
        </View>
      ) : appliedPromo ? (
        <View style={styles.appliedPromoCard}>
          <View style={styles.appliedPromoInfo}>
            <Tag size={16} color="#10B981" />
            <View style={styles.appliedPromoText}>
              <Text style={styles.appliedPromoCode}>{appliedPromo.code}</Text>
              <Text style={styles.appliedPromoDescription}>{appliedPromo.description}</Text>
            </View>
          </View>
          <Pressable style={styles.removePromoButton} onPress={onRemovePromo}>
            <X size={16} color="#EF4444" />
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable
            style={styles.promoDropdownBtn}
            onPress={onToggleDropdown}
          >
            <View style={styles.promoDropdownLeft}>
              <Tag size={16} color="#5A2D82" />
              <Text style={styles.promoDropdownText}>
                {availablePromos.length > 0 ? 'Select a promo code' : 'No promo codes available'}
              </Text>
            </View>
            {availablePromos.length > 0 && (
              showPromoDropdown
                ? <ChevronUp size={16} color="#5A2D82" />
                : <ChevronDown size={16} color="#5A2D82" />
            )}
          </Pressable>

          {showPromoDropdown && availablePromos.length > 0 && (
            <View style={styles.promoDropdownList}>
              {availablePromos.map(promo => (
                <Pressable
                  key={promo.id}
                  style={styles.promoDropdownItem}
                  onPress={() => onSelectPromo(promo)}
                  disabled={applyingPromo}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoItemCode}>{promo.code}</Text>
                    <Text style={styles.promoItemDesc}>
                      {promo.discount_percentage}% off
                      {promo.description ? ` ${promo.description}` : ''}
                    </Text>
                  </View>
                  {applyingPromo ? <ActivityIndicator size="small" color="#5A2D82" /> : null}
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}
    </View>
  );
}
