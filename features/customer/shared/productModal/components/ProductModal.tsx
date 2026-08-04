import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { getItemPriceInUserCurrency } from '@/lib/currency';
import { pickAndUploadImage } from '@/lib/uploadImage';
import ProductReviews from '@/components/ProductReviews';
import ChatHelpBanner from '@/components/ChatHelpBanner';

import type { ProductModalProps } from '../types';
import { useProductModalData } from '../hooks/useProductModalData';
import { useAddToCart } from '../hooks/useAddToCart';
import { styles } from '../styles';

import { ImageGallery } from './ImageGallery';
import { ProductInfoSection } from './ProductInfoSection';
import { SizeSelector } from './SizeSelector';
import { ColorSelector } from './ColorSelector';
import { QuantitySelector } from './QuantitySelector';
import { BrandingOrNoteSection } from './BrandingOrNoteSection';
import { SelectionSummary } from './SelectionSummary';
import { AddToCartFooter } from './AddToCartFooter';
import { HowToOrderOverlay } from './HowToOrderOverlay';
import { ImagePreviewModal } from './ImagePreviewModal';
import { CartConfirmationModal } from './CartConfirmationModal';
import { SizeGuideModal } from './SizeGuideModal';
import { ReturnsPolicyModal } from './ReturnsPolicyModal';

