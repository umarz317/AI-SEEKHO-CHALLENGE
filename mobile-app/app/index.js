// app/index.js — Screen 1: Home (integrated with backend)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { AccentBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { CATEGORIES, EXAMPLES } from '../src/data';
import { checkHealth } from '../src/api';

const SPEECH_LANGUAGES = [
  { key: 'english', label: 'English', locale: 'en-US' },
  { key: 'urdu', label: 'Urdu', locale: 'ur-PK' },
  { key: 'roman_urdu', label: 'Roman Urdu', locale: 'en-US' },
];

function appendSpeechText(base, transcript) {
  const cleanBase = String(base || '').trim();
  const cleanTranscript = String(transcript || '').trim();
  if (!cleanTranscript) return cleanBase;
  return cleanBase ? `${cleanBase} ${cleanTranscript}` : cleanTranscript;
}

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [city, setCity]         = useState('Islamabad');
  const [focus, setFocus]       = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [online, setOnline]     = useState(null);
  const [speechLanguage, setSpeechLanguage] = useState(SPEECH_LANGUAGES[0]);
  const [recognizing, setRecognizing] = useState(false);
  const [stoppingSpeech, setStoppingSpeech] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState('');
  const speechBaseRef = useRef('');

  const displayedQuery = interimSpeech ? appendSpeechText(speechBaseRef.current, interimSpeech) : query;
  const isUrdu      = /[\u0600-\u06FF]/.test(displayedQuery) || speechLanguage.key === 'urdu';
  const isRomanUrdu = !isUrdu && /mujhe|chahiye|subah|mein|kal|aaj/i.test(displayedQuery);
  const langLabel   = isUrdu ? 'Urdu' : isRomanUrdu ? 'Roman Urdu' : displayedQuery.length > 3 ? 'English' : null;
  const speechStatus = stoppingSpeech
    ? 'Stopping...'
    : recognizing
      ? `Listening in ${speechLanguage.label}...`
      : null;

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(ok => setOnline(ok));
  }, []);

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {}
    };
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setRecognizing(true);
    setStoppingSpeech(false);
    setError(null);
  });

  useSpeechRecognitionEvent('end', () => {
    setRecognizing(false);
    setStoppingSpeech(false);
    setInterimSpeech('');
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript || '';
    if (!transcript) return;
    if (event.isFinal) {
      setQuery(appendSpeechText(speechBaseRef.current, transcript));
      setInterimSpeech('');
      return;
    }
    setInterimSpeech(transcript);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setRecognizing(false);
    setStoppingSpeech(false);
    setInterimSpeech('');
    const code = event.error ? ` (${event.error})` : '';
    setError(event.message || `Speech recognition failed${code}.`);
  });

  const handleSpeechPress = async () => {
    if (recognizing) {
      setStoppingSpeech(true);
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (err) {
        setStoppingSpeech(false);
        setRecognizing(false);
        setError(err.message || 'Could not stop listening.');
      }
      return;
    }

    setError(null);
    setInterimSpeech('');
    speechBaseRef.current = query.trim();

    try {
      if (
        typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
        !ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ) {
        setError('Speech recognition is not available on this device.');
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone and speech recognition permission are required to dictate a service request.');
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: speechLanguage.locale,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        contextualStrings: [
          'plumber',
          'electrician',
          'AC technician',
          'cleaner',
          'carpenter',
          'beautician',
          'tutor',
          'Islamabad',
          'Rawalpindi',
          'F-10',
          'G-13',
        ],
      });
    } catch (err) {
      setRecognizing(false);
      setStoppingSpeech(false);
      setError(err.message || 'Speech recognition could not start. Rebuild the dev client after installing the native speech module.');
    }
  };

  const handleSubmit = async () => {
    const requestText = displayedQuery.trim();
    if (!requestText) return;
    setLoading(true);
    setError(null);

    try {
      router.push({
        pathname: '/loading',
        params: {
          dest: 'understanding',
          query: requestText,
          city,
        },
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const topAction = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {online !== null && (
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: online ? M.success : M.error,
        }} />
      )}
      <TouchableOpacity
        onPress={() => router.push('/notifications')}
        style={{
          width: 40, height: 40, borderRadius: 20,
          alignItems: 'center', justifyContent: 'center',
          marginRight: 4,
        }}
      >
        <Ic name="bell" size={20} color={M.text} />
        <View style={{
          position: 'absolute', top: 9, right: 11,
          width: 6, height: 6, borderRadius: 3,
          backgroundColor: M.accent,
          borderWidth: 2, borderColor: M.surface,
        }} />
      </TouchableOpacity>
    </View>
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar
        title="KariGo"
        action={topAction}
        logo={require('../assets/logo.png')}
      />

      {/* Ambient gradient orbs */}
      <View pointerEvents="none" style={{
        position: 'absolute', top: 80, right: -100,
        width: 280, height: 280, borderRadius: 280,
        backgroundColor: M.accentSoft, opacity: 0.35,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: 200, left: -120,
        width: 240, height: 240, borderRadius: 240,
        backgroundColor: M.agentBg, opacity: 0.4,
      }} />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Greeting */}
        <View style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: M.surface,
            alignSelf: 'flex-start',
            paddingHorizontal: 10, paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1, borderColor: M.border,
            marginBottom: 10,
          }}>
            <Ic name="sparkle" size={11} color={M.accentDeep} fill />
            <Text style={{ fontSize: 11, fontWeight: '700', color: M.textMute, letterSpacing: 0.3 }}>
              {greeting.toUpperCase()}
            </Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '800', color: M.text, letterSpacing: -0.6, marginBottom: 4 }}>
            Hi there.
          </Text>
          <Text style={{ fontSize: 15, color: M.textMute, fontWeight: '500' }}>
            How can I help today?
          </Text>
        </View>

        {/* Hero input card */}
        <View style={{ paddingHorizontal: 14 }}>
          <MCard style={{
            borderWidth: focus ? 1.5 : 1,
            borderColor: focus ? M.accent : M.border,
          }}>
            {/* Accent top strip */}
            <View style={{
              height: 3,
              backgroundColor: M.accent,
              opacity: focus ? 1 : 0.35,
            }} />

            <View style={{ padding: 14 }}>
              {/* Header row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 9,
                  backgroundColor: M.accentSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic name="sparkle" size={15} color={M.accentDeep} fill />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: M.text }}>Service request</Text>
                  <Text style={{ fontSize: 11, color: M.textMute, marginTop: 1 }}>Describe what you need · any language</Text>
                </View>
              </View>

              <TextInput
                value={displayedQuery}
                onChangeText={(text) => {
                  setQuery(text);
                  setInterimSpeech('');
                  speechBaseRef.current = text.trim();
                }}
                onFocus={() => setFocus(true)}
                onBlur={() => setFocus(false)}
                placeholder="e.g. Mujhe kal subah G-13 mein AC technician chahiye"
                placeholderTextColor={M.textDim}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                style={{
                  fontSize: 14, color: M.text, lineHeight: 22,
                  minHeight: 66,
                  textAlign: isUrdu ? 'right' : 'left',
                }}
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {SPEECH_LANGUAGES.map((lang) => {
                  const active = speechLanguage.key === lang.key;
                  return (
                    <TouchableOpacity
                      key={lang.key}
                      onPress={() => {
                        if (!recognizing) setSpeechLanguage(lang);
                      }}
                      disabled={recognizing}
                      style={{
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderWidth: 1,
                        borderColor: active ? M.accent : M.border,
                        backgroundColor: active ? M.accentSoft : M.surfaceLow,
                        opacity: recognizing && !active ? 0.55 : 1,
                      }}
                    >
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: active ? M.accentDeep : M.textMute,
                      }}>
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Footer row */}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                borderTopWidth: 1, borderTopColor: M.divider, paddingTop: 8, marginTop: 6,
              }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 11, color: recognizing ? M.accentDeep : M.textDim, fontWeight: '600' }}>
                    {speechStatus || `${displayedQuery.length} chars`}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {langLabel && (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5,
                      backgroundColor: M.agentBg, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 3,
                    }}>
                      <Ic name="globe" size={11} color={M.agent} weight={2.4} />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: M.agent, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {langLabel}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={handleSpeechPress}
                    disabled={stoppingSpeech}
                    accessibilityRole="button"
                    accessibilityLabel={recognizing ? 'Stop listening' : 'Start speech to text'}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: recognizing ? M.accent : M.surfaceLow,
                      borderWidth: 1,
                      borderColor: recognizing ? M.accent : M.border,
                      opacity: stoppingSpeech ? 0.65 : 1,
                    }}
                  >
                    <Ic
                      name={recognizing ? 'square' : 'mic'}
                      size={16}
                      color={recognizing ? '#fff' : M.text}
                      fill={recognizing}
                      weight={2.3}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </MCard>

          {/* Error message */}
          {error && (
            <View style={{
              backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 10,
              borderWidth: 1, borderColor: '#FECACA', flexDirection: 'row', gap: 8, alignItems: 'center',
            }}>
              <Ic name="alarm" size={14} color={M.error} />
              <Text style={{ flex: 1, fontSize: 12, color: '#991B1B', lineHeight: 18 }}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: M.error }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* City picker */}
          <TouchableOpacity
            onPress={() => setCityOpen(!cityOpen)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: M.surface, borderRadius: 14,
              borderWidth: 1, borderColor: M.border,
              paddingHorizontal: 14, height: 48, marginTop: 10,
            }}
          >
            <Ic name="pin" size={18} color={M.textMute} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: M.text }}>{city}</Text>
            <Ic name="chev" size={16} color={M.textDim} weight={2} />
          </TouchableOpacity>

          {cityOpen && (
            <MCard style={{ marginTop: 4 }}>
              {['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi'].map((c, i, arr) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => { setCity(c); setCityOpen(false); }}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: M.divider,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: city === c ? '700' : '400', color: city === c ? M.accent : M.text }}>
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </MCard>
          )}
        </View>

        {/* Categories */}
        <View style={{ paddingTop: 22, paddingBottom: 0, paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: M.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Popular services
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setQuery(`${cat.prompt || `Need ${cat.label.toLowerCase()}`} `)}
                style={{
                  alignItems: 'center', gap: 6,
                  backgroundColor: M.surface,
                  borderRadius: 14, padding: 10,
                  borderWidth: 1, borderColor: M.border,
                  minWidth: 72,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: cat.bg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic name={cat.icon} size={18} color={cat.color} weight={2} />
                </View>
                <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '600', color: M.text }}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Examples */}
        <View style={{ paddingHorizontal: 14, paddingTop: 20, paddingBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ic name="sparkle" size={12} color={M.textDim} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: M.textDim, letterSpacing: 1, textTransform: 'uppercase' }}>
              Try an example
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 2, paddingBottom: 2 }}
          >
            {EXAMPLES.map((ex, i) => {
              const isAr = /[\u0600-\u06FF]/.test(ex);
              const sel = query === ex;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setQuery(ex)}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: sel ? M.accentSoft : M.surface,
                    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9,
                    borderWidth: 1,
                    borderColor: sel ? M.accent : M.border,
                    maxWidth: 280,
                  }}
                >
                  <Text numberOfLines={1} style={{
                    fontSize: 12.5, color: sel ? M.accentDeep : M.text,
                    fontWeight: sel ? '700' : '500',
                    textAlign: isAr ? 'right' : 'left',
                  }}>
                    {ex}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 14, paddingBottom: 20 }}>
          {loading ? (
            <View style={{
              backgroundColor: M.accent, borderRadius: 14, height: 52,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <AccentBtn onPress={handleSubmit}>Find a provider</AccentBtn>
          )}
        </View>
      </ScrollView>

      <BottomNav active="book" />
    </View>
  );
}
