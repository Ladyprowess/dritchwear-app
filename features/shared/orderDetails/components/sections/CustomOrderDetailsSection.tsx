import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Building, FileText, Palette, Target, MapPin, Calendar } from 'lucide-react-native';
import type { Order } from '../../types';
import { styles } from '../../styles';

interface CustomOrderDetailsSectionProps {
  order: Order;
  onDownloadImage: (imageUrl: string) => void;
}

export function CustomOrderDetailsSection({ order, onDownloadImage }: CustomOrderDetailsSectionProps) {
  const hasEnhancedDetails = !!(
    order.business_name || order.event_name || order.logo_url || order.brand_colors ||
    order.logo_placement || order.delivery_address || order.deadline || order.additional_notes
  );

  return (
    <View style={styles.customOrderCard}>
      <Text style={styles.customOrderTitle}>{order.title}</Text>
      <Text style={styles.customOrderDescription}>{order.description}</Text>
      <View style={styles.customOrderMeta}>
        <Text style={styles.customOrderMetaItem}>Quantity: {order.quantity}</Text>
        <Text style={styles.customOrderMetaItem}>Budget: {order.budget_range}</Text>
      </View>

      {hasEnhancedDetails && (
          <View style={styles.enhancedDetailsSection}>
            <Text style={styles.enhancedDetailsTitle}>Additional Details</Text>

            {order.business_name && (
              <View style={styles.detailRow}>
                <Building size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Business Name</Text>
                  <Text style={styles.detailValue}>{order.business_name}</Text>
                </View>
              </View>
            )}

            {order.logo_url && (
              <View style={styles.detailRow}>
                <FileText size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Logo</Text>
                  <Image
                    source={{ uri: order.logo_url }}
                    style={{ width: 80, height: 80, borderRadius: 8, marginTop: 6, backgroundColor: '#F3F4F6' }}
                    resizeMode="contain"
                  />
                  <Pressable onPress={() => onDownloadImage(order.logo_url!)} style={{ marginTop: 6 }}>
                    <Text style={{ color: '#5A2D82', fontSize: 13, fontWeight: '600' }}>
                      Download Logo
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {order.brand_colors && order.brand_colors.length > 0 && (
              <View style={styles.detailRow}>
                <Palette size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Brand Colors</Text>
                  <Text style={styles.detailValue}>
                    {Array.isArray(order.brand_colors) ? order.brand_colors.join(', ') : order.brand_colors}
                  </Text>
                </View>
              </View>
            )}

            {order.logo_placement && (
              <View style={styles.detailRow}>
                <Target size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Logo Placement</Text>
                  <Text style={styles.detailValue}>{order.logo_placement}</Text>
                </View>
              </View>
            )}

            {order.delivery_address && (
              <View style={styles.detailRow}>
                <MapPin size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Delivery Address</Text>
                  <Text style={styles.detailValue}>{order.delivery_address}</Text>
                </View>
              </View>
            )}

            {order.deadline && (
              <View style={styles.detailRow}>
                <Calendar size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Deadline</Text>
                  <Text style={styles.detailValue}>
                    {new Date(order.deadline).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {order.additional_notes && (
              <View style={styles.detailRow}>
                <FileText size={16} color="#6B7280" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Additional Notes</Text>
                  <Text style={styles.detailValue}>{order.additional_notes}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
  );
}
