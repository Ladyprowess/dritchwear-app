import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, RefreshCw } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';

import type { OrderDetailsModalProps } from '../types';
import { isCustomOrder, getActualPaymentCurrency } from '../helpers';
import { useOrderDetailsActions } from '../hooks/useOrderDetailsActions';
import { styles } from '../styles';

import { OrderInfoSection } from './sections/OrderInfoSection';
import { StatusSection } from './sections/StatusSection';
import { StatusManagementSection } from './sections/StatusManagementSection';
import { CustomOrderDetailsSection } from './sections/CustomOrderDetailsSection';
import { InvoicesSection } from './sections/InvoicesSection';
import { OrderItemsSection } from './sections/OrderItemsSection';
import { OrderSummarySection } from './sections/OrderSummarySection';
import { PaymentInfoSection } from './sections/PaymentInfoSection';
import { ProductReviewsSection } from './sections/ProductReviewsSection';
import { DeliverySection } from './sections/DeliverySection';
import { SendInvoiceModal } from './SendInvoiceModal';
import { TrackingInfoModal } from './TrackingInfoModal';

export default function OrderDetailsModal({
  order,
  visible,
  onClose,
  onOrderUpdate,
  mode = 'manage', // default
}: OrderDetailsModalProps) {
  const { isAdmin, user } = useAuth();
  const { addToCart } = useCart();
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  const actions = useOrderDetailsActions(order, onOrderUpdate, onClose, addToCart);

  if (!order) return null;

  const custom = isCustomOrder(order);
  const currentStatus = (custom ? order.status : order.order_status) || '';
  const actualPaymentCurrency = getActualPaymentCurrency(order);

  const canWriteReviews = !isAdmin && !custom && order.order_status === 'delivered';

  const successfulStatuses = ['confirmed', 'processing', 'shipped', 'delivered', 'completed'];
  const canRepeatOrder = !isAdmin && !custom && !!(order.items && order.items.length > 0) &&
    (order.payment_status === 'paid' || successfulStatuses.includes((order.order_status || '').toLowerCase()));

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {custom ? 'Custom Order Details' : 'Order Details'}
            </Text>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#1F2937" />
            </Pressable>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {canRepeatOrder && (
              <Pressable style={styles.repeatOrderButton} onPress={actions.handleRepeatOrder}>
                <RefreshCw size={16} color="#FFFFFF" />
                <Text style={styles.repeatOrderText}>Buy these again</Text>
              </Pressable>
            )}

            <OrderInfoSection
              order={order}
              isAdmin={isAdmin}
              sendingReminder={actions.sendingReminder}
              onSendPaymentReminder={actions.handleSendPaymentReminder}
            />

            <StatusSection currentStatus={currentStatus} />

            {mode === 'manage' && isAdmin && !['completed', 'cancelled', 'rejected'].includes(currentStatus) && (
              <StatusManagementSection
                isCustomOrder={custom}
                currentStatus={currentStatus}
                updating={actions.updating}
                onStatusUpdate={actions.handleStatusUpdate}
                onRequestShip={() => setShowTrackingModal(true)}
              />
            )}

            {custom ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Custom Order Details</Text>
                <CustomOrderDetailsSection order={order} onDownloadImage={actions.downloadImage} />
                <InvoicesSection
                  order={order}
                  mode={mode}
                  isAdmin={isAdmin}
                  currentStatus={currentStatus}
                  onSendInvoicePress={() => setShowInvoiceModal(true)}
                />
              </View>
            ) : (
              <>
                <OrderItemsSection order={order} onDownloadImage={actions.downloadImage} />
                <DeliverySection
                  order={order}
                  isAdmin={isAdmin}
                  givingCredit={actions.givingCredit}
                  onGiveLateDeliveryCredit={actions.handleGiveLateDeliveryCredit}
                />
                <OrderSummarySection order={order} />
                <PaymentInfoSection order={order} />
                {order.order_status === 'delivered' && (
                  <ProductReviewsSection order={order} isAdmin={isAdmin} currentUserId={user?.id} />
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {mode === 'manage' && isAdmin && custom && (
        <SendInvoiceModal
          visible={showInvoiceModal}
          actualPaymentCurrency={actualPaymentCurrency}
          onClose={() => setShowInvoiceModal(false)}
          onSend={actions.sendInvoice}
        />
      )}

      {mode === 'manage' && isAdmin && !custom && (
        <TrackingInfoModal
          visible={showTrackingModal}
          onClose={() => setShowTrackingModal(false)}
          onSubmit={actions.handleShipWithTracking}
        />
      )}
    </>
  );
}
