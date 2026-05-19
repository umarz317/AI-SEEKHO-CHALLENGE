// src/components/BottomNav.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ic from './Ic';
import { M } from '../theme';

const TABS = [
  { id: 'book',    label: 'Book',     icon: 'homeic', href: '/' },
  { id: 'history', label: 'Bookings', icon: 'list',   href: '/bookings' },
  { id: 'profile', label: 'Profile',  icon: 'user',   href: '/profile' },
];

export default function BottomNav({ active = 'book' }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={{
      backgroundColor: M.surface,
      borderTopWidth: 1,
      borderTopColor: M.divider,
      flexDirection: 'row',
      paddingTop: 4,
      paddingBottom: insets.bottom || 8,
    }}>
      {TABS.map(({ id, label, icon, href }) => {
        const isActive = id === active;
        return (
          <TouchableOpacity
            key={id}
            activeOpacity={0.7}
            onPress={() => {
              if (href && id !== active) router.push(href);
            }}
            style={{ flex: 1, alignItems: 'center', gap: 3 }}
          >
            <View style={{
              width: 56, height: 28, borderRadius: 14,
              backgroundColor: isActive ? M.accentSoft : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic name={icon} size={20} color={isActive ? M.accentDeep : M.textDim} weight={2} />
            </View>
            <Text style={{
              fontSize: 10.5,
              fontWeight: isActive ? '700' : '500',
              color: isActive ? M.accentDeep : M.textDim,
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
