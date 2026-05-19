// app/notifications.js — Notifications history
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { listNotifications } from '../src/api';

function formatNotificationTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function notificationConfig(type) {
  if (type === 'reminder') {
    return {
      icon: 'alarm',
      bg: M.purpleBg,
      fg: M.purple,
      label: 'Reminder',
    };
  }
  if (type === 'twilio_status') {
    return {
      icon: 'msg',
      bg: M.accentSoft,
      fg: M.accentDeep,
      label: 'WhatsApp Status',
    };
  }
  return {
    icon: 'bell',
    bg: M.surfaceLow,
    fg: M.textMute,
    label: 'Notification',
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await listNotifications();
      const rows = [...(result.notifications || [])].sort((a, b) =>
        new Date(b.createdAt || b.scheduledFor || 0) - new Date(a.createdAt || a.scheduledFor || 0)
      );
      setNotifications(rows);
    } catch (err) {
      setError(err.message || 'Could not load notification history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    load({ silent: true });
  }, [load]));

  const refresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Notifications" subtitle={`${notifications.length} logged`} onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <ActivityIndicator color={M.accent} />
            <Text style={{ marginTop: 10, fontSize: 13, color: M.textMute }}>Loading notifications</Text>
          </View>
        )}

        {!loading && error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B', marginBottom: 4 }}>Could not load notifications</Text>
            <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 18, marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={{ backgroundColor: M.error, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && notifications.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: M.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ic name="bell" size={30} color={M.accentDeep} weight={2.2} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: M.text, marginBottom: 5 }}>No notifications yet</Text>
            <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>
              Your past push and system notifications will be saved and displayed here.
            </Text>
            <TouchableOpacity onPress={() => router.push('/')} style={{ backgroundColor: M.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Book a service</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && notifications.length > 0 && (
          <View style={{ gap: 10 }}>
            {notifications.map((notif) => {
              const cfg = notificationConfig(notif.type);
              const hasBooking = !!notif.bookingId;

              const CardContent = (
                <MCard style={{ overflow: 'hidden' }}>
                  <View style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <View style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: cfg.bg,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ic name={cfg.icon} size={18} color={cfg.fg} weight={2.2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{ flex: 1, fontSize: 11, fontWeight: '800', color: cfg.fg, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {cfg.label}
                        </Text>
                        <Text style={{ fontSize: 11, color: M.textDim }}>
                          {formatNotificationTime(notif.createdAt || notif.scheduledFor)}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13.5, color: M.text, lineHeight: 19, fontWeight: '500' }}>
                        {notif.message || `Notification event: ${notif.notificationId}`}
                      </Text>

                      {hasBooking && (
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          marginTop: 8, alignSelf: 'flex-start',
                          backgroundColor: M.surfaceLow, borderRadius: 6,
                          paddingHorizontal: 7, paddingVertical: 3,
                        }}>
                          <Ic name="flow" size={11} color={M.textMute} />
                          <Text style={{ fontSize: 10.5, color: M.textDim, fontWeight: '600' }}>
                            Booking {notif.bookingId}
                          </Text>
                        </View>
                      )}
                    </View>

                    {hasBooking && (
                      <View style={{ alignSelf: 'center', paddingLeft: 4 }}>
                        <Ic name="chev" size={16} color={M.textDim} weight={2} />
                      </View>
                    )}
                  </View>
                </MCard>
              );

              if (hasBooking) {
                return (
                  <TouchableOpacity
                    key={notif.notificationId}
                    activeOpacity={0.8}
                    onPress={() => {
                      router.push({
                        pathname: '/booking',
                        params: {
                          apiData: JSON.stringify({
                            booking: { bookingId: notif.bookingId }
                          })
                        }
                      });
                    }}
                  >
                    {CardContent}
                  </TouchableOpacity>
                );
              }

              return (
                <View key={notif.notificationId}>
                  {CardContent}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav active="" />
    </View>
  );
}
