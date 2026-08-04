import React, { useRef } from 'react';
import { FlatList, Image, Pressable, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import type { ProductImage } from '../types';
import { styles } from '../styles';

interface ImageGalleryProps {
  productImages: ProductImage[];
  imagesLoading: boolean;
  currentImageIndex: number;
  onIndexChange: (index: number) => void;
  onOpenPreview: (index: number) => void;
  fallbackImageUrl: string;
}

export function ImageGallery({ productImages, imagesLoading, currentImageIndex, onIndexChange, onOpenPreview, fallbackImageUrl }: ImageGalleryProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const galleryRef = useRef<FlatList<ProductImage>>(null);
  // Product photos are portrait; a tall box + "contain" shows the whole garment
  // instead of cropping the top/bottom off in a short landscape frame.
  const galleryHeight = Math.round(Math.min(viewportWidth * 1.15, viewportHeight * 0.55));

  const nextImage = () => {
    const next = currentImageIndex === productImages.length - 1 ? 0 : currentImageIndex + 1;
    onIndexChange(next);
    galleryRef.current?.scrollToIndex({ index: next, animated: true });
  };

  const prevImage = () => {
    const next = currentImageIndex === 0 ? productImages.length - 1 : currentImageIndex - 1;
    onIndexChange(next);
    galleryRef.current?.scrollToIndex({ index: next, animated: true });
  };

  return (
    <View style={styles.imageGalleryContainer}>
      {imagesLoading ? (
        <View style={[styles.imageSkeleton, { height: galleryHeight }]} accessibilityLabel="Loading product images" />
      ) : productImages.length > 1 ? (
        <>
          <FlatList
            ref={galleryRef}
            data={productImages}
            renderItem={({ item, index }) => (
              <Pressable onPress={() => onOpenPreview(index)}>
                <Image
                  source={{ uri: optimizeImageUrl(item.image_url, { width: 1000 }) as string }}
                  style={[styles.galleryImage, { width: viewportWidth, height: galleryHeight }]}
                  resizeMode="contain"
                />
              </Pressable>
            )}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / viewportWidth);
              onIndexChange(index);
            }}
            style={[styles.imageGallery, { height: galleryHeight }]}
          />

          <Pressable style={[styles.imageNavButton, styles.prevButton]} onPress={prevImage}>
            <ChevronLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable style={[styles.imageNavButton, styles.nextButton]} onPress={nextImage}>
            <ChevronRight size={24} color="#FFFFFF" />
          </Pressable>

          <View style={styles.imageIndicators}>
            {productImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.imageIndicator,
                  index === currentImageIndex && styles.imageIndicatorActive
                ]}
              />
            ))}
          </View>
        </>
      ) : (
        <Pressable onPress={() => onOpenPreview(0)}>
          <Image
            source={{ uri: optimizeImageUrl(productImages[0]?.image_url || fallbackImageUrl, { width: 1000 }) as string }}
            style={[styles.productImage, { height: galleryHeight }]}
            resizeMode="contain"
          />
        </Pressable>
      )}
    </View>
  );
}
