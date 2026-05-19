// app/recommendation.js — Screen 4: Best match (upgraded)
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Linking, View, Text, ScrollView, TouchableOpacity, Share, Animated, Easing,
  LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Avatar from '../src/components/Avatar';
import Pill from '../src/components/Pill';
import Ic from '../src/components/Ic';
import { AccentBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';
import { confirmBooking } from '../src/api';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SORTS = [
  { key: 'score',    label: 'Best match', icon: 'sparkle' },
  { key: 'rating',   label: 'Rating',     icon: 'star' },
  { key: 'distance', label: 'Nearest',    icon: 'pin' },
  { key: 'soonest',  label: 'Soonest',    icon: 'clock' },
];

function parseDistanceKm(s) {
  if (!s) return Infinity;
  const m = String(s).match(/([\d.]+)\s*(km|mi|m)\b/i);
  if (!m) return Infinity;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === 'mi') return n * 1.609;
  if (unit === 'm') return n / 1000;
  return n;
}
function parseSoonestMin(s) {
  if (!s) return Infinity;
  const t = String(s).toLowerCase();
  if (t.includes('now')) return 0;
  if (t.includes('today')) return 60;
  if (t.includes('tonight')) return 240;
  if (t.includes('tomorrow')) return 24 * 60;
  const m = t.match(/(\d+)\s*(min|hr|hour|day)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (m[2].startsWith('min')) return n;
    if (m[2].startsWith('hr') || m[2].startsWith('hour')) return n * 60;
    if (m[2].startsWith('day')) return n * 24 * 60;
  }
  return Infinity;
}

function toPct(value) {
  const n = Number(value) || 0;
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function ScoreArc({ value, size = 120, stroke = 10, gradient }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = toPct(value);
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setShown(Math.round(pct * v)));
    return () => anim.removeListener(id);
  }, [pct]);

  const offset = circ - (shown / 100) * circ;
  const [g1, g2] = gradient || [M.accent, M.accentDeep];

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={g1} />
            <Stop offset="1" stopColor={g2} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={M.divider} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#scoreGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
          strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: '800', color: M.text, letterSpacing: -1 }}>
          {shown}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '800', color: M.textDim, letterSpacing: 1, marginTop: -2 }}>
          MATCH
        </Text>
      </View>
    </View>
  );
}

