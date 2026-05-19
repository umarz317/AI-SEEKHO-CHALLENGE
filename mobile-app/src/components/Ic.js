// src/components/Ic.js — Icon system backed by lucide-react-native.
// Keeps the original `name` API so existing screens don't have to change.
// Pass any Lucide icon name (kebab-case or PascalCase) and it'll resolve too.
import React from 'react';
import * as Lucide from 'lucide-react-native';

const ALIAS = {
  back:    'ArrowLeft',
  arrow:   'ArrowRight',
  bell:    'Bell',
  pin:     'MapPin',
  clock:   'Clock',
  cal:     'Calendar',
  globe:   'Globe',
  sparkle: 'Sparkles',
  check:   'Check',
  msg:     'MessageCircle',
  shield:  'Shield',
  star:    'Star',
  snow:    'Snowflake',
  zap:     'Zap',
  wrench:  'Wrench',
  scissor: 'Scissors',
  bookic:  'BookOpen',
  spray:   'SprayCan',
  chev:    'ChevronDown',
  list:    'List',
  user:    'User',
  homeic:  'Home',
  cpu:     'Cpu',
  flow:    'Activity',
  alarm:   'AlarmClock',
  heart:   'Heart',
  share:   'Share2',
  phone:   'Phone',
  edit:    'Pencil',
  refresh: 'RefreshCw',
};

function toPascalCase(s) {
  return String(s)
    .split(/[-_\s]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function resolveIcon(name) {
  if (!name) return null;
  const aliased = ALIAS[name];
  if (aliased && Lucide[aliased]) return Lucide[aliased];
  if (Lucide[name]) return Lucide[name];
  const pascal = toPascalCase(name);
  if (Lucide[pascal]) return Lucide[pascal];
  return null;
}

export default function Ic({
  name,
  size = 18,
  color = '#94A3B8',
  fill = false,
  weight = 1.75,
}) {
  const LucideIcon = resolveIcon(name);
  if (!LucideIcon) return null;
  return (
    <LucideIcon
      size={size}
      color={color}
      strokeWidth={weight}
      fill={fill ? color : 'none'}
    />
  );
}