export default function ProductModal({ product, visible, onClose, onOrderSuccess }: ProductModalProps) {
  const { profile, user } = useAuth();
  const { addToCart } = useCart();
  const router = useRouter();
  const posthog = usePostHog();

  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [imagePreviewVisible, setImagePreviewVisible] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false); // "How to order" guide before adding to cart

  const data = useProductModalData(visible, product, user?.id);

  const resetSelections = () => {
    setSelectedSizes([]);
    setSelectedColors([]);
    setNote('');
    setQuantity(1);
    setLogoUrl(null);
  };

  const resetModal = () => {
    resetSelections();
    data.reset();
  };

  const uploadLogo = async () => {
    setUploadingLogo(true);
    const url = await pickAndUploadImage('order-logos');
    setUploadingLogo(false);
    if (url) setLogoUrl(url);
  };

  const handleClose = () => {
    cart.closeCartConfirmation();
    resetModal();
    onClose();
  };

  const handleContinueShopping = () => {
    handleClose();
  };

  const handleViewCart = () => {
    handleClose();
    router.push('/(customer)/cart');
  };

  const cart = useAddToCart({
    product,
    productImages: data.productImages,
    lockedTier: data.lockedTier,
    addToCart,
    posthog,
    onContinueShopping: handleContinueShopping,
    onViewCart: handleViewCart,
    onAddedToCart: resetModal,
  });

  // Low-stock urgency animation. pulse cycles 0->1 while a low-stock product is shown.
  const lowStock = !!product && product.stock > 0 && product.stock <= 5;
  const pulse = useSharedValue(0);
  const urgencyPillStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.045 }] }));
  const ctaPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.02 }] }));

  useEffect(() => {
    if (visible && lowStock) {
      pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [visible, lowStock]);

  useEffect(() => {
    if (visible && product) {
      setShowHowTo(true); // show the "How to order" guide as soon as the product opens
    } else {
      setShowHowTo(false);
    }
  }, [visible, product]);

  const toggleSize = (size: string) => {
    setSelectedSizes(prev =>
      prev.includes(size)
        ? prev.filter(s => s !== size)
        : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors(prev =>
      prev.includes(color)
        ? prev.filter(c => c !== color)
        : [...prev, color]
    );
  };

  const openImagePreview = (index: number) => {
    setPreviewImageIndex(index);
    setImagePreviewVisible(true);
  };

  // Get user's preferred currency, and the product price converted to it.
  const userCurrency = profile?.preferred_currency || 'NGN';
  const productPriceInUserCurrency = product ? getItemPriceInUserCurrency(product.price, userCurrency) : 0;

  const sizesAvailable = !!(product?.sizes && product.sizes.length > 0);
  const colorsAvailable = !!(product?.colors && product.colors.length > 0);

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.container}>
          {!product ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text>Product not found</Text>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Product Details</Text>
                <Pressable style={styles.closeButton} onPress={handleClose}>
                  <X size={24} color="#1F2937" />
                </Pressable>
              </View>

              <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                <ImageGallery
                  productImages={data.productImages}
                  imagesLoading={data.imagesLoading}
                  currentImageIndex={data.currentImageIndex}
                  onIndexChange={data.setCurrentImageIndex}
                  onOpenPreview={openImagePreview}
                  fallbackImageUrl={product.image_url}
                />

                <ProductInfoSection
                  product={product}
                  userCurrency={userCurrency}
                  productPriceInUserCurrency={productPriceInUserCurrency}
                  reviewStats={data.reviewStats}
                  reviewsLoading={data.reviewsLoading}
                  lowStock={lowStock}
                  urgencyPillStyle={urgencyPillStyle}
                  onOpenReturns={() => setShowReturns(true)}
                />

                {sizesAvailable && (
                  <SizeSelector
                    product={product}
                    selectedSizes={selectedSizes}
                    onToggleSize={toggleSize}
                    onOpenSizeGuide={() => setShowSizeGuide(true)}
                  />
                )}

                {colorsAvailable && (
                  <ColorSelector
                    product={product}
                    selectedColors={selectedColors}
                    onToggleColor={toggleColor}
                  />
                )}

                <QuantitySelector quantity={quantity} onChange={setQuantity} maxQuantity={product.stock} />

                <BrandingOrNoteSection
                  product={product}
                  note={note}
                  onNoteChange={setNote}
                  logoUrl={logoUrl}
                  uploadingLogo={uploadingLogo}
                  onUploadLogo={uploadLogo}
                  onRemoveLogo={() => setLogoUrl(null)}
                />

                <SelectionSummary
                  sizesAvailable={sizesAvailable}
                  colorsAvailable={colorsAvailable}
                  selectedSizesCount={selectedSizes.length}
                  selectedColorsCount={selectedColors.length}
                  productPriceInUserCurrency={productPriceInUserCurrency}
                  quantity={quantity}
                  userCurrency={userCurrency}
                />

                {/* Contextual help while choosing size/options */}
                <ChatHelpBanner
                  title="Questions about size or fit?"
                  subtitle="Chat with us before you add to cart"
                  onBeforeNavigate={handleClose}
                  style={{ marginHorizontal: 20, marginTop: 4, marginBottom: 8 }}
                />

                {/* Product Reviews */}
                <View style={styles.reviewsSection}>
                  <ProductReviews
                    productId={product.id}
                    onReviewsUpdate={() => {
                      data.fetchReviewStats();
                    }}
                  />
                </View>
              </ScrollView>

              <AddToCartFooter
                lockedTier={data.lockedTier}
                cartError={cart.cartError}
                loading={cart.loading}
                sizesAvailable={sizesAvailable}
                colorsAvailable={colorsAvailable}
                selectedSizesCount={selectedSizes.length}
                selectedColorsCount={selectedColors.length}
                ctaPulseStyle={ctaPulseStyle}
                onPress={() => cart.handleAddToCart(selectedSizes, selectedColors, quantity, note, logoUrl)}
                outOfStock={(product.stock ?? 0) <= 0}
              />
            </>
          )}

          <HowToOrderOverlay visible={showHowTo} onDismiss={() => setShowHowTo(false)} />
        </SafeAreaView>
      </Modal>

      <ImagePreviewModal
        visible={imagePreviewVisible}
        productId={product?.id}
        productImages={data.productImages}
        productName={product?.name}
        previewImageIndex={previewImageIndex}
        onIndexChange={setPreviewImageIndex}
        onClose={() => setImagePreviewVisible(false)}
      />

      <CartConfirmationModal
        visible={cart.showCartConfirmation}
        addedItemsCount={cart.addedItemsCount}
        onContinueShopping={handleContinueShopping}
        onViewCart={handleViewCart}
      />

      <SizeGuideModal visible={showSizeGuide} onClose={() => setShowSizeGuide(false)} />
      <ReturnsPolicyModal visible={showReturns} onClose={() => setShowReturns(false)} />
    </>
  );
}
