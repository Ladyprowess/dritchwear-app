// Order-status colors for the dashboard's order-status donut chart.
// Distinct from lib/admin/orderStatus.ts, which colors individual status badges.
export const DASHBOARD_STATUS_CHART_COLORS: Record<string, string> = {
  delivered: '#10B981',
  completed: '#059669',
  shipped: '#F59E0B',
  processing: '#7C3AED',
  confirmed: '#3B82F6',
  pending: '#9CA3AF',
  cancelled: '#EF4444',
};

// A product at or below this stock count shows up in the dashboard's
// "Low stock alert" card.
export const LOW_STOCK_THRESHOLD = 5;
