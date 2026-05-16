// app/_layout.js — expo-router root layout
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="loading" options={{ animation: 'fade' }} />
          <Stack.Screen name="understanding" />
          <Stack.Screen name="recommendation" />
          <Stack.Screen name="booking" />
          <Stack.Screen name="trace" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
