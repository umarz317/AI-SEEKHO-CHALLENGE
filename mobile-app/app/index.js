// app/index.js — Screen 1: Home (integrated with backend)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import Constants from 'expo-constants';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// iOS Simulator's SFSpeechRecognizer is unstable and frequently crashes the
// app process on `.start()`. We treat the simulator as "speech not available".
const IS_SIMULATOR = Platform.OS === 'ios' && Constants.isDevice === false;

// Defensive guard: when the native module isn't linked (Expo Go, missing dev
// client rebuild, etc.) the import returns undefined and any method call
// crashes hard. This check lets us show a clean error instead.
function speechModuleReady() {
  return (
    ExpoSpeechRecognitionModule &&
    typeof ExpoSpeechRecognitionModule.start === 'function' &&
    typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function'
  );
}
import { useRouter } from 'expo-router';
import TopBar from '../src/components/TopBar';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { AccentBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { CATEGORIES, EXAMPLES } from '../src/data';
import { checkHealth } from '../src/api';
import { detectLang } from '../src/utils/detectLang';

const SPEECH_LANGUAGES = [
  { key: 'english', label: 'English', locale: 'en-US' },
  { key: 'urdu', label: 'Urdu', locale: 'ur-PK' },
];

// Resolve the best locale the on-device recognizer actually supports.
// Falls back: requested -> language root (e.g. "ur") -> en-US -> first installed.
async function resolveSupportedLocale(requestedLocale) {
  if (!speechModuleReady() || typeof ExpoSpeechRecognitionModule.getSupportedLocales !== 'function') {
    return requestedLocale;
  }
  try {
    const { locales = [], installedLocales = [] } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    const supported = new Set([...locales, ...installedLocales].map((l) => String(l).toLowerCase()));
    if (!supported.size) return requestedLocale; // empty -> trust the request
    const wanted = String(requestedLocale).toLowerCase();
    if (supported.has(wanted)) return requestedLocale;
    // Try language root (e.g. "ur-PK" -> "ur") or any variant with same root.
    const root = wanted.split('-')[0];
    const variant = [...supported].find((l) => l === root || l.startsWith(`${root}-`));
    if (variant) return variant;
    if (supported.has('en-us')) return 'en-US';
    return [...supported][0];
  } catch {
    return requestedLocale;
  }
}

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
  const detected   = detectLang(displayedQuery);
  const isUrdu     = detected === 'Urdu' || speechLanguage.key === 'urdu';
  const langLabel  = isUrdu ? 'Urdu' : detected;
  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(ok => setOnline(ok));
  }, []);

  useEffect(() => {
    if (recognizing) return;
    const lang = detectLang(query);
    const next = lang === 'Urdu' ? SPEECH_LANGUAGES[1] : SPEECH_LANGUAGES[0];
    if (next.key !== speechLanguage.key) setSpeechLanguage(next);
  }, [query, recognizing]);

  useEffect(() => {
    return () => {
      try {
        if (speechModuleReady() && typeof ExpoSpeechRecognitionModule.abort === 'function') {
          ExpoSpeechRecognitionModule.abort();
        }
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
    // Map common native error codes to a friendly explanation. Unknown codes
    // fall through to the raw message so we don't hide real failures.
    const friendly = {
      'language-not-supported': `${speechLanguage.label} voice input is not installed on this device. Switch to English or type instead.`,
      'service-not-allowed':    'Voice input is blocked by the system. Check Settings → Privacy → Speech Recognition.',
      'not-allowed':            'Voice input permission was denied. Grant microphone & speech access in Settings.',
      'audio-capture':          'Could not access the microphone. Close other apps using audio and try again.',
      'network':                'Voice input needs an internet connection for this language.',
      'no-speech':              'No speech detected. Tap the mic and try again closer to the microphone.',
      'aborted':                null, // user-initiated stop or quick re-tap; don\'t spam an error.
    }[event.error];
    if (friendly === null) return;
    const code = event.error ? ` (${event.error})` : '';
    setError(friendly || event.message || `Speech recognition failed${code}.`);
  });

  const handleSpeechPress = async () => {
    if (recognizing) {
      setStoppingSpeech(true);
      try {
        if (speechModuleReady()) {
          await ExpoSpeechRecognitionModule.stop();
        }
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

    // Early bail-outs so we never call into a broken / missing native module.
    if (!speechModuleReady()) {
      setError(
        'Speech recognition is not installed in this build. Rebuild the dev client (eas build / expo prebuild) after adding expo-speech-recognition.'
      );
      return;
    }
    if (IS_SIMULATOR) {
      setError(
        'Voice input does not work on the iOS Simulator. Try it on a real device — typing works here.'
      );
      return;
    }

    try {
      if (
        typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' &&
        !ExpoSpeechRecognitionModule.isRecognitionAvailable()
      ) {
        setError('Speech recognition is not available on this device.');
        return;
      }

      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission?.granted) {
        setError('Microphone and speech recognition permission are required to dictate a service request.');
        return;
      }

      // Resolve to a locale the recognizer actually supports. ur-PK in
      // particular is missing on many iOS installs and causes the native
      // "failed to initialize recognizer" error.
      const resolvedLocale = await resolveSupportedLocale(speechLanguage.locale);
      if (!resolvedLocale) {
        setError('No supported speech locale found on this device.');
        return;
      }
      if (resolvedLocale.toLowerCase() !== speechLanguage.locale.toLowerCase()) {
        console.warn(`[speech] ${speechLanguage.locale} not supported, falling back to ${resolvedLocale}`);
      }

      // `.start()` can throw synchronously from native code on some platforms;
      // wrap it so we surface a clean error instead of crashing.
      try {
        ExpoSpeechRecognitionModule.start({
          lang: resolvedLocale,
          interimResults: true,
          continuous: false,
          addsPunctuation: true,
          requiresOnDeviceRecognition: false,
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
      } catch (startErr) {
        setRecognizing(false);
        setStoppingSpeech(false);
        setError(startErr?.message || 'Could not start listening on this device.');
      }
    } catch (err) {
      setRecognizing(false);
      setStoppingSpeech(false);
      setError(err.message || 'Speech recognition could not start. Rebuild the dev client after installing the native speech module.');
    }
  };

  const swapSpeechLanguage = async () => {
    const other = SPEECH_LANGUAGES.find((l) => l.key !== speechLanguage.key);
    if (!other) return;
    if (!recognizing) {
      setSpeechLanguage(other);
      return;
    }
    setSpeechLanguage(other);
    if (!speechModuleReady() || IS_SIMULATOR) {
      setRecognizing(false);
      setInterimSpeech('');
      return;
    }
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {}
    setInterimSpeech('');
    speechBaseRef.current = query.trim();
    try {
      const resolvedLocale = await resolveSupportedLocale(other.locale);
      ExpoSpeechRecognitionModule.start({
        lang: resolvedLocale || other.locale,
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (err) {
      setRecognizing(false);
      setError(err.message || 'Could not switch language.');
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


              {/* Footer row */}
              <View style={{
                flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                borderTopWidth: 1, borderTopColor: M.divider, paddingTop: 8, marginTop: 6,
              }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  {recognizing ? (
                    <TouchableOpacity
                      onPress={swapSpeechLanguage}
                      accessibilityRole="button"
                      accessibilityLabel="Switch speech language"
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        alignSelf: 'flex-start',
                        borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
                        backgroundColor: M.accentSoft, borderWidth: 1, borderColor: M.accent,
                      }}
                    >
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: M.accentDeep }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: M.accentDeep }}>
                        Listening · {speechLanguage.label}
                      </Text>
                      <Text style={{ fontSize: 10, color: M.accentDeep, opacity: 0.7 }}>
                        tap to switch
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '600' }}>
                      {stoppingSpeech ? 'Stopping...' : `${displayedQuery.length} chars`}
                    </Text>
                  )}
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

    </View>
  );
}
