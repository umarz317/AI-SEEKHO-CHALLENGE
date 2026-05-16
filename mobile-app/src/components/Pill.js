// src/components/Pill.js
import React from 'react';
import { View, Text } from 'react-native';
import Ic from './Ic';
import { M } from '../theme';

export default function Pill({ label, color, bg, icon }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: bg || M.surfaceVar,
      borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    }}>
      {icon && <Ic name={icon} size={11} color={color || M.textMute} weight={2.4} />}
      <Text style={{ fontSize: 11, fontWeight: '600', color: color || M.textMute }}>
        {label}
      </Text>
    </View>
  );
}
