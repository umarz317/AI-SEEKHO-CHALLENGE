// src/components/MiniMap.js — Real map (expo-maps) with stylized SVG fallback
import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing, Platform } from 'react-native';
import Svg, { Path, Circle, Line, Defs, LinearGradient as SvgLinearGradient, Stop, G } from 'react-native-svg';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { M } from '../theme';

const MAP_HEIGHT = 160;

export default function MiniMap({
  distanceLabel,
  providerColor = M.accent,
  providerGradient,
  userLat,
  userLng,
  providerLat,
  providerLng,
}) {
  const hasCoords =
    Number.isFinite(providerLat) && Number.isFinite(providerLng);

  if (!hasCoords) {
    return (
      <FallbackMap
        distanceLabel={distanceLabel}
        providerColor={providerColor}
        providerGradient={providerGradient}
      />
    );
  }

  const uLat = Number.isFinite(userLat) ? userLat : providerLat;
  const uLng = Number.isFinite(userLng) ? userLng : providerLng;

  // Center between user and provider, with a zoom that roughly fits both
  const center = {
    latitude: (uLat + providerLat) / 2,
    longitude: (uLng + providerLng) / 2,
  };
  const dLat = Math.abs(providerLat - uLat);
  const dLng = Math.abs(providerLng - uLng);
  const span = Math.max(dLat, dLng, 0.005);
  // Rough zoom estimate: span ~0.01 → 14, ~0.05 → 12, ~0.2 → 10
  const zoom = Math.max(10, Math.min(16, Math.round(14 - Math.log2(span / 0.01))));

  const cameraPosition = { coordinates: center, zoom };

  const markers = useMemo(() => {
    const list = [
      {
        id: 'provider',
        coordinates: { latitude: providerLat, longitude: providerLng },
        title: 'Provider',
      },
    ];
    if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
      list.push({
        id: 'you',
        coordinates: { latitude: userLat, longitude: userLng },
        title: 'You',
      });
    }
    return list;
  }, [userLat, userLng, providerLat, providerLng]);

  const polylines = useMemo(() => {
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return [];
    return [
      {
        id: 'route',
        coordinates: [
          { latitude: userLat, longitude: userLng },
          { latitude: providerLat, longitude: providerLng },
        ],
        color: providerGradient?.[1] || M.accentDeep,
        width: 4,
      },
    ];
  }, [userLat, userLng, providerLat, providerLng, providerGradient]);

  const MapView = Platform.OS === 'ios' ? AppleMaps.View : GoogleMaps.View;

  return (
    <View style={{ width: '100%', height: MAP_HEIGHT, backgroundColor: M.surfaceLow }}>
      <MapView
        style={{ flex: 1 }}
        cameraPosition={cameraPosition}
        markers={markers}
        polylines={polylines}
      />
      {!!distanceLabel && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 10, alignSelf: 'center',
            backgroundColor: M.text,
            paddingHorizontal: 10, paddingVertical: 4,
            borderRadius: 999,
            shadowColor: '#0F172A',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
            {distanceLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Fallback: stylized SVG mock (used when coordinates aren't provided) */
/* ------------------------------------------------------------------ */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const W = 320;
const H = 130;
const USER = { x: 38, y: H - 32 };
const PROV = { x: W - 38, y: 32 };
const ROUTE_D = `M${USER.x} ${USER.y} C ${USER.x + 60} ${USER.y - 30}, ${PROV.x - 60} ${PROV.y + 50}, ${PROV.x} ${PROV.y}`;
const ROADS = [
  { d: `M0 ${H - 18} L${W} ${H - 60}`, w: 8 },
  { d: `M${W * 0.6} 0 L${W * 0.45} ${H}`, w: 7 },
  { d: `M0 ${H * 0.4} L${W} ${H * 0.55}`, w: 6 },
  { d: `M${W * 0.18} 0 L${W * 0.05} ${H}`, w: 5 },
];

function FallbackMap({ distanceLabel, providerColor, providerGradient }) {
  const dashOffset = useRef(new Animated.Value(400)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(dashOffset, {
      toValue: 0, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: false }),
      ]),
    ).start();
  }, []);

  const pulseR = pulse.interpolate({ inputRange: [0, 1], outputRange: [10, 26] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const grad0 = providerGradient?.[0] || providerColor || M.accent;
  const grad1 = providerGradient?.[1] || M.accentDeep;

  return (
    <View style={{ width: '100%', alignItems: 'center', backgroundColor: M.surfaceLow }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        <Defs>
          <SvgLinearGradient id="mapBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F1F5F9" />
            <Stop offset="1" stopColor="#E2E8F0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="routeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={M.accent} />
            <Stop offset="1" stopColor={grad1} />
          </SvgLinearGradient>
          <SvgLinearGradient id="provGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad0} />
            <Stop offset="1" stopColor={grad1} />
          </SvgLinearGradient>
        </Defs>
        <Path d={`M0 0 H${W} V${H} H0 Z`} fill="url(#mapBg)" />
        <G opacity={0.55}>
          {ROADS.map((r, i) => (
            <Path key={i} d={r.d} stroke="#FFFFFF" strokeWidth={r.w} strokeLinecap="round" fill="none" />
          ))}
        </G>
        <G opacity={0.18}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Line key={`h-${i}`} x1={0} x2={W} y1={(H / 6) * i} y2={(H / 6) * i} stroke="#64748B" strokeWidth={0.5} strokeDasharray="2,4" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <Line key={`v-${i}`} x1={(W / 10) * i} x2={(W / 10) * i} y1={0} y2={H} stroke="#64748B" strokeWidth={0.5} strokeDasharray="2,4" />
          ))}
        </G>
        <Path d={ROUTE_D} stroke="#FFFFFF" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} />
        <AnimatedPath
          d={ROUTE_D} stroke="url(#routeGrad)" strokeWidth={3} fill="none"
          strokeLinecap="round" strokeDasharray="8,6" strokeDashoffset={dashOffset}
        />
        <G>
          <Circle cx={USER.x} cy={USER.y} r={12} fill="#FFFFFF" />
          <Circle cx={USER.x} cy={USER.y} r={7} fill={M.text} />
          <Circle cx={USER.x} cy={USER.y} r={3} fill="#FFFFFF" />
        </G>
        <AnimatedCircle cx={PROV.x} cy={PROV.y} r={pulseR} fill={grad0} opacity={pulseOpacity} />
        <Circle cx={PROV.x} cy={PROV.y + 0.5} r={14} fill="#FFFFFF" opacity={0.35} />
        <Circle cx={PROV.x} cy={PROV.y} r={11} fill="url(#provGrad)" />
        <Circle cx={PROV.x} cy={PROV.y - 1} r={4.5} fill="#FFFFFF" />
      </Svg>
      <View pointerEvents="none" style={{
        position: 'absolute', left: 12, bottom: 10,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1, borderColor: M.divider,
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: M.text }} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: M.textMute, letterSpacing: 0.5 }}>YOU</Text>
      </View>
      <View pointerEvents="none" style={{
        position: 'absolute', right: 12, top: 10,
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 8, borderWidth: 1, borderColor: M.divider,
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: grad0 }} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: M.textMute, letterSpacing: 0.5 }}>PROVIDER</Text>
      </View>
      {!!distanceLabel && (
        <View pointerEvents="none" style={{
          position: 'absolute', top: H / 2 - 12, left: '50%', marginLeft: -36,
          backgroundColor: M.text, paddingHorizontal: 10, paddingVertical: 4,
          borderRadius: 999,
          shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 }, elevation: 4,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
            {distanceLabel}
          </Text>
        </View>
      )}
    </View>
  );
}
