// app/booking.js — Booking status
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ActivityIndicator, Linking, RefreshControl, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../src/components/TopBar';
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Ic from '../src/components/Ic';
import { FilledBtn, OutlinedBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';
import { getBooking, confirmBooking } from '../src/api';
import { subscribeToBooking } from '../src/realtime';

function formatSlot(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function statusConfig(status) {
  if (status === 'pending_user_confirmation') {
    return {
      title: 'Awaiting your confirmation',
      subtitle: 'Please confirm this draft to send the request to the provider',
      pill: 'Action Required',
      color: '#EA580C',
      bg: '#FFF7ED',
      icon: 'clock',
      reminderTitle: 'Awaiting confirmation',
    };
  }
  if (status === 'confirmed') {
    return {
      title: 'Provider accepted',
      subtitle: 'Your booking is confirmed',
      pill: 'Confirmed',
      color: M.success,
      bg: M.successBg,
      icon: 'check',
      reminderTitle: 'Reminder scheduled',
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Provider unavailable',
      subtitle: 'This provider declined the request',
      pill: 'Rejected',
      color: M.error,
      bg: '#FEF2F2',
      icon: 'alarm',
      reminderTitle: 'No reminder scheduled',
    };
  }
  if (status === 'cancelled') {
    return {
      title: 'Booking cancelled',
      subtitle: 'This booking was cancelled after approval',
      pill: 'Cancelled',
      color: M.error,
      bg: '#FEF2F2',
      icon: 'alarm',
      reminderTitle: 'No reminder scheduled',
    };
  }
  if (status === 'provider_message_failed') {
    return {
      title: 'Could not contact provider',
      subtitle: 'WhatsApp message was not sent',
      pill: 'Message failed',
      color: M.error,
      bg: '#FEF2F2',
      icon: 'alarm',
      reminderTitle: 'Provider not contacted',
    };
  }
  return {
    title: 'Request sent',
    subtitle: 'Waiting for provider response',
    pill: 'Waiting',
    color: M.amber,
    bg: M.amberBg,
    icon: 'clock',
    reminderTitle: 'Reminder pending',
  };
}

function providerResponseRow(booking) {
  if (booking.providerResponseStatus === 'accepted') {
    return { icon: 'check', label: 'Provider response', val: 'Accepted your booking' };
  }
  if (booking.providerResponseStatus === 'rejected') {
    return { icon: 'alarm', label: 'Provider response', val: 'Declined this request' };
  }

  const raw = String(booking.providerResponseMessage || '').trim();
  if (!raw || /^(accept|accepted|yes|confirm|confirmed|reject|rejected|decline|declined|no)$/i.test(raw)) {
    return null;
  }
  return { icon: 'msg', label: 'Provider message', val: raw };
}

export default function BookingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  let apiResult = null;
  try { apiResult = params.apiData ? JSON.parse(params.apiData) : null; } catch {}

  const initialBooking = apiResult?.booking || MDATA.booking;
  const [booking, setBooking] = useState(initialBooking);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const b = booking;
  const p = apiResult?.recommendation || MDATA.provider;
  const pName = p.providerName || p.name;
  const initials = p.initials || pName?.split(' ').map(w => w[0]).join('').slice(0, 2);
  const gradient = p.gradient || ['#10B981', '#047857'];
  const config = statusConfig(b.status);
  const reminderTime = b.reminderTimeLabel || (b.reminderTime ? formatSlot(b.reminderTime) : 'After provider accepts');
  const responseRow = providerResponseRow(b);
  const traceStepCount = apiResult?.trace?.length || b.traceSummary?.length || 0;
  const hasTrace = Boolean(apiResult?.trace?.length || b.traceId);
  const openMaps = () => {
    if (p.googleMapsUri) Linking.openURL(p.googleMapsUri);
  };
  const refresh = useCallback(async () => {
    if (!b.bookingId) return;
    setRefreshing(true);
    setError(null);
    try {
      const next = await getBooking(b.bookingId);
      setBooking((current) => ({ ...current, ...next }));
    } catch (err) {
      setError(err.message || 'Could not refresh booking status.');
    } finally {
      setRefreshing(false);
    }
  }, [b.bookingId]);

  const handleConfirm = useCallback(async () => {
    if (!b.bookingId) return;
    setRefreshing(true);
    setError(null);
    try {
      const next = await confirmBooking(b.bookingId);
      setBooking((current) => ({ ...current, ...next }));
    } catch (err) {
      setError(err.message || 'Could not confirm booking.');
    } finally {
      setRefreshing(false);
    }
  }, [b.bookingId]);

  const openTrace = useCallback(() => {
    const events = apiResult?.trace || [];
    router.push({
      pathname: '/trace',
      params: {
        trace: JSON.stringify(events),
        traceId: b.traceId || apiResult?.traceId || '',
      },
    });
  }, [apiResult, b.traceId, router]);

  const openChat = useCallback(() => {
    if (!b.bookingId) return;
    router.push({
      pathname: '/booking-chat',
      params: {
        bookingId: b.bookingId,
        providerName: pName || b.providerName || 'Provider',
      },
    });
  }, [b.bookingId, b.providerName, pName, router]);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!b.bookingId) return undefined;
    return subscribeToBooking(b.bookingId, (next) => {
      setBooking((current) => ({ ...current, ...next }));
      setError(null);
    });
  }, [b.bookingId]);

  // Pulse animation for the waiting state
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (b.status && b.status !== 'pending' && b.status !== 'waiting' && b.status !== undefined) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [b.status]);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar
        title="Booking status"
        onBack={() => router.back()}
        action={
          refreshing ? (
            <ActivityIndicator color={M.accentDeep} style={{ marginRight: 12 }} />
          ) : (
            <TouchableOpacity
              onPress={refresh}
              activeOpacity={0.7}
              style={{
                width: 40, height: 40, borderRadius: 12,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: M.surfaceLow,
                marginRight: 4,
              }}
            >
              <Ic name="refresh" size={17} color={M.text} weight={2.2} />
            </TouchableOpacity>
          )
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 84, height: 84, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', width: 84, height: 84, borderRadius: 42,
                backgroundColor: config.color,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              }}
            />
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: config.bg,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1.5, borderColor: `${config.color}40`,
            }}>
              <Ic name={config.icon} size={30} color={config.color} weight={2.5} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: M.text, letterSpacing: -0.3, marginBottom: 4 }}>{config.title}</Text>
          <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', paddingHorizontal: 24 }}>{config.subtitle}</Text>
          {refreshing && <ActivityIndicator color={M.accent} style={{ marginTop: 12 }} />}
          {error && <Text style={{ fontSize: 12, color: M.error, marginTop: 10 }}>{error}</Text>}
        </View>

        <MCard style={{ marginBottom: 10 }}>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar initials={initials} gradient={gradient} size={42} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 15, fontWeight: '800' }}>{pName}</Text>
                {p.verified && <Ic name="shield" size={12} color={M.accent} fill />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ic name="star" size={10} color={M.amber} fill />
                <Text style={{ fontSize: 12, color: M.textMute }}>{p.rating} · {p.distance}</Text>
              </View>
            </View>
            <TouchableOpacity
              disabled={!p.googleMapsUri}
              onPress={openMaps}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: M.border,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: p.googleMapsUri ? 1 : 0.45,
              }}
            >
              <Ic name="pin" size={16} color={M.text} />
            </TouchableOpacity>
          </View>
        </MCard>

        <MCard style={{ marginBottom: 14 }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: M.divider }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Booking details</Text>
          </View>
          {[
            { icon: 'cal',   label: 'When',       val: formatSlot(b.slot) },
            { icon: 'pin',   label: 'Location',   val: b.location || '—' },
            { icon: 'flow',  label: 'Booking ID', val: b.bookingId || '—', mono: true },
            { icon: 'alarm', label: 'Reminder',   val: b.status === 'confirmed' ? `${reminderTime} (1 hr before)` : reminderTime },
            ...(responseRow ? [responseRow] : []),
          ].map((r, i, arr) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: M.divider }}>
              <View style={{
                width: 32, height: 32, borderRadius: 9,
                backgroundColor: M.surfaceLow,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic name={r.icon} size={15} color={M.textMute} weight={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600', letterSpacing: 0.2 }}>{r.label}</Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 13, fontWeight: '700', color: M.text, marginTop: 2,
                    ...(r.mono ? { fontVariant: ['tabular-nums'] } : null),
                  }}
                >
                  {r.val}
                </Text>
              </View>
            </View>
          ))}
        </MCard>

        <View style={{ gap: 9 }}>
          {!!b.bookingId && (
            <TouchableOpacity
              onPress={openChat}
              activeOpacity={0.82}
              style={{
                height: 52,
                borderRadius: 14,
                backgroundColor: M.accent,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ic name="msg" size={18} color="#FFFFFF" weight={2.3} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Chat</Text>
            </TouchableOpacity>
          )}
          {b.status === 'pending_user_confirmation' && (
            <FilledBtn onPress={handleConfirm} style={{ backgroundColor: '#EA580C' }}>
              Confirm Booking
            </FilledBtn>
          )}
          {hasTrace && (
            <TouchableOpacity
              onPress={openTrace}
              activeOpacity={0.82}
              style={{
                height: 48,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: M.border,
                backgroundColor: M.surface,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Ic name="flow" size={16} color={M.text} weight={2.2} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: M.text }}>
                View agent trace{traceStepCount ? ` · ${traceStepCount} steps` : ''}
              </Text>
            </TouchableOpacity>
          )}
          <OutlinedBtn onPress={() => router.replace('/')}>Start another request</OutlinedBtn>
        </View>
      </ScrollView>
    </View>
  );
}
