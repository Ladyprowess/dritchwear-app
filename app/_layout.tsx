import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as SystemUI from 'expo-system-ui';
import 'react-native-url-polyfill/auto';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after fonts are loaded
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Configure edge-to-edge for Android 15+
    if (Platform.OS === 'android') {
      // Use updated APIs for Android 15+ compatibility
      SystemUI.setBackgroundColorAsync('transparent');
      
      if (Platform.Version >= 35) {
        console.log('Configuring edge-to-edge for Android 15+ (SDK 35+)');
        // Android 15+ handles edge-to-edge automatically with proper inset handling
      }
    }
  }, []);
  // Keep the splash screen visible while fonts are loading
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <CartProvider>
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ 
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' }
            }}>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(customer)" options={{ headerShown: false }} />
              <Stack.Screen name="(admin)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
            </Stack>
            <StatusBar 
              style="auto" 
              translucent 
              backgroundColor="transparent" 
              hidden={false}
            />
          </View>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}