import React from 'react';
import { View, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EdgeToEdgeWrapper({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: '#F9FAFB',
      }}
    >
      {Platform.OS === 'android' && (
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      )}
      {children}
    </View>
  );
}
