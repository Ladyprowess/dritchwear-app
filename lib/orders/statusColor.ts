// Status-badge color for order/invoice statuses, shared by OrderDetailsModal
// and app/(admin)/orders.tsx (verified character-for-character identical
// between the two - a true duplicate, unlike the dashboard's narrower
// getOrderStatusColor in lib/admin/orderStatus.ts, which lacks in_review/
// payment_made and is NOT the same function).
export function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'in_review': return '#6366F1';
    case 'confirmed': return '#10B981';
    case 'processing': return '#3B82F6';
    case 'shipped': return '#8B5CF6';
    case 'delivered': return '#059669';
    case 'cancelled': return '#EF4444';
    case 'under_review': return '#3B82F6';
    case 'quoted': return '#F59E0B';
    case 'accepted': return '#10B981';
    case 'rejected': return '#EF4444';
    case 'payment_made': return '#8B5CF6';
    case 'completed': return '#059669';
    default: return '#6B7280';
  }
}
