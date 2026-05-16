// app/booking.js — Screen 5: Booking confirmed
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Ic from '../src/components/Ic';
import { FilledBtn, OutlinedBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';

export default function BookingScreen() {
  const router = useRouter();
  const b = MDATA.booking;
  const p = MDATA.provider;

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Confirmed" subtitle="Booking complete" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>

        {/* Success header */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <View style={{ width: 76, height: 76, marginBottom: 14, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ position: 'absolute', inset: 0, backgroundColor: `${M.success}22`, borderRadius: 38 }} />
            <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff',
              borderWidth: 3, borderColor: M.success,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: M.success, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 }}>
              <Ic name="check" size={32} color={M.success} weight={3.5} />
            </View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: M.text, letterSpacing: -0.3, marginBottom: 4 }}>You're all set!</Text>
          <Text style={{ fontSize: 13, color: M.textMute }}>Your AI agent completed the booking</Text>
        </View>

        {/* Provider strip */}
        <MCard style={{ marginBottom: 10 }}>
          <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar initials={p.initials} gradient={p.gradient} size={42} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 15, fontWeight: '800' }}>{p.name}</Text>
                {p.verified && <Ic name="shield" size={12} color={M.accent} fill />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Ic name="star" size={10} color={M.amber} fill />
                <Text style={{ fontSize: 12, color: M.textMute }}>{p.rating} · {p.distance}</Text>
              </View>
            </View>
            <TouchableOpacity style={{ width: 36, height: 36, borderRadius: 18,
              borderWidth: 1, borderColor: M.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ic name="msg" size={16} color={M.text} />
            </TouchableOpacity>
          </View>
        </MCard>

        {/* Booking details */}
        <MCard style={{ marginBottom: 10 }}>
          <View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
            borderBottomWidth: 1, borderBottomColor: M.divider }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Booking details</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: M.successBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: M.success }} />
              <Text style={{ fontSize: 10, fontWeight: '800', color: M.success, textTransform: 'uppercase', letterSpacing: 0.6 }}>Confirmed</Text>
            </View>
          </View>
          {[
            { icon: 'cal',  label: 'When',       val: b.slot,      mono: false },
            { icon: 'pin',  label: 'Location',   val: b.location,  mono: false },
            { icon: 'flow', label: 'Booking ID', val: b.bookingId, mono: true  },
          ].map((r, i, arr) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 12, paddingHorizontal: 16,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: M.divider }}>
              <Ic name={r.icon} size={16} color={M.textMute} weight={2} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600' }}>{r.label}</Text>
                <Text style={{ fontSize: r.mono ? 12 : 13, fontWeight: '700', color: M.text, marginTop: 1 }}>{r.val}</Text>
              </View>
            </View>
          ))}
        </MCard>

        {/* Reminder pill */}
        <View style={{ backgroundColor: M.purpleBg, borderRadius: 14, padding: 14,
          borderWidth: 1, borderColor: `${M.purple}30`, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ic name="alarm" size={15} color={M.purple} weight={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#5B21B6' }}>Reminder scheduled</Text>
            <Text style={{ fontSize: 12, color: '#7C3AED', marginTop: 1 }}>9:00 AM tomorrow · 1 hr before arrival</Text>
          </View>
        </View>

        {/* Agent checklist */}
        <MCard style={{ marginBottom: 18, backgroundColor: M.surfaceLow, borderWidth: 0 }}>
          <View style={{ padding: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ic name="sparkle" size={12} color={M.accentDeep} fill />
              <Text style={{ fontSize: 10, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Agent actions completed
              </Text>
            </View>
            {['Booking created', 'Reminder scheduled', 'Trace generated'].map((s, i) => (
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
          <FilledBtn onPress={() => router.push('/trace')}>View agent trace</FilledBtn>
          <OutlinedBtn onPress={() => router.replace('/')}>Start another request</OutlinedBtn>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}
