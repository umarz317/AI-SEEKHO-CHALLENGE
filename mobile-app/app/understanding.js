// app/understanding.js — Screen 3: Understanding
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { AccentBtn, OutlinedBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';

function ConfidenceRing({ value }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Circle cx={22} cy={22} r={r} stroke={M.divider} strokeWidth={3} fill="none" />
      <Circle cx={22} cy={22} r={r} stroke={M.accent} strokeWidth={3} fill="none"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" rotation="-90" origin="22, 22" />
      <SvgText x={22} y={27} textAnchor="middle" fontSize={11} fontWeight="800" fill={M.text}>{value}</SvgText>
    </Svg>
  );
}

export default function UnderstandingScreen() {
  const router = useRouter();
  const u = MDATA.understanding;
  const rows = [
    { icon: 'snow',  label: 'Service',  value: u.serviceType,      color: '#2563EB', bg: '#EFF6FF' },
    { icon: 'pin',   label: 'Location', value: u.location,         color: M.text,    bg: M.surfaceVar },
    { icon: 'cal',   label: 'Date',     value: u.dateFull,         color: M.text,    bg: M.surfaceVar },
    { icon: 'clock', label: 'Time',     value: u.timeWindowLabel,  color: M.text,    bg: M.surfaceVar },
    { icon: 'globe', label: 'Language', value: u.detectedLanguage, color: M.text,    bg: M.surfaceVar },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Your request" subtitle="AI understood this" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
        <View style={{ backgroundColor: M.surfaceLow, borderRadius: 12, padding: 14, marginBottom: 14,
          flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: M.divider }}>
          <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: M.purpleBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ic name="msg" size={13} color={M.purple} weight={2} />
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: M.textMute, fontStyle: 'italic', lineHeight: 20 }}>"{MDATA.query}"</Text>
        </View>
        <MCard style={{ marginBottom: 12 }}>
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: M.divider,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 10.5, fontWeight: '700', color: M.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>Parsed by AI</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: M.text, marginTop: 2 }}>{u.confidence}% confident</Text>
            </View>
            <ConfidenceRing value={u.confidence} />
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12,
              padding: 12, paddingHorizontal: 16,
              borderBottomWidth: i < rows.length - 1 ? 1 : 0, borderBottomColor: M.divider }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center' }}>
                <Ic name={r.icon} size={16} color={r.color} weight={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{r.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: M.text, marginTop: 1 }}>{r.value}</Text>
              </View>
            </View>
          ))}
        </MCard>
        <View style={{ backgroundColor: M.agentBg, borderRadius: 14, padding: 14,
          borderWidth: 1, borderColor: `${M.agent}30`, flexDirection: 'row', gap: 10, marginBottom: 18 }}>
          <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Ic name="sparkle" size={14} color={M.agent} fill />
          </View>
          <Text style={{ flex: 1, fontSize: 13, color: '#3730A3', lineHeight: 20 }}>
            Searching for a <Text style={{ fontWeight: '700' }}>high-rated AC technician</Text> near <Text style={{ fontWeight: '700' }}>G-13</Text> available <Text style={{ fontWeight: '700' }}>tomorrow morning</Text>.
          </Text>
        </View>
        <View style={{ gap: 10 }}>
          <AccentBtn onPress={() => router.push({ pathname: '/loading', params: { dest: 'recommendation' } })}>Find providers</AccentBtn>
          <OutlinedBtn onPress={() => router.back()}>Edit details</OutlinedBtn>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}
