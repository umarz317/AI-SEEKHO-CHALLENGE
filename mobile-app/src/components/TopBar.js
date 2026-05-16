// src/components/TopBar.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ic from './Ic';
import { M } from '../theme';

export default function TopBar({ title, subtitle, onBack, action }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      paddingTop: insets.top,
      backgroundColor: M.surface,
      borderBottomWidth: 1,
      borderBottomColor: M.divider,
    }}>
      <View style={{
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
      }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={{
              width: 44, height: 44, borderRadius: 22,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ic name="back" size={22} color={M.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 14 }} />
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontSize: 17, fontWeight: '700', color: M.text,
              letterSpacing: -0.2,
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

        {action || <View style={{ width: 44 }} />}
      </View>
    </View>
  );
}
