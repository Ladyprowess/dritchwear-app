import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Modal } from 'react-native';
import { Star, MessageSquare, User, Calendar, Edit3, Trash2, Plus, Shield } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Review {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified: boolean;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

interface ProductReviewsProps {
  productId: string;
  onReviewsUpdate?: () => void;
  showAddReview?: boolean;
  currentUserId?: string;
  isAdminUser?: boolean; // Add this prop
}

export default function ProductReviews({
  productId,
  onReviewsUpdate,
  showAddReview = true,
  currentUserId,
  isAdminUser = false // Add this prop with default
}: ProductReviewsProps) {
  const { user, profile } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [canReview, setCanReview] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    comment: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Use passed currentUserId or fallback to user from context
  const effectiveUserId = currentUserId || user?.id;
  const isAdmin = isAdminUser || profile?.is_admin === true; // Use passed prop or fall

  const fetchReviews = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles:user_id (
            full_name
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const visibleReviews = isAdmin ? data : data?.filter(r => r.is_verified);
      setReviews(visibleReviews || []);

      if (effectiveUserId && data) {
        const existingReview = data.find(r => r.user_id === effectiveUserId);
        setUserReview(existingReview || null);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  }, [productId, isAdmin, effectiveUserId]);

  useEffect(() => {
    if (productId) {
      fetchReviews();
      if (effectiveUserId) {
        checkCanReview();
      }
    }
  }, [productId, effectiveUserId, fetchReviews]);


  const checkCanReview = async () => {
    if (!effectiveUserId) return;

    try {
      // Check if user has completed an order with this product
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_status,
          items
        `)
        .eq('user_id', effectiveUserId)
        .eq('order_status', 'delivered');

      if (orderError) {
        console.error('Error checking orders:', orderError);
        // Try alternative approach - check if items is stored as JSON
        const { data: altData, error: altError } = await supabase
          .from('orders')
          .select('id, order_status, items')
          .eq('user_id', effectiveUserId)
          .eq('order_status', 'delivered');

        if (altError) throw altError;

        // Check if any order contains this product in the items JSON
        const hasProduct = altData?.some(order => {
          if (order.items && Array.isArray(order.items)) {
            return order.items.some((item: any) => item.product_id === productId);
          }
          return false;
        });

        setCanReview(hasProduct || false);
        return;
      }

      // Check if any delivered order contains this product
      const hasProduct = orderData?.some(order => {
        if (order.items && Array.isArray(order.items)) {
          return order.items.some((item: any) => item.product_id === productId);
        }
        return false;
      });

      setCanReview(hasProduct || false);
    } catch (error) {
      console.error('Error checking review eligibility:', error);
      // If there's an error, still allow review writing for delivered orders
      setCanReview(true);
    }
  };

  const handleSubmitReview = async () => {
    if (!effectiveUserId || !reviewForm.comment.trim()) {
      Alert.alert('Error', 'Please write a review comment');
      return;
    }

    setSubmitting(true);
    try {
      // Get the order ID for verification
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, items')
        .eq('user_id', effectiveUserId)
        .eq('order_status', 'delivered')
        .limit(1);

      if (orderError) throw orderError;

      // Find an order that contains this product
      let orderId = null;
      if (orderData && orderData.length > 0) {
        for (const order of orderData) {
          if (order.items && Array.isArray(order.items)) {
            const hasProduct = order.items.some((item: any) => item.product_id === productId);
            if (hasProduct) {
              orderId = order.id;
              break;
            }
          }
        }
      }

      const reviewData = {
        user_id: effectiveUserId,
        product_id: productId,
        order_id: orderId, // May be null if not found, but still allow review
        rating: reviewForm.rating,
        title: reviewForm.title.trim() || null,
        comment: reviewForm.comment.trim(),
        is_verified: orderId ? true : false // Verified only if we found matching order
      };

      if (userReview) {
        // Update existing review
        const { error } = await supabase
          .from('reviews')
          .update(reviewData)
          .eq('id', userReview.id);

        if (error) throw error;
        Alert.alert('Success', 'Review updated successfully');
      } else {
        // Create new review
        const { error } = await supabase
          .from('reviews')
          .insert(reviewData);

        if (error) throw error;
        Alert.alert('Success', 'Review submitted successfully');
      }

      setShowReviewModal(false);
      setReviewForm({ rating: 5, title: '', comment: '' });
      fetchReviews();
      onReviewsUpdate?.();
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminDeleteReview = async (reviewId: string) => {
    Alert.alert(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('reviews')
                .delete()
                .eq('id', reviewId);
  
              if (error) throw error;
  
              Alert.alert('Success', 'Review deleted successfully');
  
              // ✅ Add these lines:
              fetchReviews();
              onReviewsUpdate?.();
            } catch (error) {
              console.error('Error deleting review:', error);
              Alert.alert('Error', 'Failed to delete review');
            }
          }
        }
      ]
    );
  };
  

  const handleToggleVerification = async (reviewId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('reviews')
        .update({ is_verified: !currentStatus })
        .eq('id', reviewId);
  
      if (error) throw error;
  
      Alert.alert('Success', `Review ${!currentStatus ? 'verified' : 'unverified'} successfully`);
  
      // ✅ Add these lines:
      fetchReviews();
      onReviewsUpdate?.();
    } catch (error) {
      console.error('Error updating verification:', error);
      Alert.alert('Error', 'Failed to update review verification');
    }
  };
  

  const openReviewModal = () => {
    if (userReview) {
      setReviewForm({
        rating: userReview.rating,
        title: userReview.title || '',
        comment: userReview.comment || ''
      });
    }
    setShowReviewModal(true);
  };

  const renderStars = (rating: number, size: number = 16, interactive: boolean = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            onPress={interactive ? () => setReviewForm(prev => ({ ...prev, rating: star })) : undefined}
            disabled={!interactive}
          >
            <Star
              size={size}
              color="#F59E0B"
              fill={star <= rating ? "#F59E0B" : "transparent"}
            />
          </Pressable>
        ))}
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading reviews...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Reviews Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Customer Reviews</Text>
        {reviews.length > 0 ? (
          <View style={styles.summaryContent}>
            <View style={styles.ratingOverview}>
              {renderStars(Math.round(averageRating), 20)}
              <Text style={styles.averageRating}>
                {averageRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
              </Text>
            </View>
            {isAdmin && (
              <Text style={styles.adminNote}>
                💼 Admin view: Showing all reviews (verified and unverified)
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.noReviewsText}>No reviews yet</Text>
        )}
      </View>

      {/* User Review Actions - Only show if showAddReview is true and user exists */}
      {effectiveUserId && showAddReview && !isAdmin && (
        <View style={styles.userActionsContainer}>
          {canReview ? (
            <View style={styles.reviewActions}>
              {userReview ? (
                <View style={styles.existingReviewActions}>
                  <Text style={styles.existingReviewText}>You've reviewed this product</Text>
                  <View style={styles.reviewActionButtons}>
                    <Pressable style={styles.editButton} onPress={openReviewModal}>
                      <Edit3 size={16} color="#3B82F6" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable style={styles.writeReviewButton} onPress={openReviewModal}>
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.writeReviewText}>Write a Review</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Text style={styles.cannotReviewText}>
              You can only review products after completing an order
            </Text>
          )}
        </View>
      )}

      {/* Reviews List */}
      {reviews.length > 0 && (
        <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
          {reviews.map((review) => (
            <View key={review.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.reviewerInfo}>
                  <User size={16} color="#6B7280" />
                  <Text style={styles.reviewerName}>
                    {review.profiles?.full_name || 'Anonymous'}
                  </Text>
                  {review.is_verified ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedText}>Verified Purchase</Text>
                    </View>
                  ) : isAdmin ? (
                    <View style={styles.unverifiedBadge}>
                      <Text style={styles.unverifiedText}>Unverified</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.reviewMeta}>
                  {renderStars(review.rating, 14)}
                  <Text style={styles.reviewDate}>{formatDate(review.created_at)}</Text>
                </View>
              </View>
              
              {review.title && (
                <Text style={styles.reviewTitle}>{review.title}</Text>
              )}
              
              {review.comment && (
                <Text style={styles.reviewComment}>{review.comment}</Text>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <View style={styles.adminActions}>
                  <Pressable
                    style={styles.adminVerifyButton}
                    onPress={() => handleToggleVerification(review.id, review.is_verified)}
                  >
                    <Shield size={16} color={review.is_verified ? "#F59E0B" : "#10B981"} />
                    <Text style={[
                      styles.adminActionText,
                      { color: review.is_verified ? "#F59E0B" : "#10B981" }
                    ]}>
                      {review.is_verified ? 'Unverify' : 'Verify'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.adminDeleteButton}
                    onPress={() => handleAdminDeleteReview(review.id)}
                  >
                    <Trash2 size={16} color="#EF4444" />
                    <Text style={styles.adminDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Review Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {userReview ? 'Edit Review' : 'Write Review'}
            </Text>
            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setShowReviewModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Rating */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Rating</Text>
              {renderStars(reviewForm.rating, 24, true)}
            </View>

            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Title (Optional)</Text>
              <TextInput
                style={styles.titleInput}
                value={reviewForm.title}
                onChangeText={(text) => setReviewForm(prev => ({ ...prev, title: text }))}
                placeholder="Summarize your review"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Comment */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Review *</Text>
              <TextInput
                style={styles.commentInput}
                value={reviewForm.comment}
                onChangeText={(text) => setReviewForm(prev => ({ ...prev, comment: text }))}
                placeholder="Share your experience with this product"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmitReview}
              disabled={submitting || !reviewForm.comment.trim()}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : userReview ? 'Update Review' : 'Submit Review'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  summaryContainer: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  summaryContent: {
    alignItems: 'flex-start',
  },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  averageRating: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  adminNote: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#7C3AED',
    marginTop: 8,
    fontStyle: 'italic',
  },
  noReviewsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  userActionsContainer: {
    marginBottom: 16,
  },
  reviewActions: {
    alignItems: 'center',
  },
  existingReviewActions: {
    alignItems: 'center',
    gap: 8,
  },
  existingReviewText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#10B981',
  },
  reviewActionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    gap: 4,
  },
  editButtonText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#3B82F6',
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  writeReviewText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  cannotReviewText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  reviewsList: {
    flex: 1,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewHeader: {
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  reviewerName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  verifiedBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#10B981',
  },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unverifiedText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: '#F59E0B',
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#9CA3AF',
  },
  reviewTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 4,
  },
  reviewComment: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
    lineHeight: 20,
  },
  adminActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  adminVerifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    gap: 4,
  },
  adminDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    gap: 4,
  },
  adminActionText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
  },
  adminDeleteText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#EF4444',
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
  modalCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalCloseText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1F2937',
    minHeight: 100,
  },
  submitButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});