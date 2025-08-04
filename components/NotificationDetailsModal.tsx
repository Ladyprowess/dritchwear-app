import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Package, Gift, CircleAlert as AlertCircle, Bell, Calendar, User } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'promo' | 'system' | 'custom';
  is_read: boolean;
  created_at: string;
}

interface NotificationDetailsModalProps {
  notification: Notification | null;
  visible: boolean;
  onClose: () => void;
  onMarkAsRead?: (notificationId: string) => void;
}

const typeConfig = {
  order: { 
    icon: Package, 
    color: '#3B82F6', 
    label: 'Order Update',
    description: 'Information about your order status'
  },
  promo: { 
    icon: Gift, 
    color: '#F59E0B', 
    label: 'Promotion',
    description: 'Special offers and discounts'
  },
  system: { 
    icon: AlertCircle, 
    color: '#EF4444', 
    label: 'System Alert',
    description: 'Important system notifications'
  },
  custom: { 
    icon: Bell, 
    color: '#7C3AED', 
    label: 'Message',
    description: 'Custom message from Dritchwear'
  },
};

export default function NotificationDetailsModal({ 
  notification, 
  visible, 
  onClose, 
  onMarkAsRead 
}: NotificationDetailsModalProps) {
  const router = useRouter();

  if (!notification) return null;

  const config = typeConfig[notification.type];
  const IconComponent = config.icon;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClose = () => {
    // Mark as read when closing if it's unread
    if (!notification.is_read && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onClose();
  };

  // Extract order ID from notification message
  const extractOrderId = (message: string): string | null => {
    // Look for patterns like "#209d6991", "#62fb8c90", etc.
    const orderIdMatch = message.match(/#([a-f0-9]{8})/i);
    if (orderIdMatch) {
      return orderIdMatch[1];
    }
    
    // Look for patterns like "order #ORDER_ID"
    const orderMatch = message.match(/order\s+#?([a-f0-9-]{8,})/i);
    if (orderMatch) {
      return orderMatch[1];
    }
    
    return null;
  };

  const handleViewOrders = () => {
    const orderId = extractOrderId(notification.message);
    
    if (orderId) {
      // Close the modal first
      handleClose();
      
      // Navigate to orders screen
      // The orders screen will automatically show the specific order if we can pass the ID
      router.push('/(customer)/orders');
      
      // Note: We could enhance this further by adding a search/filter feature
      // in the orders screen to highlight the specific order
    } else {
      // If no specific order ID found, just go to orders screen
      handleClose();
      router.push('/(customer)/orders');
    }
  };

  const handleShopNow = () => {
    handleClose();
    router.push('/(customer)/shop');
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.typeIcon, { backgroundColor: `${config.color}20` }]}>
              <IconComponent size={24} color={config.color} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{config.label}</Text>
              <Text style={styles.headerSubtitle}>{config.description}</Text>
            </View>
          </View>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#1F2937" />
          </Pressable>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Notification Content */}
          <View style={styles.contentSection}>
            <View style={styles.titleSection}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              {!notification.is_read && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>New</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.notificationMessage}>{notification.message}</Text>
          </View>

          {/* Metadata */}
          <View style={styles.metadataSection}>
            <Text style={styles.metadataTitle}>Notification Details</Text>
            
            <View style={styles.metadataCard}>
              <View style={styles.metadataRow}>
                <Calendar size={16} color="#6B7280" />
                <View style={styles.metadataContent}>
                  <Text style={styles.metadataLabel}>Received</Text>
                  <Text style={styles.metadataValue}>{formatDate(notification.created_at)}</Text>
                </View>
              </View>

              <View style={styles.metadataRow}>
                <IconComponent size={16} color="#6B7280" />
                <View style={styles.metadataContent}>
                  <Text style={styles.metadataLabel}>Type</Text>
                  <Text style={styles.metadataValue}>{config.label}</Text>
                </View>
              </View>

              <View style={styles.metadataRow}>
                <User size={16} color="#6B7280" />
                <View style={styles.metadataContent}>
                  <Text style={styles.metadataLabel}>From</Text>
                  <Text style={styles.metadataValue}>Dritchwear Team</Text>
                </View>
              </View>

              <View style={styles.metadataRow}>
                <View style={[
                  styles.statusIndicator,
                  { backgroundColor: notification.is_read ? '#10B981' : '#F59E0B' }
                ]} />
                <View style={styles.metadataContent}>
                  <Text style={styles.metadataLabel}>Status</Text>
                  <Text style={[
                    styles.metadataValue,
                    { color: notification.is_read ? '#10B981' : '#F59E0B' }
                  ]}>
                    {notification.is_read ? 'Read' : 'Unread'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Suggestions */}
          {notification.type === 'order' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>Quick Actions</Text>
              <View style={styles.actionButtons}>
                <Pressable style={styles.actionButton} onPress={handleViewOrders}>
                  <Package size={16} color="#7C3AED" />
                  <Text style={styles.actionButtonText}>View Orders</Text>
                </Pressable>
              </View>
            </View>
          )}

          {notification.type === 'promo' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionTitle}>Quick Actions</Text>
              <View style={styles.actionButtons}>
                <Pressable style={styles.actionButton} onPress={handleShopNow}>
                  <Gift size={16} color="#7C3AED" />
                  <Text style={styles.actionButtonText}>Shop Now</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          {!notification.is_read && (
            <Pressable
              style={styles.markReadButton}
              onPress={() => {
                if (onMarkAsRead) {
                  onMarkAsRead(notification.id);
                }
              }}
            >
              <Text style={styles.markReadButtonText}>Mark as Read</Text>
            </Pressable>
          )}
          
          <Pressable style={styles.closeModalButton} onPress={handleClose}>
            <Text style={styles.closeModalButtonText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#6B7280',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#1F2937',
    lineHeight: 32,
    marginRight: 12,
  },
  unreadBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  notificationMessage: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#374151',
    lineHeight: 24,
  },
  metadataSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  metadataTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  metadataCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metadataContent: {
    marginLeft: 12,
    flex: 1,
  },
  metadataLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#6B7280',
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
  },
  statusIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1F2937',
    marginBottom: 12,
  },
  actionButtons: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#7C3AED',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  markReadButton: {
    flex: 1,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  markReadButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  closeModalButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#6B7280',
  },
});