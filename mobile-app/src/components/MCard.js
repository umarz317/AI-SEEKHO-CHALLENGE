// src/components/MCard.js
import React from 'react';
import { View } from 'react-native';
import { M } from '../theme';

export default function MCard({ children, style }) {
  return (
    <View style={[{
      backgroundColor: M.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: M.border,
      overflow: 'hidden',
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 2,
    }, style]}>
      {children}
    </View>
  );
}
