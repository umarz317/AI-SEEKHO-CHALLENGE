// app/profile.js — Profile and app status
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { BASE_URL, getHealth } from '../src/api';
import { useAuth } from '../src/AuthContext';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const PROFILE_DEFAULTS = {
  city: 'Islamabad',
  language: 'English / Urdu',
};

function AdapterPill({ label, value }) {
  const live = value === 'google' || value === 'hybrid';
  const mock = value === 'mock';
  const color = live ? M.accentDeep : mock ? M.amber : M.textMute;
  const bg = live ? M.accentSoft : mock ? M.amberBg : M.surfaceLow;
  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: M.divider,
      gap: 10,
    }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: M.text }}>{label}</Text>
      <View style={{ backgroundColor: bg, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', color, textTransform: 'uppercase' }}>{value || 'unknown'}</Text>
      </View>
    </View>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 9 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: M.surfaceLow, alignItems: 'center', justifyContent: 'center' }}>
        <Ic name={icon} size={15} color={M.textDim} weight={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: M.text, marginTop: 1 }}>{value || '-'}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await getHealth();
      setHealth(result);
    } catch (err) {
      setError(err.message || 'Could not load profile status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  const adapters = health?.adapters || {};

  const handleTestNotification = async () => {
    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      const expoPushToken = tokenData.data;

      const message = {
        to: expoPushToken,
        sound: 'default',
        title: 'Test Notification 🚀',
        body: 'Push notifications are working!',
        data: { test: true },
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
      console.log('Test notification sent to token:', expoPushToken);
    } catch (e) {
      alert('Failed to send notification: ' + e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Profile" subtitle="Account and app status" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <MCard style={{ marginBottom: 12, overflow: 'hidden' }}>
          <View style={{ backgroundColor: M.primary, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: M.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Ic name="user" size={28} color="#fff" weight={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 19, fontWeight: '900', color: '#fff' }}>
                      {user?.displayName || user?.phoneNumber || 'User'}
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,.65)', marginTop: 2 }}>
                      {user?.uid ? user.uid.slice(0, 12) + '...' : 'Signed in'}
                    </Text>
                  </View>
                  <View style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: health?.status === 'ok' ? M.success : M.error,
                  }} />
                </View>
          </View>

          <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
            <InfoRow icon="pin" label="Default city" value={PROFILE_DEFAULTS.city} />
              <InfoRow icon="phone" label="Phone" value={user?.phoneNumber || '-'} />
              <InfoRow icon="globe" label="Language" value={PROFILE_DEFAULTS.language} />
            <InfoRow icon="cpu" label="Backend" value={BASE_URL} />
          </View>
        </MCard>

        {loading && (
          <View style={{ paddingVertical: 30, alignItems: 'center' }}>
            <ActivityIndicator color={M.accent} />
            <Text style={{ marginTop: 10, fontSize: 13, color: M.textMute }}>Checking backend status</Text>
          </View>
        )}

        {!loading && error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA', marginBottom: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B', marginBottom: 4 }}>Status unavailable</Text>
            <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 18, marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={{ backgroundColor: M.error, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && (
          <>
            <MCard style={{ marginBottom: 12, padding: 14 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>
                Service adapters
              </Text>
              <AdapterPill label="Intent" value={adapters.intent} />
              <AdapterPill label="Location" value={adapters.location} />
              <AdapterPill label="Provider search" value={adapters.provider} />
              <AdapterPill label="Distance" value={adapters.distance} />
              <AdapterPill label="Booking store" value={adapters.bookingStore} />
              <AdapterPill label="Reminder" value={adapters.reminder} />
            </MCard>

            <MCard style={{ marginBottom: 12, padding: 14 }}>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Storage
              </Text>
              <InfoRow icon="file" label="Type" value={health?.storage?.type || 'local_json'} />
              <InfoRow icon="flow" label="Mode" value={health?.mode || 'demo'} />
              <InfoRow icon="clock" label="Last checked" value={health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : '-'} />
            </MCard>
          </>
        )}

        <View style={{ gap: 9 }}>
          <TouchableOpacity
            onPress={handleTestNotification}
            style={{ backgroundColor: M.accentSoft, borderRadius: 13, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: M.accent }}
          >
            <Text style={{ color: M.accentDeep, fontWeight: '800' }}>Test Push Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => logout()}
            style={{ backgroundColor: '#FEF2F2', borderRadius: 13, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}
          >
            <Text style={{ color: M.error, fontWeight: '800' }}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNav active="profile" />
    </View>
  );
}
