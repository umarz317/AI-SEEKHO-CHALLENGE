// src/components/Buttons.js
import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Ic from './Ic';
import { M } from '../theme';

export function AccentBtn({ children, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        height: 52,
        backgroundColor: disabled ? M.borderHi : M.accent,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: M.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: disabled ? 0 : 0.35,
        shadowRadius: 14,
        elevation: disabled ? 0 : 6,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: disabled ? M.textMute : '#fff' }}>
        {children}
      </Text>
      {!disabled && <Ic name="arrow" size={18} color="#fff" weight={2.2} />}
    </TouchableOpacity>
  );
}

export function FilledBtn({ children, onPress, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        height: 52,
        backgroundColor: disabled ? M.borderHi : M.text,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: disabled ? 0 : 0.2,
        shadowRadius: 12,
        elevation: disabled ? 0 : 5,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '700', color: disabled ? M.textMute : '#fff' }}>
        {children}
      </Text>
      {!disabled && <Ic name="arrow" size={18} color="#fff" weight={2.2} />}
    </TouchableOpacity>
  );
}

export function OutlinedBtn({ children, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        height: 52,
        backgroundColor: M.surface,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: M.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: M.text }}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}
