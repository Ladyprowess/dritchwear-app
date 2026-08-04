import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { usePoints } from '@/contexts/PointsContext';
import { ArrowLeft } from 'lucide-react-native';
import { CommerceConfig, DEFAULT_COMMERCE_CONFIG } from '@/lib/fees';
import { fetchCommerceConfig } from '@/lib/commerceSettings';
import { smartBack } from '@/lib/navigation';
import ChatHelpBanner from '@/components/ChatHelpBanner';

import { useCheckoutNotice } from '@/features/customer/checkout/hooks/useCheckoutNotice';
import { useCheckoutCartData } from '@/features/customer/checkout/hooks/useCheckoutCartData';
import { useMemberTier } from '@/features/customer/checkout/hooks/useMemberTier';
import { useDeliveryAddress } from '@/features/customer/checkout/hooks/useDeliveryAddress';
import { useCheckoutTotals } from '@/features/customer/checkout/hooks/useCheckoutTotals';
import { useCheckoutOffers } from '@/features/customer/checkout/hooks/useCheckoutOffers';
import { usePaymentOrchestration } from '@/features/customer/checkout/hooks/usePaymentOrchestration';

import { OrderSummarySection } from '@/features/customer/checkout/components/OrderSummarySection';
import { DeliveryAddressSection } from '@/features/customer/checkout/components/DeliveryAddressSection';
import { ContactPhoneSection } from '@/features/customer/checkout/components/ContactPhoneSection';
import { OrderTotalsSection } from '@/features/customer/checkout/components/OrderTotalsSection';
import { OrderNoteSection } from '@/features/customer/checkout/components/OrderNoteSection';
import { PointsBanner } from '@/features/customer/checkout/components/PointsBanner';
import { OffersSection } from '@/features/customer/checkout/components/OffersSection';
import { PaymentMethodsSection } from '@/features/customer/checkout/components/PaymentMethodsSection';
import { AddressPromptModal } from '@/features/customer/checkout/components/AddressPromptModal';
import { CheckoutPaystackModal } from '@/features/customer/checkout/components/CheckoutPaystackModal';
import { PayLinkModal } from '@/features/customer/checkout/components/PayLinkModal';
import { WebNoticeModal } from '@/features/customer/checkout/components/WebNoticeModal';
import { styles } from '@/features/customer/checkout/styles';

