// Short admin date format: "Mar 5, 2:30 PM". Used by the dashboard and analytics
// screens. NOTE: app/(admin)/orders.tsx uses a different, longer format
// ("Mar 5, 2026") for its own list - not the same function, left untouched.
export const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
