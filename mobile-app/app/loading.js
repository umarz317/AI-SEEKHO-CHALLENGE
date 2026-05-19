// app/loading.js — Screen 2: Running Workflow, backed by orchestration job events
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { getOrchestrationJob, startOrchestrationJob } from '../src/api';

const STATUS_META = {
  running:     { label: 'Running',     color: M.accent,  bg: M.accentBg },
  success:     { label: 'Done',        color: M.success, bg: M.successBg },
  partial:     { label: 'Partial',     color: M.amber,   bg: M.amberBg },
  needs_input: { label: 'Needs input', color: M.amber,   bg: M.amberBg },
  failed:      { label: 'Failed',      color: M.error,   bg: '#FEF2F2' },
  complete:    { label: 'Done',        color: M.success, bg: M.successBg },
};

const AGENT_DESCRIPTION = {
  'Intent Understanding':  'Parsing what you asked for',
  'Location Resolution':   'Pinning the address on the map',
  'Clarification':         'Missing some details to proceed',
  'Provider Discovery':    'Searching nearby providers',
  'Provider Ranking':      'Ranking the best matches',
  'Booking':               'Preparing booking options',
  'Follow-up':             'Drafting your reply',
  'Trace Writer':          'Saving the workflow trace',
};

const KNOWN_ICONS = new Set([
  'sparkle','pin','msg','list','star','cal','clock','flow','cpu',
  'shield','zap','wrench','bookic','user','globe','bell','check','snow',
]);

function safeIcon(name) {
  return KNOWN_ICONS.has(name) ? name : 'sparkle';
}

