import React from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Zap } from 'lucide-react-native';
import { optimizeImageUrl } from '@/lib/imageUrl';
import { BRAND_GOLD, COMMUNITY_PHOTOS } from '../constants';
import { styles } from '../styles';

interface CatalogFooterProps {
  totalFilteredCount: number;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isNigerian: boolean;
  isSignedIn: boolean;
}

export function CatalogFooter({ totalFilteredCount, pageSize, currentPage, totalPages, onPageChange, isNigerian, isSignedIn }: CatalogFooterProps) {
  const router = useRouter();

  return (
    <View style={styles.catalogFooter}>
      <View style={styles.communitySection}>
        <Text style={styles.editorialTitle}>Styled by the community</Text>
        <Text style={styles.editorialSubtitle}>See how our community styles Dritchwear.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityRow}>
          {COMMUNITY_PHOTOS.map((url, index) => (
            <Image
              key={index}
              source={{ uri: optimizeImageUrl(url, { width: 400 }) as string }}
              style={styles.communityImage}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      </View>

      {totalFilteredCount > pageSize && (
        <View style={styles.paginationRow}>
          <Pressable disabled={currentPage === 1} style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]} onPress={() => onPageChange(Math.max(1, currentPage - 1))}>
            <Text style={styles.pageButtonText}>Previous</Text>
          </Pressable>
          <Text style={styles.pageIndicator}>Page {currentPage} of {totalPages}</Text>
          <Pressable disabled={currentPage === totalPages} style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]} onPress={() => onPageChange(Math.min(totalPages, currentPage + 1))}>
            <Text style={styles.pageButtonText}>Next</Text>
          </Pressable>
        </View>
      )}

      {isNigerian && (
        <Pressable
          style={styles.billPromo}
          onPress={() => router.push(isSignedIn ? '/(customer)/bill-payment' : '/(auth)/welcome')}
        >
          <View style={styles.billPromoIcon}><Zap size={20} color={BRAND_GOLD} /></View>
          <View style={styles.billPromoText}>
            <Text style={styles.billPromoTitle}>Your points have real value</Text>
            <Text style={styles.billPromoCopy}>Use them for airtime, data and electricity - instantly.</Text>
          </View>
          <ChevronRight size={20} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}
