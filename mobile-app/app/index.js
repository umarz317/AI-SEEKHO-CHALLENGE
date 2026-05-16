// app/index.js — Screen 1: Home (integrated with backend)
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import TopBar from '../src/components/TopBar';
import BottomNav from '../src/components/BottomNav';
import MCard from '../src/components/MCard';
import Ic from '../src/components/Ic';
import { AccentBtn } from '../src/components/Buttons';
import { M } from '../src/theme';
import { CATEGORIES, EXAMPLES } from '../src/data';
import { orchestrate, checkHealth } from '../src/api';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery]       = useState('');
  const [city, setCity]         = useState('Islamabad');
  const [focus, setFocus]       = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [online, setOnline]     = useState(null);

  const isUrdu      = /[\u0600-\u06FF]/.test(query);
  const isRomanUrdu = !isUrdu && /mujhe|chahiye|subah|mein|kal|aaj/i.test(query);
  const langLabel   = isUrdu ? 'Urdu' : isRomanUrdu ? 'Roman Urdu' : query.length > 3 ? 'English' : null;

  // Check backend health on mount
  useEffect(() => {
    checkHealth().then(ok => setOnline(ok));
  }, []);

  const handleSubmit = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await orchestrate({ text: query.trim(), cityHint: city });
      // Navigate to loading screen, passing full API result as serialized JSON
      router.push({
        pathname: '/loading',
        params: {
          dest: 'understanding',
          apiData: JSON.stringify(result),
          query: query.trim(),
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
      <TouchableOpacity style={{
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        marginRight: 4,
      }}>
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

  return (
    <View style={{ flex: 1, backgroundColor: M.bg }}>
      <TopBar title="AISEEKHO" subtitle="AI Service Agent" action={topAction} />

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Greeting */}
        <View style={{ paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: M.text, letterSpacing: -0.5, marginBottom: 4 }}>
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
                value={query}
                onChangeText={setQuery}
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
                <Text style={{ fontSize: 11, color: M.textDim, fontWeight: '500' }}>
                  {query.length} chars
                </Text>
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
                onPress={() => setQuery(`Need ${cat.label.toLowerCase()} `)}
                style={{
                  alignItems: 'center', gap: 6,
                  backgroundColor: M.surface,
                  borderRadius: 14, padding: 10,
                  borderWidth: 1, borderColor: M.border,
                  width: 64,
                }}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 10,
                  backgroundColor: cat.bg,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ic name={cat.icon} size={18} color={cat.color} weight={2} />
                </View>
                <Text style={{ fontSize: 10.5, fontWeight: '600', color: M.text }}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Examples */}
        <View style={{ paddingHorizontal: 14, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: M.textDim, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Try one of these
          </Text>
          <View style={{ gap: 6 }}>
            {EXAMPLES.map((ex, i) => {
              const isAr = /[\u0600-\u06FF]/.test(ex);
              const sel = query === ex;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setQuery(ex)}
                  style={{
                    backgroundColor: sel ? M.accentSoft : M.surface,
                    borderRadius: 12, padding: 14,
                    borderWidth: 1,
                    borderColor: sel ? M.accent : M.border,
                  }}
                >
                  <Text style={{
                    fontSize: 13, color: sel ? M.accentDeep : M.text,
                    fontWeight: sel ? '600' : '400',
                    textAlign: isAr ? 'right' : 'left',
                    lineHeight: 19,
                  }}>
                    {ex}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
