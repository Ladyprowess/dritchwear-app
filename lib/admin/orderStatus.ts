export const getOrderStatusColor = (status: string): string => {
  switch (status) {
    case 'pending':      return '#F59E0B';
    case 'confirmed':    return '#10B981';
    case 'processing':   return '#3B82F6';
    case 'shipped':      return '#8B5CF6';
    case 'delivered':    return '#059669';
    case 'cancelled':    return '#EF4444';
    case 'under_review': return '#3B82F6';
    case 'quoted':       return '#F59E0B';
    case 'accepted':     return '#10B981';
    case 'rejected':     return '#EF4444';
    case 'completed':    return '#059669';
    default:             return '#6B7280';
  }
};

export const getStatusBadgeColor = (status: string): string => {
  const s = (status || '').toLowerCase();
  if (['active', 'paid', 'confirmed', 'success', 'completed', 'accepted', 'delivered'].includes(s))
    return '#10B981';
  if (['pending', 'quoted', 'under_review', 'processing'].includes(s))
    return '#F59E0B';
  if (['redeemed', 'shipped'].includes(s))
    return '#3B82F6';
  if (['cancelled', 'failed', 'rejected', 'expired'].includes(s))
    return '#EF4444';
  return '#6B7280';
};
