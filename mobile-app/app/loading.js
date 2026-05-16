// app/loading.js — Screen 2: Loading (animated step list)
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ic from '../src/components/Ic';
import { M } from '../src/theme';
import { LOAD_LABELS } from '../src/data';

export default function LoadingScreen() {
  const router   = useRouter();
  const { dest } = useLocalSearchParams();
  const [step, setStep] = useState(0);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const insets   = useSafeAreaInsets();

  // Spinning orb
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  // Step ticker
  useEffect(() => {
    let s = 0;
    const id = setInterval(() => {
      s++;
      setStep(s);
      if (s >= 6) {
        clearInterval(id);
        setTimeout(() => {
          router.replace({ pathname: `/${dest || 'understanding'}` });
        }, 300);
      }
    }, 460);
    return () => clearInterval(id);
  }, [dest]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progress = Math.min(step / 6, 1);

  return (
    <View style={{
      flex: 1, backgroundColor: M.bg,
      paddingTop: insets.top + 32,
      paddingHorizontal: 18,
      alignItems: 'center',
    }}>
      {/* Orb */}
      <View style={{ position: 'relative', marginBottom: 28 }}>
        <Animated.View style={{
          width: 96, height: 96, borderRadius: 48,
          borderWidth: 3,
          borderColor: M.accent,
          borderTopColor: M.agent,
          borderRightColor: M.purple,
          transform: [{ rotate: spin }],
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            width: 82, height: 82, borderRadius: 41,
            backgroundColor: M.surface,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ic name="sparkle" size={32} color={M.accentDeep} fill />
          </View>
        </Animated.View>
      </View>

      {/* Label */}
      <Text style={{ fontSize: 17, fontWeight: '700', color: M.text, textAlign: 'center', marginBottom: 4, letterSpacing: -0.2 }}>
        {step < LOAD_LABELS.length ? LOAD_LABELS[step] : 'All done!'}
      </Text>
      <Text style={{ fontSize: 13, color: M.textMute, textAlign: 'center', marginBottom: 24 }}>
        Step {Math.min(step + 1, 6)} of 6
      </Text>

      {/* Progress bar */}
      <View style={{
        width: '100%', maxWidth: 280, height: 4,
        backgroundColor: M.divider, borderRadius: 2, overflow: 'hidden', marginBottom: 28,
      }}>
        <View style={{
          width: `${progress * 100}%`, height: '100%',
          backgroundColor: M.accent, borderRadius: 2,
        }} />
      </View>

      {/* Step list */}
      <View style={{ width: '100%', gap: 6 }}>
        {LOAD_LABELS.map((label, i) => {
          const done = i < step;
          const cur  = i === step;
          return (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
              backgroundColor: cur ? M.accentBg : 'transparent',
              opacity: (done || cur) ? 1 : 0.4,
            }}>
              <View style={{
                width: 18, height: 18, borderRadius: 9,
                backgroundColor: done ? M.success : cur ? M.accent : M.borderHi,
                alignItems: 'center', justifyContent: 'center',
              }}>
                {done && <Ic name="check" size={11} color="#fff" weight={3} />}
                {cur && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />}
              </View>
              <Text style={{
                fontSize: 13,
                fontWeight: cur ? '600' : '500',
                color: cur ? M.accentDeep : M.textMute,
              }}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
