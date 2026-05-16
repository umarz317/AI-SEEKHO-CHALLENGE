// app/recommendation.js — Screen 4: Best match (integrated)
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Pill from '../src/components/Pill';
import Ic from '../src/components/Ic';
import { AccentBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';

export default function RecommendationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [showAlt, setShowAlt] = useState(false);

  let apiResult = null;
  try { apiResult = params.apiData ? JSON.parse(params.apiData) : null; } catch {}

  // Use API data or fall back to mock
  const p = apiResult?.recommendation || MDATA.provider;
  const alts = apiResult?.alternatives || MDATA.alternatives;
  const totalProviders = (alts?.length || 0) + 1;

  // Normalize field names between API and mock
  const name = p.providerName || p.name;
  const initials = p.initials || name?.split(' ').map(w => w[0]).join('').slice(0, 2);
  const gradient = p.gradient || ['#10B981', '#047857'];

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Best match" subtitle={`Top of ${totalProviders} providers`} onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        <MCard style={{ marginBottom: 12 }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
              <Avatar initials={initials} gradient={gradient} size={54} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: M.text, letterSpacing: -0.2 }}>{name}</Text>
                  {p.verified && <Ic name="shield" size={14} color={M.accent} fill />}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ic name="star" size={13} color={M.amber} fill />
                  <Text style={{ fontWeight: '700', fontSize: 13, color: M.text }}>{p.rating}</Text>
                  <Text style={{ fontSize: 12, color: M.textMute }}>· {p.reviews} reviews · {p.yearsActive} yrs</Text>
                </View>
              </View>
              <View style={{ backgroundColor: M.accentSoft, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ic name="sparkle" size={10} color={M.accentDeep} fill />
                <Text style={{ fontSize: 10, fontWeight: '800', color: M.accentDeep, letterSpacing: 0.6, textTransform: 'uppercase' }}>AI</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: M.surfaceLow, borderRadius: 12, borderWidth: 1, borderColor: M.divider, overflow: 'hidden', marginBottom: 14 }}>
              {[
                { icon: 'pin',   label: 'Distance',  value: p.distance },
                { icon: 'clock', label: 'Available', value: p.availability },
                { icon: 'flow',  label: 'Jobs',      value: `${p.completedJobs}+` },
              ].map((s, i, arr) => (
                <View key={i} style={{ flex: 1, padding: 10, alignItems: 'center', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: M.divider }}>
                  <Ic name={s.icon} size={14} color={M.textDim} weight={2} />
                  <Text style={{ fontSize: 14, fontWeight: '800', color: M.text, marginTop: 3 }}>{s.value}</Text>
                  <Text style={{ fontSize: 10, color: M.textMute, marginTop: 1 }}>{s.label}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 10, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7 }}>Why this provider</Text>
            <Text style={{ fontSize: 13, color: M.textMute, lineHeight: 20, marginBottom: 10 }}>{p.description}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {(p.reasons || []).map((r, i) => (
                <Pill key={i} label={r} color={M.accentDeep} bg={M.accentSoft} icon="check" />
              ))}
            </View>
          </View>
          <View style={{ backgroundColor: M.accentSoft, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: M.divider }}>
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: M.accentDeep, textTransform: 'uppercase', letterSpacing: 0.8 }}>Match Score</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: M.accentDeep, marginTop: 2 }}>{p.score}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: M.accent }} />
              <Text style={{ color: M.accentDeep, fontSize: 11, fontWeight: '700' }}>EXCELLENT MATCH</Text>
            </View>
          </View>
        </MCard>

        <TouchableOpacity onPress={() => setShowAlt(v => !v)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: M.text }}>Other options · {alts.length}</Text>
          <Ic name="chev" size={16} color={M.textMute} weight={2} />
        </TouchableOpacity>

        {showAlt && (
          <View style={{ gap: 8, marginBottom: 12 }}>
            {alts.map((alt, i) => (
              <MCard key={i} style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Avatar initials={alt.initials || alt.name?.split(' ').map(w=>w[0]).join('').slice(0,2)} gradient={alt.gradient || ['#3B82F6','#1D4ED8']} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 2 }}>{alt.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Ic name="star" size={11} color={M.amber} fill />
                      <Text style={{ fontWeight: '700', fontSize: 12 }}>{alt.rating}</Text>
                      <Text style={{ fontSize: 11, color: M.textMute }}>· {alt.distance} · {alt.availability}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: M.textMute }}>{alt.note}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: M.textMute, backgroundColor: M.surfaceLow, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }}>{alt.score}</Text>
                </View>
              </MCard>
            ))}
          </View>
        )}

        <View style={{ marginTop: 10 }}>
          <AccentBtn onPress={() => router.push({ pathname: '/loading', params: { dest: 'booking', apiData: params.apiData, query: params.query } })}>
            Confirm booking
          </AccentBtn>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}
