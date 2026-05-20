// app/_layout.js — expo-router root layout with Firebase auth guard
import { Stack, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View, Platform } from 'react-native';
import { AuthProvider, useAuth } from '../src/AuthContext';
import { useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken } from '../src/api';
import { subscribeToBookings } from '../src/realtime';
import BottomNav from '../src/components/BottomNav';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';

const HIDE_NAV_PATHS = new Set(['/login', '/loading', '/booking-chat']);

function activeTabForPath(path) {
  if (path === '/' || path === '') return 'book';
  if (path.startsWith('/bookings')) return 'history';
  if (path.startsWith('/profile')) return 'profile';
  return '';
}

function PersistentBottomNav() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  if (loading || !user) return null;
  if (HIDE_NAV_PATHS.has(pathname)) return null;
  return <BottomNav active={activeTabForPath(pathname)} />;
}

function ProviderAcceptedModal({ booking, visible, onClose }) {
  const providerName = booking?.providerName || 'Your provider';
  const slotLabel = booking?.slotLabel || booking?.slot || null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.48)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 22,
      }}>
        <View style={{
          width: '100%',
          maxWidth: 360,
          backgroundColor: M.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: M.border,
          padding: 18,
          shadowColor: '#0F172A',
          shadowOpacity: 0.18,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 14 },
          elevation: 8,
        }}>
          <View style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            backgroundColor: M.successBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
          }}>
            <Ic name="check" size={28} color={M.success} weight={2.8} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: M.text, letterSpacing: -0.2 }}>
            Provider accepted
          </Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: M.textMute, marginTop: 7 }}>
            {providerName} confirmed your booking{slotLabel ? ` for ${slotLabel}` : ''}.
          </Text>
          {!!booking?.bookingId && (
            <View style={{
              marginTop: 14,
              backgroundColor: M.surfaceLow,
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 7,
            }}>
              <Ic name="flow" size={13} color={M.textDim} />
              <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: M.textDim }}>
                {booking.bookingId}
              </Text>
            </View>
          )}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.82}
            style={{
              height: 48,
              borderRadius: 14,
              backgroundColor: M.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function handleRegistrationError(errorMessage) {
  console.warn(errorMessage);
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    handleRegistrationError('Permission not granted to get push token for push notification!');
    return;
  }
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    console.warn('Project ID not found. Notifications require an EAS project ID.');
  }
  try {
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
    console.log('Expo Push Token:', pushTokenString);
    return pushTokenString;
  } catch (e) {
    handleRegistrationError(`${e}`);
  }
}

function AuthGuard({ children }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === 'login';

    if (!user && !inAuthScreen) {
      router.replace('/login');
    } else if (user && inAuthScreen) {
      router.replace('/');
    }
  }, [user, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [notification, setNotification] = useState(undefined);
  const notificationListener = useRef();
  const responseListener = useRef();
  const providerAcceptedPopupIds = useRef(new Set());
  const [acceptedBooking, setAcceptedBooking] = useState(null);

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(async (token) => {
        setExpoPushToken(token ?? '');
        if (token) {
          try {
            await registerPushToken(token);
          } catch (err) {
            console.warn('Push token registration failed:', err.message);
          }
        }
      })
      .catch((error) => setExpoPushToken(`${error}`));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    return subscribeToBookings(({ booking }) => {
      if (
        !booking?.bookingId ||
        booking.status !== 'confirmed' ||
        booking.lifecycleStatus !== 'provider_accepted' ||
        providerAcceptedPopupIds.current.has(booking.bookingId)
      ) {
        return;
      }

      providerAcceptedPopupIds.current.add(booking.bookingId);
      setAcceptedBooking(booking);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGuard>
            <View style={{ flex: 1 }}>
              <View style={{ flex: 1 }}>
                <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="loading" options={{ animation: 'fade' }} />
                  <Stack.Screen name="understanding" />
                  <Stack.Screen name="recommendation" />
                  <Stack.Screen name="booking" />
                  <Stack.Screen name="booking-chat" />
                  <Stack.Screen name="bookings" />
                  <Stack.Screen name="profile" />
                  <Stack.Screen name="notifications" />
                  <Stack.Screen name="trace" />
                </Stack>
              </View>
              <PersistentBottomNav />
            </View>
          </AuthGuard>
        </AuthProvider>
      </SafeAreaProvider>
      <ProviderAcceptedModal
        visible={!!acceptedBooking}
        booking={acceptedBooking}
        onClose={() => setAcceptedBooking(null)}
      />
    </GestureHandlerRootView>
  );
}
