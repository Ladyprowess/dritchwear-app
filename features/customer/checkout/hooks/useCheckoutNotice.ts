import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import type { WebNotice } from '../types';

// On web, Alert.alert is a no-op, so checkout uses an in-tree modal instead;
// native keeps using the platform Alert.
export function useCheckoutNotice() {
  const [webNotice, setWebNotice] = useState<WebNotice | null>(null);

  const showCheckoutNotice = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      setWebNotice({ title, message });
      return;
    }

    Alert.alert(title, message);
  };

  const closeWebNotice = () => {
    const onClose = webNotice?.onClose;
    setWebNotice(null);
    onClose?.();
  };

  return { webNotice, setWebNotice, showCheckoutNotice, closeWebNotice };
}
