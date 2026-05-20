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
  'shield','zap','wrench','bookic','user','globe','bell','check','snow','edit',
]);

function safeIcon(name) {
  return KNOWN_ICONS.has(name) ? name : 'sparkle';
}

// Human-friendly labels for raw backend identifiers.
const TOOL_LABELS = {
  parse_request:           'Parsing your request',
  resolve_location:        'Resolving location',
  request_missing_details: 'Asking for missing details',
  find_providers:          'Searching providers',
  rank_providers:          'Ranking providers',
  create_booking:          'Creating booking',
  write_trace:             'Saving trace',
  start_job:               'Starting job',
  finish_job:              'Finishing job',
  fail_job:                'Job failed',
};

const SOURCE_LABELS = {
  google_intent:        'Google Gemini',
  gemini:               'Google Gemini',
  openai:               'OpenAI',
  google_places:        'Google Places',
  google_geocoding:     'Google Geocoding',
  google_location:      'Google Maps',
  orchestrator_policy:  'Workflow rules',
  api_job_runner:       'Backend runner',
  local_booking_store:  'Booking service',
  mock:                 'Mock data',
  mock_intent:          'Mock intent',
  mock_location:        'Mock location',
  mock_provider:        'Mock providers',
};

function humanize(raw) {
  if (raw == null) return '';
  const s = String(raw).trim();
  if (!s) return '';
  return s
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelTool(tool) {
  if (!tool) return '';
  return TOOL_LABELS[tool] || humanize(tool);
}

function labelSource(source) {
  if (!source) return '';
  return SOURCE_LABELS[source] || humanize(source);
}

function formatElapsed(ms) {
  if (!ms || ms < 0) return '0.0s';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.floor(s % 60)}s`;
}

// Pull a couple of human-friendly "extracted value" chips out of an agent event.
// Looks at common fields the backend exposes (output, summary, source).
function extractChips(event) {
  const chips = [];
  const out = event?.output || event?.outputs || event?.data;
  if (out && typeof out === 'object') {
    const candidates = [
      ['Service',    out.serviceType || out.normalizedServiceType || out.category],
      ['Location',   out.formattedLocation || out.locationText || out.city],
      ['When',       out.dateText || out.resolvedDate || out.timeText || out.slotLabel],
      ['Lang',       out.detectedLanguage],
      ['Providers',  Array.isArray(out.providers) ? `${out.providers.length} nearby` : null],
      ['Top',        out.rankedProviders?.[0]?.name],
      ['Score',      out.rankedProviders?.[0]?.score != null
        ? `${Math.round(Number(out.rankedProviders[0].score) * 100)}%`
        : null],
      ['Booking',    out.bookingId],
    ];
    for (const [label, value] of candidates) {
      if (value != null && value !== '') chips.push({ label, value: String(value) });
      if (chips.length >= 3) break;
    }
  }
  if (!chips.length && event?.source) chips.push({ label: 'Via', value: labelSource(event.source) });
  return chips;
}

function ThinkingDots({ color }) {
  const a1 = useRef(new Animated.Value(0)).current;
  const a2 = useRef(new Animated.Value(0)).current;
  const a3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const seq = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(550 - delay),
      ]),
    );
    seq(a1, 0).start();
    seq(a2, 140).start();
    seq(a3, 280).start();
  }, []);
  const dot = (val) => ({
    width: 4, height: 4, borderRadius: 2, backgroundColor: color,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }],
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 4 }}>
      <Animated.View style={dot(a1)} />
      <Animated.View style={dot(a2)} />
      <Animated.View style={dot(a3)} />
    </View>
  );
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
  const startedRef = useRef(null); // guards against double-starting the backend job
  const routerRef = useRef(router);
  routerRef.current = router;
  const destRef = useRef(dest);
  destRef.current = dest;

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
    // Guard against duplicate starts: same (apiData|query, attempt) must only run once.
    // React strict-mode double-mounts and any extra re-renders would otherwise fire a
    // second backend job and insert a duplicate booking.
    const runKey = `${apiData ? `api:${apiData.length}` : `q:${query}`}::${attempt}`;
    if (startedRef.current === runKey) return;
    startedRef.current = runKey;

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
          routerRef.current.replace({
            pathname: `/${destRef.current || 'understanding'}`,
            params: { apiData, query },
          });
        }, 1600);
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
                routerRef.current.replace({
                  pathname: `/${destRef.current || 'understanding'}`,
                  params: { apiData: serialized, query },
                });
              }, 1800);
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
  }, [apiData, city, query, attempt]);

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
      const detailText = typeof event.summary === 'string' && event.summary
        ? event.summary
        : typeof event.output === 'string' && event.output
        ? event.output
        : labelSource(event.source);
      return {
        key,
        agent: event.agent,
        description: AGENT_DESCRIPTION[event.agent] || labelTool(event.tool) || labelSource(event.source),
        detail: detailText,
        chips: extractChips(event),
        status: event.status,
        icon: safeIcon(event.icon),
        color: event.color || M.agent,
        durationMs,
        index: i,
        isLast: i === traceSteps.length - 1,
      };
    });
  }, [traceSteps, hasTrace, status, elapsed]);

  const retry = () => {
    setTraceSteps([]);
    setError(null);
    setElapsed(0);
    stepStartRef.current = {};
    startedRef.current = null;
    setStatus('running');
    setAttempt((n) => n + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      {/* Sticky header: orb + title + progress (stays put while list scrolls) */}
      <View style={{
        paddingTop: insets.top + 14,
        paddingHorizontal: 18,
        paddingBottom: 12,
        backgroundColor: M.bg,
        borderBottomWidth: 1,
        borderBottomColor: M.divider,
        zIndex: 2,
      }}>
        {/* Compact header row: orb on the left, title/subtitle on the right */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          {/* Orb (smaller, inline) */}
          <View style={{ position: 'relative', width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            {status === 'running' && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: M.accentSoft,
                  opacity: pulseOpacity,
                  transform: [{ scale: pulseScale }],
                }}
              />
            )}
            <Animated.View style={{
              width: 56, height: 56, borderRadius: 28,
              borderWidth: 2.5,
              borderColor: status === 'error' ? M.error : M.accent,
              borderTopColor: status === 'error' ? '#FCA5A5' : M.agent,
              borderRightColor: status === 'error' ? '#FCA5A5' : M.purple,
              transform: [{ rotate: spin }, { scale: breatheScale }],
              alignItems: 'center', justifyContent: 'center',
            }}>
              <View style={{
                width: 46, height: 46, borderRadius: 23,
                backgroundColor: M.surface,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
              }}>
                <Ic
                  name={status === 'complete' ? 'check' : status === 'error' ? 'bell' : 'sparkle'}
                  size={22}
                  color={status === 'error' ? M.error : status === 'complete' ? M.success : M.accentDeep}
                  // Only the sparkle (running) is fill-friendly. The Lucide
                  // check and bell are stroke-only paths and look broken
                  // (paper-plane shape) when filled.
                  fill={status !== 'error' && status !== 'complete'}
                  weight={status === 'complete' ? 3 : 1.75}
                />
              </View>
            </Animated.View>
          </View>

          {/* Title + subtitle stacked next to the orb */}
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 18, fontWeight: '700', color: M.text,
              letterSpacing: -0.3, marginBottom: 2,
            }} numberOfLines={1}>
              {titleText}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{ fontSize: 12.5, color: M.textMute, flex: 1 }}
                numberOfLines={2}
              >
                {subtitleText}
              </Text>
              {status === 'running' && <ThinkingDots color={M.accent} />}
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ alignItems: 'center' }}>
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
      </View>

      {/* Scrollable step list */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: 18,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step cards */}
        <View style={{ gap: 0 }}>
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
  const isDone    = !isRunning && !isFailed;

  const lineColor = isDone || isFailed ? item.color : M.divider;
  const lineOpacity = isDone || isFailed ? 0.6 : 1;

  // Entrance animation — fades + slides up on first mount.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  const enterOpacity = enter;
  const enterTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  const stepNumber = (item.index ?? 0) + 1;
  const cardBg = isRunning
    ? `${item.color}0D`           // 5% tinted bg on running
    : isFailed
    ? '#FEF2F2'
    : isDone
    ? M.surface
    : M.surface;

  return (
    <Animated.View
      style={{
        marginBottom: 10,
        borderRadius: 16,
        backgroundColor: cardBg,
        borderWidth: 1,
        borderColor: isRunning ? item.color : isFailed ? '#FECACA' : M.divider,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: isRunning ? item.color : 'transparent',
        shadowOpacity: isRunning ? 0.18 : 0,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
        opacity: enterOpacity,
        transform: [{ translateY: enterTranslate }],
      }}
    >
      {/* Header row: icon + step number + agent + duration + status pill */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: !!item.description || !!item.detail ? 8 : 0 }}>
        {/* Icon disc with optional running pulse */}
        <View style={{ width: 36, height: 36, position: 'relative' }}>
          {isRunning && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: item.color,
                opacity: pulseOpacity,
              }}
            />
          )}
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: isFailed ? '#FEE2E2' : isRunning ? item.color : isDone ? item.color : M.surfaceLow,
            borderWidth: isRunning || isDone || isFailed ? 0 : 1.5,
            borderColor: M.divider,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ic
              name={isDone ? 'check' : item.icon}
              size={isDone ? 16 : 18}
              color={isRunning || isDone ? '#fff' : isFailed ? M.error : item.color}
              weight={isDone ? 3 : 2}
            />
          </View>
        </View>

        {/* Agent name + step number */}
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 10, fontWeight: '700', color: M.textDim,
            letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 1,
          }}>
            Step {String(stepNumber).padStart(2, '0')}
          </Text>
          <Text style={{
            fontSize: 15, fontWeight: '700', color: M.text, letterSpacing: -0.2,
          }} numberOfLines={1}>
            {item.agent}
          </Text>
        </View>

        {/* Duration + status pill */}
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
            backgroundColor: meta.bg,
            flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            {isRunning && (
              <View style={{
                width: 5, height: 5, borderRadius: 2.5, backgroundColor: meta.color,
              }} />
            )}
            <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color, letterSpacing: 0.2 }}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
          {item.durationMs != null && !isRunning && (
            <Text style={{ fontSize: 10.5, color: M.textDim, fontWeight: '600' }}>
              {formatElapsed(item.durationMs)}
            </Text>
          )}
        </View>
      </View>

      {/* Description + detail */}
      {!!item.description && (
        <Text style={{ fontSize: 12.5, color: M.text, fontWeight: '600', marginBottom: !!item.detail ? 2 : 0 }} numberOfLines={1}>
          {item.description}
        </Text>
      )}
      {!!item.detail && (
        <Text style={{ fontSize: 11.5, color: M.textMute, lineHeight: 16 }} numberOfLines={3}>
          {item.detail}
        </Text>
      )}

        {/* Extracted-data chips */}
        {!!item.chips?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
            {item.chips.map((c, i) => (
              <View
                key={`${c.label}-${i}`}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: M.surfaceLow,
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 6,
                  borderWidth: 1, borderColor: M.divider,
                }}
              >
                <Text style={{
                  fontSize: 9.5, fontWeight: '800', color: M.textDim,
                  letterSpacing: 0.6, textTransform: 'uppercase',
                }}>
                  {c.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontSize: 11, fontWeight: '700', color: M.text, maxWidth: 140 }}
                >
                  {c.value}
                </Text>
              </View>
            ))}
          </View>
        )}
    </Animated.View>
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
