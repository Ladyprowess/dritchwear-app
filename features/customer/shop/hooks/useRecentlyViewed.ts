import { useEffect, useState } from 'react';
import { getRecentlyViewed, addRecentlyViewed } from '@/lib/recentlyViewed';

export function useRecentlyViewed(userId: string | undefined) {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    void getRecentlyViewed(userId).then(setRecentIds);
  }, [userId]);

  const recordView = (productId: string) => {
    void addRecentlyViewed(productId, userId).then(setRecentIds);
  };

  return { recentIds, recordView };
}
