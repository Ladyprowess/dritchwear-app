import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Tag, ChevronDown, ChevronUp, Check } from 'lucide-react-native';
import type { AppliedPromo } from '@/contexts/CartContext';
import type { AvailableOffer } from '../types';
import { styles } from '../styles';

interface OffersSectionProps {
  availableOffers: AvailableOffer[];
  showOffers: boolean;
  onToggleOffers: () => void;
  appliedPromo: AppliedPromo | null;
  applyingOffer: boolean;
  onApplyOffer: (offer: AvailableOffer) => void;
}

export function OffersSection({ availableOffers, showOffers, onToggleOffers, appliedPromo, applyingOffer, onApplyOffer }: OffersSectionProps) {
  if (availableOffers.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.offersToggleRow}
        onPress={onToggleOffers}
      >
        <View style={styles.offersToggleLeft}>
          <Tag size={18} color="#5A2D82" />
          <Text style={styles.offersToggleText}>
            {appliedPromo ? `Offer applied: ${appliedPromo.code}` : 'Available Offers'}
          </Text>
        </View>
        {showOffers ? <ChevronUp size={18} color="#5A2D82" /> : <ChevronDown size={18} color="#5A2D82" />}
      </Pressable>

      {showOffers && (
        <View style={styles.offersListCard}>
          {availableOffers.map(offer => {
            const isApplied = appliedPromo?.code === offer.code;
            return (
              <Pressable
                key={offer.id}
                style={[styles.offerItem, isApplied && styles.offerItemActive]}
                onPress={() => onApplyOffer(offer)}
                disabled={applyingOffer}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.offerCode}>{offer.code}</Text>
                  <Text style={styles.offerDesc}>{offer.discount_percentage}% off - {offer.description || 'Discount applied to subtotal'}</Text>
                </View>
                {applyingOffer && appliedPromo?.code !== offer.code ? (
                  <ActivityIndicator size="small" color="#5A2D82" />
                ) : isApplied ? (
                  <Check size={18} color="#10B981" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