function BreakdownBar({ label, value, color, hint }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.max(0, Math.min(100, value)),
      duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: M.text }}>{label}</Text>
        <Text style={{ fontSize: 11, fontWeight: '700', color: M.textMute }}>{hint}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: M.divider, borderRadius: 3, overflow: 'hidden' }}>
        <Animated.View style={{ width, height: '100%', backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

export default function RecommendationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  let apiResult = null;
  try { apiResult = params.apiData ? JSON.parse(params.apiData) : null; } catch {}

  const aiPick = apiResult?.recommendation || MDATA.provider;
  const alts   = apiResult?.alternatives  || MDATA.alternatives || [];

  const [primary, setPrimary] = useState(aiPick);
  const [showAlt, setShowAlt] = useState(false);
  const [sortBy, setSortBy]   = useState('score');
  const [saved, setSaved]     = useState(false);
  const [confirming, setConfirming] = useState(false);

  const bookingId = apiResult?.booking?.bookingId;

  const onConfirmBooking = async () => {
    if (confirming) return;
    setConfirming(true);
    let updatedBooking = apiResult?.booking || null;
    try {
      if (bookingId) {
        updatedBooking = await confirmBooking(bookingId);
      }
    } catch (err) {
      console.warn('[confirm]', err.message);
    } finally {
      setConfirming(false);
    }
    const nextApiData = apiResult
      ? JSON.stringify({ ...apiResult, booking: updatedBooking || apiResult.booking })
      : params.apiData;
    router.push({
      pathname: '/booking',
      params: {
        apiData: nextApiData,
        query: params.query,
        providerId: primary.providerId || '',
      },
    });
  };

  const isAiPick = (primary?.providerId || primary?.name) === (aiPick?.providerId || aiPick?.name);
  const totalProviders = (alts?.length || 0) + 1;

  const name = primary.providerName || primary.name;
  const initials = primary.initials || name?.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const gradient = primary.gradient || ['#10B981', '#047857'];

  const openMaps = (url) => { if (url) Linking.openURL(url); };

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out ${name} — ${primary.rating}★ · ${primary.distance || ''} · ${primary.availability || ''}`.trim(),
      });
    } catch {}
  };

  // Sub-score derivation (visualizes ranking transparency)
  const breakdown = useMemo(() => {
    const ratingPct = Math.min(100, ((primary.rating || 0) / 5) * 100);
    const km = parseDistanceKm(primary.distance);
    const distPct = km === Infinity ? 50 : Math.max(15, 100 - Math.min(100, km * 10));
    const respMin = primary.responseMin ?? parseSoonestMin(primary.availability);
    const respPct = respMin === Infinity ? 50 : Math.max(15, 100 - Math.min(100, respMin / 3));
    const exp = (primary.completedJobs || 0) / 5 + (primary.yearsActive || 0) * 6;
    const expPct = Math.max(15, Math.min(100, exp));
    return [
      { label: 'Rating',       value: ratingPct, color: M.amber,      hint: `${primary.rating || '—'}/5` },
      { label: 'Distance',     value: distPct,   color: M.agent,      hint: primary.distance || '—' },
      { label: 'Availability', value: respPct,   color: M.accent,     hint: primary.availability || '—' },
      { label: 'Experience',   value: expPct,    color: M.purple,     hint: `${primary.yearsActive || 0} yrs · ${primary.completedJobs || 0}+ jobs` },
    ];
  }, [primary]);

  // Sort alternatives + include the AI pick if user switched primary
  const visibleAlts = useMemo(() => {
    const pool = [...alts];
    if (!isAiPick) pool.unshift({ ...aiPick, name: aiPick.providerName || aiPick.name, isAiPick: true });
    pool.sort((a, b) => {
      switch (sortBy) {
        case 'rating':   return (b.rating || 0) - (a.rating || 0);
        case 'distance': return parseDistanceKm(a.distance) - parseDistanceKm(b.distance);
        case 'soonest':  return parseSoonestMin(a.availability) - parseSoonestMin(b.availability);
        case 'score':
        default:         return toPct(b.score) - toPct(a.score);
      }
    });
    return pool.filter((a) => (a.providerId || a.name) !== (primary.providerId || primary.name));
  }, [alts, sortBy, primary, isAiPick, aiPick]);

  const primaryScorePct = toPct(primary.score);
  const avgAltScore = useMemo(() => {
    if (!alts.length) return 0;
    return Math.round(alts.reduce((s, a) => s + toPct(a.score), 0) / alts.length);
  }, [alts]);
  const scoreGap = Math.max(0, primaryScorePct - avgAltScore);

  const swapPrimary = (alt) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPrimary(alt);
  };
  const restoreAiPick = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPrimary(aiPick);
  };

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar
        title="Best match"
        subtitle={isAiPick ? `Top of ${totalProviders} providers` : `You picked · ${totalProviders} options`}
        onBack={() => router.back()}
        action={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 4 }}>
            <TouchableOpacity
              onPress={() => setSaved((v) => !v)}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ic name="heart" size={20} color={saved ? M.error : M.text} fill={saved} weight={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onShare}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ic name="share" size={18} color={M.text} weight={2} />
            </TouchableOpacity>
          </View>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 16 }}
      >
        {/* ---- Hero ---- */}
        <MCard style={{ marginBottom: 12, overflow: 'hidden' }}>
          {/* Gradient backdrop */}
          <View style={{ position: 'relative', paddingTop: 18, paddingBottom: 14, paddingHorizontal: 16 }}>
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 92,
              backgroundColor: gradient[0], opacity: 0.12,
            }} />
            <View style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 92,
              backgroundColor: gradient[1], opacity: 0.06,
            }} />

            {/* Top row: AI badge / Restore */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              {isAiPick ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: M.accentSoft, borderRadius: 8,
                  paddingHorizontal: 9, paddingVertical: 4,
                }}>
                  <Ic name="sparkle" size={11} color={M.accentDeep} fill />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: M.accentDeep, letterSpacing: 0.6 }}>
                    AI PICK
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={restoreAiPick}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: M.amberBg, borderRadius: 8,
                    paddingHorizontal: 9, paddingVertical: 4,
                  }}
                >
                  <Ic name="back" size={11} color={M.amber} weight={2} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: M.amber, letterSpacing: 0.6 }}>
                    RESTORE AI PICK
                  </Text>
                </TouchableOpacity>
              )}
              {primary.verified && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: M.divider,
                  paddingHorizontal: 8, paddingVertical: 3,
                }}>
                  <Ic name="shield" size={11} color={M.accent} fill />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: M.accentDeep, letterSpacing: 0.4 }}>VERIFIED</Text>
                </View>
              )}
            </View>

            {/* Identity + score */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              <Avatar initials={initials} gradient={gradient} size={64} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 19, fontWeight: '800', color: M.text, letterSpacing: -0.3 }}
                >
                  {name}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Ic name="star" size={13} color={M.amber} fill />
                  <Text style={{ fontWeight: '800', fontSize: 14, color: M.text }}>{primary.rating || '—'}</Text>
                  <Text style={{ fontSize: 12, color: M.textMute }}>
                    · {primary.reviews || 0} reviews{primary.yearsActive ? ` · ${primary.yearsActive} yrs` : ''}
                  </Text>
                </View>
              </View>
              <ScoreArc value={primary.score || 0} size={92} stroke={8} gradient={gradient} />
            </View>

            {/* Comparison line */}
            {alts.length > 0 && scoreGap > 0 && isAiPick && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: M.surfaceLow, borderRadius: 8,
                paddingHorizontal: 10, paddingVertical: 6, marginTop: 6,
                borderWidth: 1, borderColor: M.divider,
              }}>
                <Ic name="zap" size={12} color={M.accentDeep} fill />
                <Text style={{ fontSize: 11.5, color: M.textMute, flex: 1 }}>
                  Beats other matches by{' '}
                  <Text style={{ fontWeight: '800', color: M.accentDeep }}>+{scoreGap} pts</Text>
                  {' '}(avg {avgAltScore})
                </Text>
              </View>
            )}
          </View>

          {/* Stats strip */}
          <View style={{
            flexDirection: 'row', backgroundColor: M.surfaceLow,
            borderTopWidth: 1, borderBottomWidth: 1, borderColor: M.divider,
          }}>
            {[
              { icon: 'pin',   label: 'Distance',  value: primary.distance     || '—' },
              { icon: 'clock', label: 'Available', value: primary.availability || '—' },
              { icon: 'flow',  label: 'Jobs',      value: primary.completedJobs ? `${primary.completedJobs}+` : '—' },
              { icon: 'zap',   label: 'Response',  value: primary.responseMin ? `${primary.responseMin}m` : '—' },
            ].map((s, i, arr) => (
              <View
                key={i}
                style={{
                  flex: 1, paddingVertical: 11, alignItems: 'center',
                  borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: M.divider,
                }}
              >
                <Ic name={s.icon} size={14} color={M.textDim} weight={2} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: M.text, marginTop: 3 }} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={{ fontSize: 10, color: M.textMute, marginTop: 1 }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Quick actions */}
          <View style={{
            flexDirection: 'row', gap: 8, padding: 12,
            borderBottomWidth: 1, borderBottomColor: M.divider,
          }}>
            {primary.googleMapsUri && (
              <QuickAction icon="pin" label="Maps" onPress={() => openMaps(primary.googleMapsUri)} />
            )}
            <QuickAction icon="phone" label="Call"
              onPress={() => Linking.openURL('tel:+92').catch(() => {})} />
            <QuickAction icon="msg" label="Message"
              onPress={() => Linking.openURL('sms:+92').catch(() => {})} />
            <QuickAction
              icon="heart"
              label={saved ? 'Saved' : 'Save'}
              active={saved}
              onPress={() => setSaved((v) => !v)}
            />
          </View>

          {/* Description */}
          {!!primary.description && (
            <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: M.divider }}>
              <Text style={{
                fontSize: 10, fontWeight: '800', color: M.textDim,
                textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
              }}>
                About
              </Text>
              <Text style={{ fontSize: 13, color: M.textMute, lineHeight: 20 }}>
                {primary.description}
              </Text>
            </View>
          )}

          {/* Score breakdown */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: M.divider }}>
            <Text style={{
              fontSize: 10, fontWeight: '800', color: M.textDim,
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
            }}>
              How we scored this match
            </Text>
            {breakdown.map((b) => (
              <BreakdownBar key={b.label} {...b} />
            ))}
          </View>

          {/* Reasons */}
          {!!(primary.reasons && primary.reasons.length) && (
            <View style={{ padding: 14 }}>
              <Text style={{
                fontSize: 10, fontWeight: '800', color: M.textDim,
                textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
              }}>
                Why this provider
              </Text>
              <View style={{ gap: 6 }}>
                {primary.reasons.map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 9, marginTop: 1,
                      backgroundColor: M.accentSoft,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ic name="check" size={10} color={M.accentDeep} weight={3} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: M.text, lineHeight: 19 }}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </MCard>

        {/* ---- Alternatives header ---- */}
        <TouchableOpacity
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowAlt((v) => !v);
          }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingVertical: 10, paddingHorizontal: 4, marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: M.text }}>
            Other options · {visibleAlts.length}
          </Text>
          <View style={{ transform: [{ rotate: showAlt ? '180deg' : '0deg' }] }}>
            <Ic name="chev" size={16} color={M.textMute} weight={2} />
          </View>
        </TouchableOpacity>

        {showAlt && (
          <>
            {/* Sort chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4, paddingHorizontal: 4 }}
              style={{ marginBottom: 8 }}
            >
              {SORTS.map((s) => {
                const active = sortBy === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setSortBy(s.key)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18,
                      backgroundColor: active ? M.text : M.surface,
                      borderWidth: 1, borderColor: active ? M.text : M.border,
                    }}
                  >
                    <Ic name={s.icon} size={11} color={active ? '#fff' : M.textMute} weight={2} fill={active && s.icon === 'star'} />
                    <Text style={{
                      fontSize: 11.5, fontWeight: '700',
                      color: active ? '#fff' : M.textMute,
                    }}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Alt cards */}
            <View style={{ gap: 8, marginBottom: 12 }}>
              {visibleAlts.map((alt, i) => {
                const altName = alt.providerName || alt.name;
                const altInitials = alt.initials || altName?.split(' ').map((w) => w[0]).join('').slice(0, 2);
                const altGradient = alt.gradient || ['#3B82F6', '#1D4ED8'];
                return (
                  <MCard key={alt.providerId || altName || i} style={{ padding: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Avatar initials={altInitials} gradient={altGradient} size={44} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: M.text, flexShrink: 1 }} numberOfLines={1}>
                            {altName}
                          </Text>
                          {alt.isAiPick && (
                            <View style={{
                              backgroundColor: M.accentSoft, borderRadius: 5,
                              paddingHorizontal: 5, paddingVertical: 1,
                            }}>
                              <Text style={{ fontSize: 8.5, fontWeight: '800', color: M.accentDeep, letterSpacing: 0.4 }}>
                                AI PICK
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <Ic name="star" size={11} color={M.amber} fill />
                          <Text style={{ fontWeight: '800', fontSize: 12, color: M.text }}>{alt.rating || '—'}</Text>
                          <Text style={{ fontSize: 11, color: M.textMute }} numberOfLines={1}>
                            · {alt.distance || '—'} · {alt.availability || '—'}
                          </Text>
                        </View>
                        {!!alt.note && (
                          <Text style={{ fontSize: 11, color: M.textMute }} numberOfLines={2}>
                            {alt.note}
                          </Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'center', gap: 4 }}>
                        <View style={{
                          backgroundColor: M.surfaceLow, borderRadius: 8,
                          paddingHorizontal: 9, paddingVertical: 4,
                          borderWidth: 1, borderColor: M.divider,
                        }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: M.text }}>{alt.score != null ? toPct(alt.score) : '—'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        onPress={() => swapPrimary(alt)}
                        style={{
                          flex: 1, height: 36, borderRadius: 9,
                          backgroundColor: M.text,
                          alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'row', gap: 5,
                        }}
                      >
                        <Ic name="arrow" size={12} color="#fff" weight={2.2} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Pick instead</Text>
                      </TouchableOpacity>
                      {alt.googleMapsUri && (
                        <TouchableOpacity
                          onPress={() => openMaps(alt.googleMapsUri)}
                          style={{
                            height: 36, borderRadius: 9,
                            paddingHorizontal: 12,
                            borderWidth: 1, borderColor: M.border,
                            backgroundColor: '#fff',
                            alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'row', gap: 5,
                          }}
                        >
                          <Ic name="pin" size={12} color={M.accentDeep} weight={2.4} />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: M.accentDeep }}>Map</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </MCard>
                );
              })}
              {!visibleAlts.length && (
                <Text style={{ fontSize: 12, color: M.textMute, textAlign: 'center', paddingVertical: 14 }}>
                  No alternative providers returned.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky CTA above the BottomNav */}
      <View style={{
        paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
        backgroundColor: M.bg,
        borderTopWidth: 1, borderTopColor: M.divider,
      }}>
        <AccentBtn onPress={onConfirmBooking} disabled={confirming}>
          {confirming
            ? 'Sending to provider…'
            : isAiPick ? 'Confirm booking' : `Book ${name?.split(' ')[0] || 'this provider'}`}
        </AccentBtn>
      </View>
      <BottomNav />
    </View>
  );
}

function QuickAction({ icon, label, onPress, active }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1, height: 44, borderRadius: 11,
        backgroundColor: active ? M.accentSoft : M.surfaceLow,
        borderWidth: 1, borderColor: active ? M.accent : M.divider,
        alignItems: 'center', justifyContent: 'center', gap: 3,
        flexDirection: 'row',
      }}
    >
      <Ic
        name={icon}
        size={14}
        color={active ? M.accentDeep : M.text}
        weight={2}
        fill={active && icon === 'heart'}
      />
      <Text style={{ fontSize: 12, fontWeight: '700', color: active ? M.accentDeep : M.text }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