export default function CheckoutScreen() {
  const router = useRouter();
  const { cartData } = useLocalSearchParams();
  const { user, profile, refreshProfile } = useAuth();
  const { clearCart, appliedPromo, setAppliedPromo } = useCart();
  const { refreshPoints } = usePoints();

  const [config, setConfig] = useState<CommerceConfig>(DEFAULT_COMMERCE_CONFIG);
  const [orderNote, setOrderNote] = useState('');

  const { webNotice, setWebNotice, showCheckoutNotice, closeWebNotice } = useCheckoutNotice();
  const { items } = useCheckoutCartData(cartData, showCheckoutNotice);
  const { memberTier, memberFreeDelivery } = useMemberTier(user?.id);

  // Load admin-configured commerce settings (delivery fees, service/tax rates,
  // minimum order and store open/closed) so checkout reflects the latest values.
  useEffect(() => {
    let active = true;
    fetchCommerceConfig().then((c) => { if (active) setConfig(c); });
    return () => { active = false; };
  }, []);

  const {
    deliveryAddress,
    setDeliveryAddress,
    deliveryState,
    setDeliveryState,
    deliveryCountry,
    setDeliveryCountry,
    contactPhone,
    setContactPhone,
    showAddressPrompt,
    setShowAddressPrompt,
    defaultAddress,
    handleUseDefaultAddress,
    handleChangeAddress,
  } = useDeliveryAddress({ profile, showCheckoutNotice });

  const userCurrency = profile?.preferred_currency || 'NGN';

  const {
    getTotalItems,
    getSubtotalInNGN,
    hasDeliveryAddress,
    getFullDeliveryAddress,
    effectivePromoType,
    displayTotals,
  } = useCheckoutTotals({
    items,
    appliedPromo,
    config,
    userCurrency,
    deliveryAddress,
    deliveryState,
    deliveryCountry,
    memberFreeDelivery,
  });

  const {
    availableOffers,
    showOffers,
    setShowOffers,
    applyingOffer,
    handleApplyOffer,
  } = useCheckoutOffers({
    user,
    profile,
    appliedPromo,
    setAppliedPromo,
    userCurrency,
    getSubtotalInNGN,
    getTotalItems,
    showCheckoutNotice,
  });

  const {
    loading,
    showPaystack,
    orderData,
    showPayLinkModal,
    setShowPayLinkModal,
    payLinkLoading,
    generatedPayLink,
    handleOrder,
    handlePayForMe,
    handlePaystackSuccess,
    handlePaystackCancel,
  } = usePaymentOrchestration({
    user,
    profile,
    items,
    appliedPromo,
    userCurrency,
    config,
    deliveryAddress,
    deliveryState,
    deliveryCountry,
    contactPhone,
    orderNote,
    getSubtotalInNGN,
    getFullDeliveryAddress,
    getTotalItems,
    effectivePromoType,
    refreshProfile,
    refreshPoints,
    clearCart,
    showCheckoutNotice,
    setWebNotice,
  });

  return (
    <>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => smartBack(router, '/(customer)/cart')}>
            <ArrowLeft size={24} color="#1F2937" />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <OrderSummarySection
            items={items}
            totalItems={getTotalItems()}
            userCurrency={userCurrency}
            appliedPromo={appliedPromo}
          />

          <DeliveryAddressSection
            defaultAddress={defaultAddress}
            deliveryAddress={deliveryAddress}
            onDeliveryAddressChange={setDeliveryAddress}
            deliveryState={deliveryState}
            onDeliveryStateChange={setDeliveryState}
            deliveryCountry={deliveryCountry}
            onDeliveryCountryChange={setDeliveryCountry}
          />

          <ContactPhoneSection
            contactPhone={contactPhone}
            onContactPhoneChange={setContactPhone}
          />

          <OrderTotalsSection
            displayTotals={displayTotals}
            userCurrency={userCurrency}
            appliedPromo={appliedPromo}
            memberFreeDelivery={memberFreeDelivery}
            memberTierName={memberTier?.name}
            hasDeliveryAddress={hasDeliveryAddress()}
          />

          <OrderNoteSection orderNote={orderNote} onOrderNoteChange={setOrderNote} />

          <PointsBanner />

          <OffersSection
            availableOffers={availableOffers}
            showOffers={showOffers}
            onToggleOffers={() => setShowOffers(v => !v)}
            appliedPromo={appliedPromo}
            applyingOffer={applyingOffer}
            onApplyOffer={handleApplyOffer}
          />

          <PaymentMethodsSection
            walletBalance={profile?.wallet_balance || 0}
            userCurrency={userCurrency}
            loading={loading}
            payLinkLoading={payLinkLoading}
            onPayWithWallet={() => handleOrder('wallet')}
            onPayWithCard={() => handleOrder('card')}
            onPayForMe={handlePayForMe}
          />

          <ChatHelpBanner
            title="Having trouble placing your order?"
            subtitle="Message us and we'll help you check out"
            style={{ marginHorizontal: 16, marginTop: 4, marginBottom: 24 }}
          />
        </ScrollView>
      </SafeAreaView>

      <AddressPromptModal
        visible={showAddressPrompt}
        defaultAddress={defaultAddress}
        onClose={() => setShowAddressPrompt(false)}
        onChangeAddress={handleChangeAddress}
        onUseDefaultAddress={handleUseDefaultAddress}
      />

      <CheckoutPaystackModal
        visible={showPaystack}
        orderData={orderData}
        userEmail={user?.email}
        customerName={user?.user_metadata?.full_name}
        onSuccess={handlePaystackSuccess}
        onCancel={handlePaystackCancel}
      />

      <PayLinkModal
        visible={showPayLinkModal}
        generatedPayLink={generatedPayLink}
        onClose={() => setShowPayLinkModal(false)}
        clearCart={clearCart}
      />

      <WebNoticeModal webNotice={webNotice} onClose={closeWebNotice} />
    </>
  );
}
