// app/booking.js — Booking status
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Ic from '../src/components/Ic';
import { FilledBtn, OutlinedBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';
import { getBooking } from '../src/api';
import { subscribeToBooking } from '../src/realtime';

function statusConfig(status) {
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
  const reminderTime = b.reminderTimeLabel || 'After provider accepts';
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

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Booking status" subtitle={config.pill} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 76, height: 76, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', inset: 0, backgroundColor: `${config.color}22`, borderRadius: 38 }} />
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff',
              borderWidth: 3, borderColor: config.color,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: config.color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 }}>
              <Ic name={config.icon} size={32} color={config.color} weight={3.5} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: M.text, letterSpacing: -0.3, marginBottom: 4 }}>{config.title}</Text>
          <Text style={{ fontSize: 13, color: M.textMute }}>{config.subtitle}</Text>
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

        <MCard style={{ marginBottom: 10 }}>
          <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: M.divider }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Booking details</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: config.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: config.color }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: config.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>{config.pill}</Text>
            </View>
          </View>
          {[
            { icon: 'cal',  label: 'When',       val: b.slot },
            { icon: 'pin',  label: 'Location',   val: b.location },
            { icon: 'flow', label: 'Booking ID', val: b.bookingId },
            { icon: 'msg',  label: 'Provider reply', val: b.providerResponseMessage || 'Waiting for WhatsApp reply' },
          ].map((r, i, arr) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 16, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: M.divider }}>
              <Ic name={r.icon} size={16} color={M.textMute} weight={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600' }}>{r.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: M.text, marginTop: 1 }}>{r.val}</Text>
              </View>
            </View>
          ))}
        </MCard>

        <View style={{ backgroundColor: M.purpleBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${M.purple}30`, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ic name="alarm" size={15} color={M.purple} weight={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#5B21B6' }}>{config.reminderTitle}</Text>
            <Text style={{ fontSize: 12, color: '#7C3AED', marginTop: 1 }}>{b.status === 'confirmed' ? `${reminderTime} · 1 hr before arrival` : reminderTime}</Text>
          </View>
        </View>

        <MCard style={{ marginBottom: 18, backgroundColor: M.surfaceLow, borderWidth: 0 }}>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ic name="sparkle" size={12} color={M.accentDeep} fill />
              <Text style={{ fontSize: 10, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Agent actions completed</Text>
            </View>
            {[
              'Booking request created',
              b.providerMessageSid ? 'WhatsApp sent to provider' : 'WhatsApp send pending',
              b.status === 'confirmed' ? 'Provider accepted' : b.status === 'rejected' ? 'Provider rejected' : 'Awaiting provider reply',
            ].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingTop: i > 0 ? 7 : 0 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: M.success, alignItems: 'center', justifyContent: 'center' }}>
                  <Ic name="check" size={11} color="#fff" weight={3} />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: M.text }}>{s}</Text>
              </View>
            ))}
          </View>
        </MCard>

        <View style={{ gap: 9 }}>
          <FilledBtn onPress={refresh}>Refresh status</FilledBtn>
          <FilledBtn onPress={() => router.push({ pathname: '/dev/trace', params: { apiData: params.apiData } })}>Booking activity</FilledBtn>
          <OutlinedBtn onPress={() => router.replace('/')}>Start another request</OutlinedBtn>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}
