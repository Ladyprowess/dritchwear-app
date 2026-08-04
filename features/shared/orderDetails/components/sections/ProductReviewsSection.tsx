import React, { useState } from 'react';
import { Text, View } from 'react-native';
import ProductReviews from '@/components/ProductReviews';
import type { Order } from '../../types';
import { styles } from '../../styles';

interface ProductReviewsSectionProps {
  order: Order;
  isAdmin: boolean;
  currentUserId?: string;
}

export function ProductReviewsSection({ order, isAdmin, currentUserId }: ProductReviewsSectionProps) {
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Product Reviews</Text>
      <Text style={styles.reviewsSubtitle}>
        {isAdmin ? 'Manage product reviews for this order' : 'Share your experience with these products to help other customers'}
      </Text>
      {order.items?.map((item, index) => (
        <View key={index} style={styles.reviewSection}>
          <View style={styles.reviewProductHeader}>
            <Text style={styles.reviewProductName}>{item.name}</Text>
            <Text style={styles.reviewProductDetails}>
              Size: {item.size} • Color: {item.color} • Qty: {item.quantity}
            </Text>
          </View>
          <ProductReviews
            key={`review-${item.product_id}-${reviewRefreshKey}`}
            productId={item.product_id}
            onReviewsUpdate={() => setReviewRefreshKey(prev => prev + 1)}
            showAddReview={!isAdmin}
            currentUserId={currentUserId}
            isAdminUser={isAdmin}
          />
        </View>
      ))}
    </View>
  );
}