function formatElapsed(ms) {
  if (!ms || ms < 0) return '0.0s';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.floor(s % 60)}s`;
}

export default function LoadingScreen() {
  const router   = useRouter();
  const params   = useLocalSearchParams();
  const { dest, apiData, query, city } = params;
  const [status, setStatus] = useState(apiData ? 'complete' : 'running');
  const [traceSteps, setTraceSteps] = useState([]);
  const [error, setError] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const insets   = useSafeAreaInsets();
  const orbAnim  = useRef(new Animated.Value(0)).current;
  const breathe  = useRef(new Animated.Value(0)).current;
  const pulse    = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const stepStartRef = useRef({}); // first-seen timestamp per agent

  // ----- Animations -----
  useEffect(() => {
    Animated.loop(
      Animated.timing(orbAnim, {
        toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true,
      })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ----- Elapsed timer (only while running) -----
  useEffect(() => {
    if (status !== 'running') return;
    const startedAt = Date.now() - elapsed;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [status, attempt]);

  // ----- Job lifecycle -----
  useEffect(() => {
    let active = true;
    let pollId = null;
    let navigateId = null;

    async function run() {
      if (apiData) {
        try {
          const parsed = JSON.parse(apiData);
          setTraceSteps(parsed.trace || []);
        } catch {}
        setStatus('complete');
        navigateId = setTimeout(() => {
          if (!active) return;
          router.replace({
            pathname: `/${dest || 'understanding'}`,
            params: { apiData, query },
          });
        }, 700);
        return;
      }

      if (!query) {
        setStatus('error');
        setError('Missing request text.');
        return;
      }

      try {
        setStatus('running');
        setError(null);
        const job = await startOrchestrationJob({
          text: String(query),
          cityHint: city ? String(city) : 'Islamabad',
        });
        if (!active) return;
        setTraceSteps(job.events || []);

        const poll = async () => {
          try {
            const nextJob = await getOrchestrationJob(job.jobId);
            if (!active) return;
            setTraceSteps(nextJob.events || []);
            setStatus(nextJob.status === 'failed' ? 'error' : nextJob.status);

            if (nextJob.status === 'complete' && nextJob.result) {
              if (pollId) clearInterval(pollId);
              const serialized = JSON.stringify(nextJob.result);
              navigateId = setTimeout(() => {
                if (!active) return;
                router.replace({
                  pathname: `/${dest || 'understanding'}`,
                  params: { apiData: serialized, query },
                });
              }, 900);
            }

            if (nextJob.status === 'failed') {
              if (pollId) clearInterval(pollId);
              setError(nextJob.error?.message || 'Orchestration job failed.');
            }
          } catch (err) {
            if (!active) return;
            if (pollId) clearInterval(pollId);
            setStatus('error');
            setError(err.message || 'Could not read backend progress.');
          }
        };

        await poll();
        pollId = setInterval(poll, 450);
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setError(err.message || 'Something went wrong. Please try again.');
      }
    }

    run();
    return () => {
      active = false;
      if (pollId) clearInterval(pollId);
      if (navigateId) clearTimeout(navigateId);
    };
  }, [apiData, city, dest, query, router, attempt]);

  // ----- Timing per step (recorded on first appearance) -----
  useEffect(() => {
    const now = Date.now();
    traceSteps.forEach((event) => {
      const key = `${event.agent}::${event.tool || ''}`;
      if (!stepStartRef.current[key]) {
        stepStartRef.current[key] = now;
      }
    });
  }, [traceSteps]);

  // ----- Progress bar smoothing -----
  const hasTrace = traceSteps.length > 0;
  const completedCount = traceSteps.filter((e) => e.status !== 'running').length;
  const expectedSteps = Math.max(traceSteps.length, 8);
  const progress = status === 'complete'
    ? 1
    : status === 'error'
    ? Math.max(0.1, completedCount / expectedSteps)
    : Math.max(0.08, Math.min(completedCount / expectedSteps, 0.92));

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Auto-scroll to current step
  useEffect(() => {
    if (!scrollRef.current) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [traceSteps.length]);

  const spin = orbAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pulseScale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1], outputRange: ['0%', '100%'],
  });

  const titleText = status === 'error'
    ? 'Request failed'
    : status === 'complete'
    ? 'Workflow complete'
    : 'Running workflow';

  const subtitleText = useMemo(() => {
    if (status === 'error')   return error || 'Something went wrong.';
    if (status === 'complete') return `${traceSteps.length} steps · ${formatElapsed(elapsed)}`;
    const last = traceSteps[traceSteps.length - 1];
    if (last) return `${AGENT_DESCRIPTION[last.agent] || last.agent} · ${formatElapsed(elapsed)}`;
    return `Starting orchestration · ${formatElapsed(elapsed)}`;
  }, [status, error, traceSteps, elapsed]);

  const stepItems = useMemo(() => {
    if (!hasTrace) {
      return [{
        key: 'starting',
        agent: 'Orchestrator',
        description: 'Connecting to backend',
        detail: 'POST /api/orchestrate/jobs',
        status: status === 'error' ? 'failed' : 'running',
        icon: 'flow',
        color: M.agent,
        durationMs: elapsed,
      }];
    }
    const now = Date.now();
    return traceSteps.map((event, i) => {
      const key = `${event.agent}::${event.tool || ''}::${i}`;
      const stamp = stepStartRef.current[`${event.agent}::${event.tool || ''}`];
      const durationMs = stamp ? now - stamp : null;
      return {
        key,
        agent: event.agent,
        description: AGENT_DESCRIPTION[event.agent] || event.tool || event.source || '',
        detail: event.summary || event.output || event.source || '',
        status: event.status,
        icon: safeIcon(event.icon),
        color: event.color || M.agent,
        durationMs,
      };
    });
  }, [traceSteps, hasTrace, status, elapsed]);

  const retry = () => {
    setTraceSteps([]);
    setError(null);
    setElapsed(0);
    stepStartRef.current = {};
    setStatus('running');
    setAttempt((n) => n + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 18,
          alignItems: 'stretch',
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Orb */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{ position: 'relative', width: 112, height: 112, alignItems: 'center', justifyContent: 'center' }}>
            {/* Outer pulse halo (only while running) */}
            {status === 'running' && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 112, height: 112, borderRadius: 56,
                  backgroundColor: M.accentSoft,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                }}
              />
            )}
            {/* Spinning ring */}
            <Animated.View style={{
              width: 96, height: 96, borderRadius: 48,
              borderWidth: 3,
              borderColor: status === 'error' ? M.error : M.accent,
              borderTopColor: status === 'error' ? '#FCA5A5' : M.agent,
              borderRightColor: status === 'error' ? '#FCA5A5' : M.purple,
              transform: [{ rotate: spin }, { scale: breatheScale }],
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{
                width: 82, height: 82, borderRadius: 41,
                backgroundColor: M.surface,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
              }}>
                <Ic
                  name={status === 'complete' ? 'check' : status === 'error' ? 'bell' : 'sparkle'}
                  size={34}
                  color={status === 'error' ? M.error : M.accentDeep}
                  fill={status !== 'error'}
                />
              </View>
            </Animated.View>
          </View>
        </View>

        {/* Title + subtitle */}
        <Text style={{
          fontSize: 20, fontWeight: '700', color: M.text,
          textAlign: 'center', letterSpacing: -0.3, marginBottom: 4,
        }}>
          {titleText}
        </Text>
        <Text style={{
          fontSize: 13, color: M.textMute, textAlign: 'center', marginBottom: 18,
          paddingHorizontal: 16,
        }} numberOfLines={2}>
          {subtitleText}
        </Text>

        {/* Progress bar */}
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <View style={{
            width: '100%', maxWidth: 320, height: 6,
            backgroundColor: M.divider, borderRadius: 3, overflow: 'hidden',
          }}>
            <Animated.View style={{
              width: progressWidth, height: '100%',
              backgroundColor: status === 'error' ? M.error : M.accent,
              borderRadius: 3,
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', maxWidth: 320, marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600' }}>
              {completedCount}/{Math.max(expectedSteps, 1)} steps
            </Text>
            <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600' }}>
              {formatElapsed(elapsed)}
            </Text>
          </View>
        </View>

        {/* Step cards */}
        <View style={{ gap: 8 }}>
          {stepItems.map((item) => (
            <StepCard key={item.key} item={item} pulseOpacity={pulseOpacity} />
          ))}

          {/* Skeleton placeholder rows while waiting */}
          {!hasTrace && status === 'running' && (
            <>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </>
          )}
        </View>

        {/* Error card */}
        {error && (
          <View style={{
            marginTop: 18, backgroundColor: '#FEF2F2', borderRadius: 14,
            padding: 14, borderWidth: 1, borderColor: '#FECACA',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: M.error,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>!</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#991B1B', fontWeight: '700' }}>
                Couldn't complete the request
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#991B1B', lineHeight: 19, marginBottom: 12 }}>
              {error}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={retry}
                style={{
                  flex: 1, backgroundColor: M.error, borderRadius: 10,
                  paddingVertical: 11, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Try again</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.replace('/')}
                style={{
                  flex: 1, backgroundColor: '#fff', borderRadius: 10,
                  paddingVertical: 11, alignItems: 'center',
                  borderWidth: 1, borderColor: '#FECACA',
                }}
              >
                <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 13 }}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StepCard({ item, pulseOpacity }) {
  const meta = STATUS_META[item.status] || STATUS_META.running;
  const isRunning = item.status === 'running';
  const isFailed  = item.status === 'failed';
  const tint = isFailed ? M.error : isRunning ? item.color : M.borderHi;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 12, paddingVertical: 11, borderRadius: 14,
      backgroundColor: isRunning ? M.surface : isFailed ? '#FEF2F2' : M.surfaceLow,
      borderWidth: 1,
      borderColor: isRunning ? item.color : isFailed ? '#FECACA' : M.divider,
      shadowColor: isRunning ? item.color : 'transparent',
      shadowOpacity: isRunning ? 0.12 : 0,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
    }}>
      {/* Icon disc */}
      <View style={{ width: 34, height: 34, position: 'relative' }}>
        {isRunning && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0,
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: item.color,
              opacity: pulseOpacity,
            }}
          />
        )}
        <View style={{
          width: 34, height: 34, borderRadius: 17,
          backgroundColor: isFailed ? '#FEE2E2' : isRunning ? item.color : M.surface,
          borderWidth: isRunning ? 0 : 1,
          borderColor: M.divider,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic
            name={item.icon}
            size={16}
            color={isRunning ? '#fff' : isFailed ? M.error : item.color}
            weight={2}
          />
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Text style={{
            flex: 1, fontSize: 14, fontWeight: '700', color: M.text, letterSpacing: -0.1,
          }} numberOfLines={1}>
            {item.agent}
          </Text>
          <View style={{
            paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
            backgroundColor: meta.bg,
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color, letterSpacing: 0.2 }}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
        </View>
        {!!item.description && (
          <Text style={{ fontSize: 12, color: M.textMute, fontWeight: '500', marginBottom: 2 }} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        {!!item.detail && (
          <Text style={{ fontSize: 11.5, color: M.textDim, lineHeight: 16 }} numberOfLines={3}>
            {item.detail}
          </Text>
        )}
        {item.durationMs != null && !isRunning && (
          <Text style={{ fontSize: 10, color: M.textDim, marginTop: 4, fontWeight: '600' }}>
            {formatElapsed(item.durationMs)}
          </Text>
        )}
      </View>

      {/* Left accent rail when running */}
      {isRunning && (
        <View style={{
          position: 'absolute', left: 0, top: 10, bottom: 10, width: 3,
          backgroundColor: tint, borderTopRightRadius: 2, borderBottomRightRadius: 2,
        }} />
      )}
    </View>
  );
}

function SkeletonRow() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });
  return (
    <Animated.View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 12, paddingVertical: 12, borderRadius: 14,
      backgroundColor: M.surfaceLow, borderWidth: 1, borderColor: M.divider,
      opacity,
    }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: M.divider }} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ height: 10, width: '50%', borderRadius: 5, backgroundColor: M.divider }} />
        <View style={{ height: 8, width: '80%', borderRadius: 4, backgroundColor: M.divider }} />
      </View>
    </Animated.View>
  );
}
