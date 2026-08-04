import React from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { formatCurrency } from '@/lib/currency';
import { getStatusBadgeColor } from '@/lib/admin/orderStatus';
import { formatDate } from '@/lib/admin/formatting';
import type { DetailModalState } from '../types';
import { detailStyles } from '../styles';

interface DashboardDetailModalProps {
  detailModal: DetailModalState | null;
  detailData: any[];
  detailLoading: boolean;
  onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <View style={[detailStyles.badge, { backgroundColor: `${getStatusBadgeColor(status)}22` }]}>
      <Text style={[detailStyles.badgeText, { color: getStatusBadgeColor(status) }]}>
        {status?.charAt(0).toUpperCase() + status?.slice(1).replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

function renderDetailRow(item: any, type: string) {
  switch (type) {
    case 'users':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>{item.full_name || 'N/A'}</Text>
            <Text style={detailStyles.rowSecondary}>{item.email}</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={detailStyles.rowAmount}>
              {formatCurrency(item.wallet_balance ?? 0, 'NGN')}
            </Text>
            <Text style={detailStyles.rowMeta}>{item.points_balance ?? 0} pts</Text>
            <StatusBadge status={item.role} />
          </View>
        </View>
      );

    case 'orders':
    case 'revenue':
    case 'pending':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>
              {item.profiles?.full_name || item.profiles?.email || 'Unknown'}
            </Text>
            <Text style={detailStyles.rowSecondary}>#{item.id?.slice(0, 8)}</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={detailStyles.rowAmount}>{formatCurrency(item.total ?? 0, 'NGN')}</Text>
            <StatusBadge status={item.order_status} />
          </View>
        </View>
      );

    case 'points':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>{item.profiles?.email || 'Unknown'}</Text>
            <Text style={detailStyles.rowSecondary}>{item.description || 'No description'}</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={[detailStyles.rowAmount, { color: item.type === 'earned' ? '#10B981' : '#EF4444' }]}>
              {item.type === 'earned' ? '+' : '-'}{item.amount?.toLocaleString()} pts
            </Text>
            <StatusBadge status={item.type} />
          </View>
        </View>
      );

    case 'paylinks':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>{item.requester_name || 'Unknown'}</Text>
            <Text style={detailStyles.rowSecondary}>Token: {item.token?.slice(0, 12)}…</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={detailStyles.rowAmount}>{formatCurrency(item.amount_ngn ?? 0, 'NGN')}</Text>
            <StatusBadge status={item.status} />
          </View>
        </View>
      );

    case 'bills':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>{item.profiles?.email || 'Unknown'}</Text>
            <Text style={detailStyles.rowSecondary}>
              {item.service_provider || item.service_type || 'N/A'}
            </Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={detailStyles.rowAmount}>{formatCurrency(item.amount ?? 0, 'NGN')}</Text>
            <StatusBadge status={item.status} />
          </View>
        </View>
      );

    case 'referrals':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>
              {item.referrer?.email || 'Unknown referrer'}
            </Text>
            <Text style={detailStyles.rowSecondary}>
              → {item.referred?.email || 'Unknown referred'}
            </Text>
            <Text style={detailStyles.rowMeta}>Code: {item.referral_code_used || 'N/A'}</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <StatusBadge status={item.signup_rewarded_at ? 'rewarded' : 'pending'} />
            {item.first_paid_order_at && (
              <Text style={[detailStyles.rowMeta, { color: '#10B981' }]}>Order paid</Text>
            )}
          </View>
        </View>
      );

    case 'giftcards':
      return (
        <View style={detailStyles.row}>
          <View style={detailStyles.rowLeft}>
            <Text style={detailStyles.rowPrimary}>{item.recipient_name || 'N/A'}</Text>
            <Text style={detailStyles.rowSecondary}>From: {item.sender_name || 'N/A'}</Text>
            <Text style={detailStyles.rowMeta}>Code: {item.code}</Text>
            <Text style={detailStyles.rowMeta}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={detailStyles.rowRight}>
            <Text style={detailStyles.rowAmount}>
              {formatCurrency(item.original_amount ?? 0, item.currency || 'NGN')}
            </Text>
            <StatusBadge status={item.status} />
          </View>
        </View>
      );

    default:
      return (
        <View style={detailStyles.row}>
          <Text style={detailStyles.rowSecondary}>{JSON.stringify(item)}</Text>
        </View>
      );
  }
}

export function DashboardDetailModal({ detailModal, detailData, detailLoading, onClose }: DashboardDetailModalProps) {
  return (
    <Modal
      visible={!!detailModal}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={detailStyles.overlay}>
        <Pressable style={detailStyles.overlayTouchable} onPress={onClose} />
        <View style={detailStyles.sheet}>
          <View style={detailStyles.dragHandle} />

          <View style={detailStyles.sheetHeader}>
            <Text style={detailStyles.sheetTitle}>{detailModal?.title ?? ''}</Text>
            <Pressable onPress={onClose} style={detailStyles.closeBtn}>
              <X size={20} color="#374151" />
            </Pressable>
          </View>

          {detailLoading ? (
            <View style={detailStyles.loadingContainer}>
              <ActivityIndicator size="large" color="#5A2D82" />
              <Text style={detailStyles.loadingText}>Loading…</Text>
            </View>
          ) : detailData.length === 0 ? (
            <View style={detailStyles.emptyContainer}>
              <Text style={detailStyles.emptyText}>No records found</Text>
            </View>
          ) : (
            <FlatList
              data={detailData}
              keyExtractor={(item) => item.id?.toString() ?? Math.random().toString()}
              renderItem={({ item }) =>
                renderDetailRow(item, detailModal?.type ?? '')
              }
              contentContainerStyle={detailStyles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={detailStyles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
