import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, ShoppingCart, ImagePlus, MapPin, Wallet, Truck, X } from 'lucide-react-native';
import { styles, BRAND_PURPLE } from '../styles';

// Steps shown in the "How to order" guide before an item is added to the cart.
const HOW_TO_STEPS: { icon: any; title: string; text: string }[] = [
  { icon: Check, title: 'Pick your size and colour', text: 'Choose your size, colour and quantity on this page.' },
  { icon: ImagePlus, title: 'Make it yours (optional)', text: 'Want it branded? Upload your logo on this page. If you cannot find exactly what you want, type your request in the box and we will make it for you.' },
  { icon: ShoppingCart, title: 'Add to cart', text: 'Tap Add to Cart. You can keep shopping or go straight to checkout.' },
  { icon: MapPin, title: 'Go to checkout', text: 'Open your cart and confirm your delivery details.' },
  { icon: Wallet, title: 'Pay your way', text: 'Pay with your Wallet or your Card. You can also use Pay for Me, where you share a link so someone else pays for you.' },
];

interface HowToOrderOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export function HowToOrderOverlay({ visible, onDismiss }: HowToOrderOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.htoOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
      <View style={styles.htoCard}>
        <View style={styles.htoHeader}>
          <View style={styles.htoHeaderIcon}><ShoppingCart size={20} color="#FFFFFF" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.htoTitle}>How to order</Text>
            <Text style={styles.htoSubtitle}>Simple steps from here to your door</Text>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} style={styles.htoClose}><X size={18} color="#6B7280" /></Pressable>
        </View>

        <ScrollView style={styles.htoScroll} showsVerticalScrollIndicator={false}>
          {HOW_TO_STEPS.map((step, i) => (
            <View key={step.title} style={styles.htoStep}>
              <View style={styles.htoStepLeft}>
                <View style={styles.htoBadge}><Text style={styles.htoBadgeText}>{i + 1}</Text></View>
                {i < HOW_TO_STEPS.length - 1 && <View style={styles.htoLine} />}
              </View>
              <View style={styles.htoStepBody}>
                <View style={styles.htoStepTitleRow}>
                  <step.icon size={15} color={BRAND_PURPLE} />
                  <Text style={styles.htoStepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.htoStepText}>{step.text}</Text>
              </View>
            </View>
          ))}

          <View style={styles.htoDelivery}>
            <Truck size={15} color={BRAND_PURPLE} />
            <Text style={styles.htoDeliveryText}>Delivery takes 2 to 7 days. If it arrives late, we add ₦1,000 to your wallet.</Text>
          </View>
        </ScrollView>

        <Pressable style={styles.htoPrimary} onPress={onDismiss}>
          <Check size={18} color="#FFFFFF" />
          <Text style={styles.htoPrimaryText}>Got it, start shopping</Text>
        </Pressable>
      </View>
    </View>
  );
}
