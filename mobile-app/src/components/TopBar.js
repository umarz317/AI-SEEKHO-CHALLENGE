// src/components/TopBar.js
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ic from './Ic';
import { M } from '../theme';

export default function TopBar({ title, subtitle, onBack, action, logo }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      paddingTop: insets.top,
      backgroundColor: M.surface,
      borderBottomWidth: 1,
      borderBottomColor: M.divider,
    }}>
      <View style={{
        height: 64,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 10,
      }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 40, height: 40, borderRadius: 12,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: M.surfaceVar,
            }}
          >
            <Ic name="back" size={20} color={M.text} />
          </TouchableOpacity>
        ) : logo ? (
          <View style={{
            width: 40, height: 40, borderRadius: 11,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#FFFFFF',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: M.border,
          }}>
            <Image source={logo} resizeMode="contain" style={{ width: 32, height: 32 }} />
          </View>
        ) : (
          <View style={{ width: 8 }} />
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17, fontWeight: '800', color: M.text,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 11, color: M.textMute, fontWeight: '500', marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {action || <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}
