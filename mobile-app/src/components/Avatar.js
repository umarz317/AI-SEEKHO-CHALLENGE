// src/components/Avatar.js
import React from 'react';
import { View, Text } from 'react-native';

export default function Avatar({ initials, gradient = ['#10B981', '#059669'], size = 52 }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: gradient[0],
      alignItems: 'center', justifyContent: 'center',
      shadowColor: gradient[0],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 6,
    }}>
      <Text style={{
        color: '#fff',
        fontWeight: '800',
        fontSize: size * 0.36,
        letterSpacing: 0.5,
      }}>
        {initials}
      </Text>
    </View>
  );
}
