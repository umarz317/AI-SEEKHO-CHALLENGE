// app/understanding.js — Screen 3: Understanding (editable, confidence-aware)
import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, LayoutAnimation, Platform, UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { AccentBtn, OutlinedBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { MDATA } from '../src/data';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function ConfidenceRing({ value, size = 56, stroke = 4, tint = M.accent }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={M.divider} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r}
        stroke={tint} strokeWidth={stroke} fill="none"
        strokeDasharray={`${circ} ${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
      />
      <SvgText
        x={size / 2} y={size / 2 + 4}
        textAnchor="middle" fontSize={size * 0.32} fontWeight="800" fill={M.text}
      >
        {value}
      </SvgText>
    </Svg>
  );
}

function confidenceTier(value) {
  if (value >= 85) return { label: 'High',   color: M.success, bg: M.successBg, tint: M.accent };
  if (value >= 60) return { label: 'Medium', color: M.amber,   bg: M.amberBg,   tint: M.amber };
  return                    { label: 'Low',    color: M.error,   bg: '#FEF2F2',   tint: M.error };
}

function isInferred(queryText, value) {
  if (!value) return true;
  if (!queryText) return false;
  const q = String(queryText).toLowerCase();
  return !q.includes(String(value).toLowerCase().split(',')[0].trim());
}

export default function UnderstandingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  let apiResult = null;
  try { apiResult = params.apiData ? JSON.parse(params.apiData) : null; } catch {}
  const queryText = params.query || MDATA.query;
  const u = apiResult?.requestUnderstanding || MDATA.understanding;
  const status = apiResult?.status || 'confirmed';
  const trace  = apiResult?.trace || [];

  const initialFields = {
    serviceType:     u.serviceType || '',
    location:        u.location || '',
    dateFull:        u.dateFull || u.dateLabel || '',
    timeWindowLabel: u.timeWindowLabel || u.timeLabel || '',
  };
  const [fields, setFields] = useState(initialFields);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');
  const [howOpen, setHowOpen] = useState(false);

  const isDirty = useMemo(
    () => Object.keys(initialFields).some((k) => (fields[k] || '') !== (initialFields[k] || '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields]
  );

  const tier = confidenceTier(u.confidence || 0);

  const rows = [
    { key: 'serviceType',     icon: 'snow',  label: 'Service',  color: '#2563EB', bg: '#EFF6FF' },
    { key: 'location',        icon: 'pin',   label: 'Location', color: M.agent,   bg: M.agentBg },
    { key: 'dateFull',        icon: 'cal',   label: 'Date',     color: M.purple,  bg: M.purpleBg },
    { key: 'timeWindowLabel', icon: 'clock', label: 'Time',     color: M.accentDark, bg: M.accentBg },
  ];

  const openEdit = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingKey(key);
    setDraft(fields[key] || '');
  };
  const saveEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFields((prev) => ({ ...prev, [editingKey]: draft.trim() }));
    setEditingKey(null);
  };
  const cancelEdit = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEditingKey(null);
    setDraft('');
  };

  const buildRerunQuery = () => {
    const parts = [];
    if (fields.serviceType)     parts.push(`Need a ${fields.serviceType}`);
    if (fields.location)        parts.push(`in ${fields.location}`);
    if (fields.dateFull)        parts.push(`on ${fields.dateFull}`);
    if (fields.timeWindowLabel) parts.push(`at ${fields.timeWindowLabel}`);
    return parts.join(' ').trim() || queryText;
  };

  const onPrimary = () => {
    if (isDirty) {
      router.replace({
        pathname: '/loading',
        params: { query: buildRerunQuery(), dest: 'understanding' },
      });
    } else {
      router.push({
        pathname: '/recommendation',
        params: { apiData: params.apiData, query: params.query },
      });
    }
  };

  // Source per agent (from trace) for the "how we parsed this" panel
  const traceSources = useMemo(() => {
    const out = {};
    for (const ev of trace) {
      if (ev.agent === 'Intent Understanding')  out.intent   = ev;
      if (ev.agent === 'Location Resolution')   out.location = ev;
    }
    return out;
  }, [trace]);

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar
        title="Your request"
        subtitle={`${u.confidence || 0}% parsed · ${tier.label.toLowerCase()} confidence`}
        onBack={() => router.back()}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero query card */}
        <View style={{
          borderRadius: 18, marginBottom: 14, overflow: 'hidden',
          backgroundColor: M.primary,
        }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{
                width: 24, height: 24, borderRadius: 8,
                backgroundColor: 'rgba(255,255,255,0.14)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic name="msg" size={13} color="#fff" weight={2} />
              </View>
              <Text style={{
                fontSize: 10.5, fontWeight: '800',
                color: 'rgba(255,255,255,0.7)',
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                You asked
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => router.replace('/')}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Ic name="wrench" size={11} color="#fff" weight={2} />
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Edit query</Text>
              </TouchableOpacity>
            </View>
            <Text style={{
              fontSize: 16, color: '#fff', lineHeight: 24, fontWeight: '600', letterSpacing: -0.2,
            }}>
              "{queryText}"
            </Text>
          </View>
        </View>

        {/* Confidence header card */}
        <MCard style={{ marginBottom: 12 }}>
          <View style={{
            padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
            borderBottomWidth: 1, borderBottomColor: M.divider,
          }}>
            <ConfidenceRing value={u.confidence || 0} tint={tier.tint} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <Text style={{
                  fontSize: 10.5, fontWeight: '800', color: M.textDim,
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>
                  Parsed by AI
                </Text>
                <View style={{
                  paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
                  backgroundColor: tier.bg,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: tier.color, letterSpacing: 0.4 }}>
                    {tier.label.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: M.text, letterSpacing: -0.2 }}>
                {u.confidence || 0}% confident
              </Text>
              <Text style={{ fontSize: 12, color: M.textMute, marginTop: 2 }}>
                {u.detectedLanguage || 'English'} · {trace.length || 0} agent step{trace.length === 1 ? '' : 's'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setHowOpen((v) => !v);
              }}
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: M.surfaceLow, borderWidth: 1, borderColor: M.divider,
                alignItems: 'center', justifyContent: 'center',
                transform: [{ rotate: howOpen ? '180deg' : '0deg' }],
              }}
            >
              <Ic name="chev" size={14} color={M.text} weight={2} />
            </TouchableOpacity>
          </View>

          {howOpen && (
            <View style={{ padding: 14, paddingTop: 12, gap: 10, backgroundColor: M.surfaceLow }}>
              <Text style={{ fontSize: 12, color: M.textMute, lineHeight: 18 }}>
                How we read this — the agents that filled each field:
              </Text>
              {traceSources.intent && (
                <TraceLine
                  label="Intent"
                  source={traceSources.intent.source}
                  text={traceSources.intent.summary || traceSources.intent.output}
                  color={traceSources.intent.color || M.purple}
                />
              )}
              {traceSources.location && (
                <TraceLine
                  label="Location"
                  source={traceSources.location.source}
                  text={traceSources.location.summary || traceSources.location.output}
                  color={traceSources.location.color || M.agent}
                />
              )}
              {!traceSources.intent && !traceSources.location && (
                <Text style={{ fontSize: 12, color: M.textDim }}>
                  No agent trace was returned for this run.
                </Text>
              )}
            </View>
          )}

          {/* Editable rows */}
          {rows.map((r, i) => {
            const value = fields[r.key];
            const edited = (value || '') !== (initialFields[r.key] || '');
            const inferred = isInferred(queryText, initialFields[r.key]);
            const isEditing = editingKey === r.key;
            const last = i === rows.length - 1;
            return (
              <View
                key={r.key}
                style={{
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderBottomWidth: last ? 0 : 1, borderBottomColor: M.divider,
                  backgroundColor: isEditing ? M.surfaceLow : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 36, height: 36, borderRadius: 11,
                    backgroundColor: r.bg, alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ic name={r.icon} size={17} color={r.color} weight={2} />
                  </View>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                      <Text style={{
                        fontSize: 10.5, color: M.textDim, fontWeight: '700',
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        {r.label}
                      </Text>
                      {edited && (
                        <View style={{
                          paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5,
                          backgroundColor: M.amberBg,
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: M.amber, letterSpacing: 0.3 }}>
                            EDITED
                          </Text>
                        </View>
                      )}
                      {!edited && inferred && value && (
                        <View style={{
                          paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5,
                          backgroundColor: M.purpleBg,
                        }}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: M.purple, letterSpacing: 0.3 }}>
                            INFERRED
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 14, fontWeight: '700',
                        color: value ? M.text : M.textDim,
                      }}
                      numberOfLines={2}
                    >
                      {value || 'Not specified — tap to add'}
                    </Text>
                  </View>

                  {!isEditing && (
                    <TouchableOpacity
                      onPress={() => openEdit(r.key)}
                      style={{
                        width: 32, height: 32, borderRadius: 10,
                        backgroundColor: M.surfaceLow, borderWidth: 1, borderColor: M.divider,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Ic name="wrench" size={13} color={M.textMute} weight={2} />
                    </TouchableOpacity>
                  )}
                </View>

                {isEditing && (
                  <View style={{ marginTop: 12, gap: 10 }}>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      autoFocus
                      placeholder={`Enter ${r.label.toLowerCase()}`}
                      placeholderTextColor={M.textDim}
                      style={{
                        backgroundColor: '#fff',
                        borderRadius: 10,
                        borderWidth: 1.5, borderColor: r.color,
                        paddingHorizontal: 12, paddingVertical: 10,
                        fontSize: 14, fontWeight: '600', color: M.text,
                      }}
                      onSubmitEditing={saveEdit}
                      returnKeyType="done"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={cancelEdit}
                        style={{
                          flex: 1, height: 38, borderRadius: 10,
                          backgroundColor: '#fff',
                          borderWidth: 1, borderColor: M.border,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: M.text }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={saveEdit}
                        style={{
                          flex: 1, height: 38, borderRadius: 10,
                          backgroundColor: M.accent,
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </MCard>

        {/* Status: clarification / no_match */}
        {status === 'needs_clarification' && (
          <View style={{
            backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: '#FDE68A', marginBottom: 14,
            flexDirection: 'row', gap: 10,
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8, backgroundColor: '#FDE68A',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic name="bell" size={14} color="#92400E" weight={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#92400E', fontWeight: '800', marginBottom: 3 }}>
                Missing details
              </Text>
              <Text style={{ fontSize: 13, color: '#B45309', lineHeight: 20 }}>
                {apiResult.clarificationPrompt}
              </Text>
            </View>
          </View>
        )}
        {status === 'no_match' && (
          <View style={{
            backgroundColor: '#FEF2F2', borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: '#FECACA', marginBottom: 14,
            flexDirection: 'row', gap: 10,
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8, backgroundColor: '#FECACA',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic name="bell" size={14} color="#991B1B" weight={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: '#991B1B', fontWeight: '800', marginBottom: 3 }}>
                No providers found
              </Text>
              <Text style={{ fontSize: 13, color: '#B91C1C', lineHeight: 20 }}>
                {apiResult.message}
              </Text>
            </View>
          </View>
        )}

        {/* What happens next preview */}
        {status !== 'needs_clarification' && status !== 'no_match' && (
          <View style={{
            backgroundColor: isDirty ? M.amberBg : M.agentBg,
            borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: isDirty ? '#FDE68A' : `${M.agent}30`,
            flexDirection: 'row', gap: 10, marginBottom: 14,
          }}>
            <View style={{
              width: 28, height: 28, borderRadius: 8,
              backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic name="sparkle" size={14} color={isDirty ? M.amber : M.agent} fill />
            </View>
            <Text style={{
              flex: 1, fontSize: 13, lineHeight: 20,
              color: isDirty ? '#92400E' : '#3730A3',
            }}>
              {isDirty ? (
                <>You've made <Text style={{ fontWeight: '800' }}>changes</Text>. We'll re-run the workflow with the updated details.</>
              ) : (
                <>Next we'll search for a <Text style={{ fontWeight: '800' }}>top-rated {fields.serviceType || 'provider'}</Text> near <Text style={{ fontWeight: '800' }}>{fields.location || 'your area'}</Text>.</>
              )}
            </Text>
          </View>
        )}

        {/* CTAs */}
        {status === 'needs_clarification' && (
          <OutlinedBtn onPress={() => router.replace('/')}>Edit query</OutlinedBtn>
        )}
        {status === 'no_match' && (
          <OutlinedBtn onPress={() => router.replace('/')}>Try another request</OutlinedBtn>
        )}
        {status !== 'needs_clarification' && status !== 'no_match' && (
          <View style={{ gap: 10 }}>
            <AccentBtn onPress={onPrimary}>
              {isDirty ? 'Re-run with changes' : 'Find providers'}
            </AccentBtn>
            <OutlinedBtn onPress={() => router.replace('/')}>Edit query</OutlinedBtn>
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  );
}

function TraceLine({ label, source, text, color }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <View style={{
        width: 6, height: 6, borderRadius: 3, marginTop: 6,
        backgroundColor: color,
      }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: M.text, letterSpacing: 0.2 }}>
          {label.toUpperCase()} {source ? `· ${source}` : ''}
        </Text>
        {!!text && (
          <Text style={{ fontSize: 12, color: M.textMute, lineHeight: 17, marginTop: 1 }}>
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}
