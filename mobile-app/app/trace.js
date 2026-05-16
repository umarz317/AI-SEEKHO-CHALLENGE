// app/trace.js — Screen 6: Agent Trace
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { MDATA } from '../src/data';

export default function TraceScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="Agent trace" subtitle="6 steps · all successful" onBack={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>

        {/* Dark header */}
        <View style={{ backgroundColor: M.primary, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Ic name="cpu" size={14} color={M.accent} weight={2} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: M.accent, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Agentic Workflow
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.2, marginBottom: 4 }}>
            6 agents · 6 tools
          </Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 18, marginBottom: 10 }}>
            How your request became a confirmed booking
          </Text>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
            flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Trace ID
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>TRC-20260517-001</Text>
          </View>
        </View>

        {/* Timeline */}
        <View>
          {MDATA.trace.map((ev, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, paddingBottom: i < MDATA.trace.length - 1 ? 14 : 0 }}>
              {/* Node + connector */}
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 10,
                  backgroundColor: ev.color, alignItems: 'center', justifyContent: 'center',
                  shadowColor: ev.color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 }}>
                  <Ic name={ev.icon} size={16} color="#fff" weight={2.2}
                    fill={ev.icon === 'sparkle' || ev.icon === 'star'} />
                </View>
                {i < MDATA.trace.length - 1 && (
                  <View style={{ width: 2, flex: 1, backgroundColor: M.divider, marginTop: 4, minHeight: 24 }} />
                )}
              </View>
              {/* Card */}
              <MCard style={{ flex: 1, marginBottom: 0, padding: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: M.text, letterSpacing: -0.1, flex: 1 }}>{ev.agent}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3,
                    backgroundColor: M.successBg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Ic name="check" size={8} color={M.success} weight={3} />
                    <Text style={{ fontSize: 9, fontWeight: '800', color: M.success, textTransform: 'uppercase', letterSpacing: 0.5 }}>OK</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 7 }}>
                  <Text style={{ fontSize: 10.5, color: M.textDim }}>
                    <Text style={{ color: M.textMute, fontWeight: '600' }}>tool </Text>{ev.tool}
                  </Text>
                  <Text style={{ color: M.borderHi }}>·</Text>
                  <Text style={{ fontSize: 10.5, color: M.textDim }}>
                    <Text style={{ color: M.textMute, fontWeight: '600' }}>via </Text>{ev.source}
                  </Text>
                </View>
                <View style={{ backgroundColor: M.surfaceLow, borderRadius: 6, padding: 8,
                  borderWidth: 1, borderColor: M.divider }}>
                  <Text style={{ fontSize: 11, color: M.textMute, lineHeight: 16 }}>{ev.output}</Text>
                </View>
              </MCard>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
}
