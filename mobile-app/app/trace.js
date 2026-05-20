// app/trace.js — Read-only Agent Trace viewer
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import TopBar from '../src/components/TopBar';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { getTrace } from '../src/api';

const STATUS_META = {
  running:     { label: 'Running',     color: M.accent,  bg: M.accentBg },
  success:     { label: 'Done',        color: M.success, bg: M.successBg },
  partial:     { label: 'Partial',     color: M.amber,   bg: M.amberBg },
  needs_input: { label: 'Needs input', color: M.amber,   bg: M.amberBg },
  failed:      { label: 'Failed',      color: M.error,   bg: '#FEF2F2' },
  complete:    { label: 'Done',        color: M.success, bg: M.successBg },
};

const KNOWN_ICONS = new Set([
  'sparkle','pin','msg','list','star','cal','clock','flow','cpu',
  'shield','zap','wrench','bookic','user','globe','bell','check','snow','edit',
]);
const safeIcon = (name) => (KNOWN_ICONS.has(name) ? name : 'sparkle');

export default function TraceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const initialEvents = useMemo(() => {
    try {
      const parsed = params.trace ? JSON.parse(params.trace) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.trace]);
  const traceId = Array.isArray(params.traceId) ? params.traceId[0] : params.traceId;
  const [events, setEvents] = useState(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    if (!traceId || initialEvents.length > 0) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrace(traceId)
      .then((trace) => {
        if (!cancelled) setEvents(Array.isArray(trace?.events) ? trace.events : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Trace not found.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [traceId, initialEvents.length]);

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar
        title="Agent trace"
        subtitle={loading ? 'Loading trace' : `${events.length} step${events.length === 1 ? '' : 's'}`}
        onBack={() => router.back()}
      />
      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {!!error && (
          <Text style={{ fontSize: 13, color: M.error, textAlign: 'center', marginTop: 24 }}>
            {error}
          </Text>
        )}
        {loading && events.length === 0 && (
          <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', marginTop: 40 }}>
            Loading trace logs...
          </Text>
        )}
        {!loading && !error && events.length === 0 && (
          <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', marginTop: 40 }}>
            No trace events were captured for this booking.
          </Text>
        )}
        {events.map((event, i) => {
          const meta = STATUS_META[event.status] || STATUS_META.success;
          const color = event.color || M.agent;
          const detail = typeof event.summary === 'string'
            ? event.summary
            : typeof event.output === 'string'
            ? event.output
            : event.source || '';
          return (
            <View key={`${event.agent}-${i}`} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 12 }}>
              <View style={{ width: 34, alignItems: 'center' }}>
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: i === 0 ? 22 : 0,
                    bottom: i === events.length - 1 ? '50%' : 0,
                    width: 2,
                    backgroundColor: color,
                    opacity: 0.5,
                  }}
                />
                <View style={{ height: 10 }} />
                <View style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: color,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic name={safeIcon(event.icon)} size={15} color="#fff" weight={2} />
                </View>
              </View>

              <MCard style={{ flex: 1, marginVertical: 4, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: M.text }} numberOfLines={1}>
                    {event.agent}
                  </Text>
                  <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: meta.bg }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color, letterSpacing: 0.2 }}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {!!event.tool && (
                  <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600', marginBottom: 4 }}>
                    {event.tool}{event.source ? ` · ${event.source}` : ''}
                  </Text>
                )}
                {!!detail && (
                  <Text style={{ fontSize: 12, color: M.textMute, lineHeight: 17 }}>
                    {detail}
                  </Text>
                )}
              </MCard>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
