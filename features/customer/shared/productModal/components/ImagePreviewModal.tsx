import React, { useRef } from 'react';
import { FlatList, Image, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { ProductImage } from '../types';
import { styles } from '../styles';

interface ImagePreviewModalProps {
  visible: boolean;
  productId?: string;
  productImages: ProductImage[];
  productName?: string;
  previewImageIndex: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ImagePreviewModal({ visible, productId, productImages, productName, previewImageIndex, onIndexChange, onClose }: ImagePreviewModalProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const previewListRef = useRef<FlatList<ProductImage>>(null);
  const previewContentHeight = Math.max(280, viewportHeight - 144);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.previewModalOverlay}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.previewTitle}>Product photos</Text>
            <Text style={styles.previewCounter}>
              {Math.min(previewImageIndex + 1, productImages.length)} of {productImages.length}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
            style={styles.previewCloseButton}
            onPress={onClose}
          >
            <X size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.previewImageContainer, { height: previewContentHeight }]}>
          <FlatList
            ref={previewListRef}
            key={`${productId || 'product'}-${viewportWidth}`}
            data={productImages}
            renderItem={({ item }) => (
              <View style={[styles.previewPage, { width: viewportWidth, height: previewContentHeight }]}>
                <Image
                  accessibilityLabel={item.alt_text || productName || 'Product image'}
                  source={{ uri: optimizeImageUrl(item.image_url, { width: 1200 }) as string }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={previewImageIndex}
            getItemLayout={(_, index) => ({
              length: viewportWidth,
              offset: viewportWidth * index,
              index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
              onIndexChange(Math.max(0, Math.min(index, productImages.length - 1)));
            }}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                previewListRef.current?.scrollToOffset({ offset: index * viewportWidth, animated: false });
              });
            }}
          />
        </View>
        <Text style={styles.previewHint}>
          {productImages.length > 1 ? 'Swipe left or right to view every photo' : 'Full product photo'}
        </Text>
      </SafeAreaView>
    </Modal>
  );
}
