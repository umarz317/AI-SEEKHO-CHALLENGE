// src/components/Ic.js — SVG icon system (port from HTML prototype)
import React from 'react';
import Svg, {
  Path, Circle, Polyline, Polygon, Rect, Line, Text as SvgText,
} from 'react-native-svg';

const PATHS = {
  back:    ({ c, w }) => <Path d="M19 12H5M12 19l-7-7 7-7" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  arrow:   ({ c, w }) => <Path d="M5 12h14M12 5l7 7-7 7" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  bell:    ({ c, w }) => (<><Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Path d="M13.73 21a2 2 0 0 1-3.46 0" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>),
  pin:     ({ c, w }) => (<><Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Circle cx="12" cy="10" r="3" stroke={c} strokeWidth={w} fill="none" /></>),
  clock:   ({ c, w }) => (<><Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={w} fill="none" /><Polyline points="12 6 12 12 16 14" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>),
  cal:     ({ c, w }) => (<><Rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth={w} fill="none" /><Line x1="16" y1="2" x2="16" y2="6" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="8" y1="2" x2="8" y2="6" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="3" y1="10" x2="21" y2="10" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  globe:   ({ c, w }) => (<><Circle cx="12" cy="12" r="10" stroke={c} strokeWidth={w} fill="none" /><Line x1="2" y1="12" x2="22" y2="12" stroke={c} strokeWidth={w} /><Path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" stroke={c} strokeWidth={w} fill="none" /></>),
  sparkle: ({ c, f }) => <Path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" fill={f ? c : 'none'} stroke={f ? 'none' : c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />,
  check:   ({ c, w }) => <Polyline points="20 6 9 17 4 12" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  msg:     ({ c, w }) => <Path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  shield:  ({ c, f }) => <Path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6l-9-4z" fill={f ? c : 'none'} stroke={f ? 'none' : c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />,
  star:    ({ c, f }) => <Polygon points="12 2 15 9 22 9.3 17 14 18 21 12 17.8 6 21 7 14 2 9.3 9 9 12 2" fill={f ? c : 'none'} stroke={f ? 'none' : c} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />,
  snow:    ({ c, w }) => (<><Line x1="12" y1="2" x2="12" y2="22" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="20" y1="7" x2="4" y2="17" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="20" y1="17" x2="4" y2="7" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  zap:     ({ c, f }) => <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill={f ? c : 'none'} stroke={f ? 'none' : c} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />,
  wrench:  ({ c, w }) => <Path d="M14.7 6.3a4 4 0 0 1-1.7 5.4L20 18.6 18.6 20l-6.9-6.9a4 4 0 0 1-5.4-5l2.6 2.6 1.7-1.7-2.6-2.6a4 4 0 0 1 6.7 0z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  scissor: ({ c, w }) => (<><Circle cx="6" cy="6" r="3" stroke={c} strokeWidth={w} fill="none" /><Circle cx="6" cy="18" r="3" stroke={c} strokeWidth={w} fill="none" /><Line x1="20" y1="4" x2="8.1" y2="15.9" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="14.5" y1="14.5" x2="20" y2="20" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="8.1" y1="8.1" x2="12" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  bookic:  ({ c, w }) => <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  spray:   ({ c, w }) => (<><Path d="M9 11h6v11H9z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Path d="M12 4v5M9 4h6" stroke={c} strokeWidth={w} strokeLinecap="round" /><Path d="M15 7a3 3 0 1 0 0-6" stroke={c} strokeWidth={w} fill="none" /></>),
  chev:    ({ c, w }) => <Polyline points="6 9 12 15 18 9" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  list:    ({ c, w }) => (<><Line x1="8" y1="6" x2="21" y2="6" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="8" y1="12" x2="21" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="8" y1="18" x2="21" y2="18" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="3" y1="6" x2="3.01" y2="6" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="3" y1="12" x2="3.01" y2="12" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="3" y1="18" x2="3.01" y2="18" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  user:    ({ c, w }) => (<><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Circle cx="12" cy="7" r="4" stroke={c} strokeWidth={w} fill="none" /></>),
  homeic:  ({ c, w }) => (<><Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Polyline points="9 22 9 12 15 12 15 22" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>),
  cpu:     ({ c, w }) => (<><Rect x="4" y="4" width="16" height="16" rx="2" stroke={c} strokeWidth={w} fill="none" /><Rect x="9" y="9" width="6" height="6" stroke={c} strokeWidth={w} fill="none" /><Line x1="9" y1="1" x2="9" y2="4" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="15" y1="1" x2="15" y2="4" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="9" y1="20" x2="9" y2="23" stroke={c} strokeWidth={w} strokeLinecap="round" /><Line x1="15" y1="20" x2="15" y2="23" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  flow:    ({ c, w }) => <Path d="M3 12h4l3-9 4 18 3-9h4" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  alarm:   ({ c, w }) => (<><Circle cx="12" cy="13" r="8" stroke={c} strokeWidth={w} fill="none" /><Path d="M5 3L2 6M22 6l-3-3M12 9v4l2 2" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>),
  heart:   ({ c, f, w }) => <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" fill={f ? c : 'none'} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />,
  share:   ({ c, w }) => (<><Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Polyline points="16 6 12 2 8 6" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" /><Line x1="12" y1="2" x2="12" y2="15" stroke={c} strokeWidth={w} strokeLinecap="round" /></>),
  phone:   ({ c, w }) => <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
};

export default function Ic({ name, size = 18, color = '#94A3B8', fill = false, weight = 1.75 }) {
  const Render = PATHS[name];
  if (!Render) return null;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Render c={color} w={weight} f={fill} />
    </Svg>
  );
}
