// app/bookings.js — Bookings history
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
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { listBookings } from '../src/api';
import { subscribeToBookings } from '../src/realtime';

function initialsFor(name = '') {
  return name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase() || 'BK';
}

function formatCreatedAt(value) {
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

function statusColor(status) {
  if (status === 'confirmed') return { bg: M.successBg, fg: M.success };
  if (status === 'rejected' || status === 'provider_message_failed' || status === 'failed') return { bg: '#FEF2F2', fg: M.error };
  if (status === 'pending_provider_response') return { bg: M.amberBg, fg: M.amber };
  if (status === 'pending_user_confirmation') return { bg: '#FFF7ED', fg: '#EA580C' };
  return { bg: M.surfaceLow, fg: M.textMute };
}

function statusLabel(status) {
  if (status === 'pending_provider_response') return 'waiting';
  if (status === 'provider_message_failed') return 'message failed';
  if (status === 'pending_user_confirmation') return 'action required';
  return status || 'saved';
}

function lifecycleLabel(booking) {
  if (booking.providerResponseMessage) return booking.providerResponseMessage;
  const status = booking.lifecycleStatus;
  if (status === 'created') return 'Draft created — awaiting confirmation';
  if (status === 'message_sent_to_provider') return 'Request sent to provider';
  if (status === 'provider_accepted') return 'Confirmed by provider';
  if (status === 'provider_rejected') return 'Declined by provider';
  if (status === 'provider_message_failed') return 'Delivery failed';
  if (status === 'provider_reply_needs_review') return 'Reply needs manual review';
  return 'Waiting for provider reply';
}

export default function BookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await listBookings();
      const rows = [...(result.bookings || [])].sort((a, b) =>
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );
      setBookings(rows);
    } catch (err) {
      setError(err.message || 'Could not load bookings.');
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

  useEffect(() => {
    return subscribeToBookings(({ booking }) => {
      if (!booking?.bookingId) {
        load({ silent: true });
        return;
      }
      setBookings((current) => {
        const exists = current.some((row) => row.bookingId === booking.bookingId);
        const next = exists
          ? current.map((row) => (row.bookingId === booking.bookingId ? { ...row, ...booking } : row))
          : [booking, ...current];
        return [...next].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      });
    });
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load({ silent: true });
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Bookings" subtitle={`${bookings.length} saved`} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
            <ActivityIndicator color={M.accent} />
            <Text style={{ marginTop: 10, fontSize: 13, color: M.textMute }}>Loading bookings</Text>
          </View>
        )}

        {!loading && error && (
          <View style={{ backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#991B1B', marginBottom: 4 }}>Could not load bookings</Text>
            <Text style={{ fontSize: 12, color: '#B91C1C', lineHeight: 18, marginBottom: 12 }}>{error}</Text>
            <TouchableOpacity onPress={() => load()} style={{ backgroundColor: M.error, borderRadius: 10, paddingVertical: 11, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && bookings.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: M.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Ic name="list" size={30} color={M.accentDeep} weight={2.2} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: M.text, marginBottom: 5 }}>No bookings yet</Text>
            <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', lineHeight: 20, marginBottom: 18 }}>
              Send a provider request and your booking status will appear here.
            </Text>
            <TouchableOpacity onPress={() => router.push('/')} style={{ backgroundColor: M.accent, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Book a service</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && bookings.length > 0 && (
          <View style={{ gap: 10 }}>
            {bookings.map((booking) => {
              const colors = statusColor(booking.status);
              return (
                <TouchableOpacity
                  key={booking.bookingId}
                  activeOpacity={0.85}
                  onPress={() => {
                    router.push({
                      pathname: '/booking',
                      params: {
                        apiData: JSON.stringify({
                          booking,
                          recommendation: {
                            name: booking.providerName,
                            initials: initialsFor(booking.providerName),
                            rating: 4.8,
                            distance: '2.1 km',
                            verified: true,
                          }
                        }),
                      },
                    });
                  }}
                >
                  <MCard style={{ overflow: 'hidden' }}>
                    <View style={{ padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <Avatar initials={initialsFor(booking.providerName)} gradient={['#10B981', '#047857']} size={44} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: M.text }}>{booking.providerName || 'Provider'}</Text>
                          <View style={{ backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.fg, textTransform: 'uppercase' }}>{statusLabel(booking.status)}</Text>
                          </View>
                        </View>

                        <View style={{ gap: 6, marginTop: 5 }}>
                          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                            <Ic name="cal" size={13} color={M.textDim} weight={2} />
                            <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: M.text }}>{booking.slotLabel || booking.slot || 'Time not set'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                            <Ic name="pin" size={13} color={M.textDim} weight={2} />
                            <Text style={{ flex: 1, fontSize: 12, color: M.textMute }}>{booking.location || 'Location not set'}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                            <Ic name="flow" size={13} color={M.textDim} weight={2} />
                            <Text style={{ flex: 1, fontSize: 11.5, color: M.textDim }}>{booking.bookingId}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                            <Ic name="msg" size={13} color={M.textDim} weight={2} />
                            <Text style={{ flex: 1, fontSize: 11.5, color: M.textDim }}>{lifecycleLabel(booking)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={{ borderTopWidth: 1, borderTopColor: M.divider, paddingHorizontal: 14, paddingVertical: 10 }}>
                      <Text style={{ fontSize: 11.5, color: M.textDim }}>{formatCreatedAt(booking.createdAt) || 'Recently created'}</Text>
                    </View>
                  </MCard>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

    </View>
  );
}
