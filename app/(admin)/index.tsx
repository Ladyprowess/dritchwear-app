import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Eye } from 'lucide-react-native';
import OrderDetailsModal from '@/features/shared/orderDetails/components/OrderDetailsModal';

import { useDashboardStats } from '@/features/admin/dashboard/hooks/useDashboardStats';
import { useDashboardDetails } from '@/features/admin/dashboard/hooks/useDashboardDetails';
import { StatsHeader } from '@/features/admin/dashboard/components/StatsHeader';
import { SalesOverviewCard } from '@/features/admin/dashboard/components/SalesOverviewCard';
import { OrderStatusDonut } from '@/features/admin/dashboard/components/OrderStatusDonut';
import { TopProductsList } from '@/features/admin/dashboard/components/TopProductsList';
import { LowStockList } from '@/features/admin/dashboard/components/LowStockList';
import { CustomerGrowthCard } from '@/features/admin/dashboard/components/CustomerGrowthCard';
import { StoreServicesGrid } from '@/features/admin/dashboard/components/StoreServicesGrid';
import { RecentOrdersList } from '@/features/admin/dashboard/components/RecentOrdersList';
import { QuickActionsGrid } from '@/features/admin/dashboard/components/QuickActionsGrid';
import { DashboardDetailModal } from '@/features/admin/dashboard/components/DashboardDetailModal';
import { styles } from '@/features/admin/dashboard/styles';
import type { RecentOrder } from '@/features/admin/dashboard/types';

export default function AdminDashboardScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // ── Responsive width model ────────────────────────────────────────────────
  // The AdminSidebar (see (admin)/_layout.tsx) renders as a 260px column beside
  // this screen ONLY at width >= 900. useWindowDimensions() returns the whole
  // window, so the width actually available to this screen is width - sidebar.
  const sidebarWidth = width >= 900 ? 260 : 0;
  const contentWidth = width - sidebarWidth;
  const hPad = contentWidth < 600 ? 16 : 24;                 // pageShell side padding
  const innerWidth = Math.min(contentWidth, 1344) - hPad * 2; // usable content width
  const GAP = 14;
  // KPI cards: as many columns as fit at ~168px min, between 2 and 5.
  const kpiCols = Math.max(2, Math.min(5, Math.floor((innerWidth + GAP) / (168 + GAP))));
  const kpiWidth = (innerWidth - GAP * (kpiCols - 1)) / kpiCols;
  const twoCol = innerWidth >= 620;                          // charts side-by-side
  const wideCharts = innerWidth >= 900;                      // 60/40 sales+status split
  // Service cards: 2–4 up depending on room.
  const svcCols = Math.max(2, Math.min(4, Math.floor((innerWidth + GAP) / (150 + GAP))));
  const serviceCardWidth = (innerWidth - GAP * (svcCols - 1)) / svcCols;

  const halfWidth = twoCol ? (innerWidth - 16) / 2 : innerWidth;
  const salesCardW = wideCharts ? innerWidth * 0.6 - 8 : twoCol ? halfWidth : innerWidth;
  const statusCardW = wideCharts ? innerWidth * 0.4 - 8 : twoCol ? halfWidth : innerWidth;

  const {
    stats,
    recentOrders,
    salesSeries,
    growthSeries,
    statusCounts,
    topProducts,
    lowStock,
    productsSold,
    aov,
    refreshing,
    onRefresh,
    refetch,
  } = useDashboardStats();

  const { detailModal, detailData, detailLoading, openDetailModal, closeDetailModal } = useDashboardDetails();

  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const handleOrderPress = (order: RecentOrder) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  // KPI cards whose `type` is empty (Products Sold, Avg Order Value) navigate
  // straight to Products instead of opening the detail sheet.
  const handleKpiPress = (type: string, title: string) => {
    if (type) openDetailModal(type, title);
    else router.push('/(admin)/products');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.pageShell, { paddingHorizontal: hPad }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>OVERVIEW</Text>
            <Text style={styles.adminName}>Good evening, {profile?.full_name?.split(' ')[0] || 'Admin'}</Text>
            <Text style={styles.headerCopy}>Here is what needs your attention across the store.</Text>
          </View>
          <Pressable
            style={styles.viewAllButton}
            onPress={() => router.push('/(admin)/orders')}
          >
            <Eye size={16} color="#FFFFFF" />
            <Text style={styles.viewAllText}>View orders</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <StatsHeader stats={stats} productsSold={productsSold} aov={aov} kpiWidth={kpiWidth} onKpiPress={handleKpiPress} />

          <View style={styles.chartsRow}>
            <SalesOverviewCard salesSeries={salesSeries} width={salesCardW} />
            <OrderStatusDonut statusCounts={statusCounts} totalOrders={stats.totalOrders} width={statusCardW} />
          </View>

          <View style={styles.chartsRow}>
            <TopProductsList topProducts={topProducts} width={halfWidth} />
            <LowStockList lowStock={lowStock} width={halfWidth} onNavigateToProducts={() => router.push('/(admin)/products')} />
          </View>

          <CustomerGrowthCard growthSeries={growthSeries} totalUsers={stats.totalUsers} width={innerWidth} />

          <StoreServicesGrid
            stats={stats}
            serviceCardWidth={serviceCardWidth}
            onServicePress={(type, title) => openDetailModal(type, title)}
          />

          <RecentOrdersList
            recentOrders={recentOrders}
            onOrderPress={handleOrderPress}
            onSeeAll={() => router.push('/(admin)/orders')}
          />

          <QuickActionsGrid />
        </ScrollView>
      </View>

      <OrderDetailsModal
        order={selectedOrder}
        visible={showOrderModal}
        mode="view"
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrder(null);
        }}
        onOrderUpdate={refetch}
      />

      <DashboardDetailModal
        detailModal={detailModal}
        detailData={detailData}
        detailLoading={detailLoading}
        onClose={closeDetailModal}
      />
    </SafeAreaView>
  );
}
