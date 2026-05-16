// src/data.js — Mock data + constants (direct port from prototype)
import { M } from './theme';

export const MDATA = {
  query: 'Mujhe kal subah G-13 mein AC technician chahiye',
  understanding: {
    serviceType:       'AC Technician',
    location:          'G-13, Islamabad',
    dateLabel:         'Tomorrow',
    dateFull:          'Saturday, May 17',
    timeWindowLabel:   '9:00 AM – 12:00 PM',
    detectedLanguage:  'Roman Urdu',
    confidence:        94,
  },
  provider: {
    name:          'Ali AC Services',
    initials:      'AS',
    gradient:      ['#10B981', '#047857'],
    verified:      true,
    rating:        4.8,
    reviews:       127,
    distance:      '2.1 km',
    availability:  '10:00 AM',
    completedJobs: 312,
    responseMin:   4,
    score:         0.913,
    yearsActive:   7,
    reasons:       ['Available in window', 'Nearby', 'High rating', 'Fast response', 'Strong history'],
    description:   'Closest high-rated technician available tomorrow morning in G-13.',
  },
  alternatives: [
    { name: 'CoolAir Islamabad',   initials: 'CA', gradient: ['#3B82F6','#1D4ED8'], rating: 4.9, distance: '5.4 km', availability: '11:30 AM', score: 0.871, note: 'Higher rating, farther away.' },
    { name: 'Arctic AC Solutions', initials: 'AR', gradient: ['#06B6D4','#0E7490'], rating: 4.6, distance: '3.2 km', availability: '2:00 PM',  score: 0.822, note: 'Closer, afternoon only.' },
  ],
  booking: {
    bookingId:           'BK-20260517-001',
    providerName:        'Ali AC Services',
    slot:                'Saturday, May 17 · 10:00 AM',
    location:            'G-13, Islamabad',
    confirmationMessage: 'Booking confirmed for 10:00 AM tomorrow.',
    reminderMessage:     'Reminder set for 9:00 AM — 1 hour before arrival.',
    fee:                 'Free consultation',
  },
  trace: [
    { agent: 'Intent Understanding', tool: 'parse_request',     source: 'Claude Haiku',     icon: 'sparkle', color: M.purple,  output: 'Extracted AC Technician, G-13, tomorrow morning · Roman Urdu · 94%' },
    { agent: 'Location Resolution',  tool: 'resolve_location',  source: 'Mock GeoAPI',      icon: 'pin',     color: M.agent,   output: 'G-13 → 33.6844°N, 73.0479°E (Islamabad)' },
    { agent: 'Provider Discovery',   tool: 'find_providers',    source: 'Mock Provider DB', icon: 'list',    color: '#0EA5E9', output: 'Found 3 technicians within 10 km, available tomorrow morning' },
    { agent: 'Provider Ranking',     tool: 'rank_providers',    source: 'Scoring Engine',   icon: 'flow',    color: M.amber,   output: 'Ali AC Services selected · score 0.913 (avail 0.95, prox 0.91, rating 0.96)' },
    { agent: 'Booking',              tool: 'create_booking',    source: 'Booking Store',    icon: 'check',   color: M.accent,  output: 'Booking BK-20260517-001 created · May 17 @ 10:00 AM · CONFIRMED' },
    { agent: 'Follow-up',            tool: 'schedule_reminder', source: 'Scheduler',        icon: 'alarm',   color: M.success, output: 'Reminder scheduled for May 17, 9:00 AM' },
  ],
};

export const CATEGORIES = [
  { id: 'ac',     label: 'AC',          icon: 'snow',    bg: '#EFF6FF', color: '#2563EB' },
  { id: 'plumb',  label: 'Plumber',     icon: 'wrench',  bg: '#FEF3C7', color: '#B45309' },
  { id: 'elec',   label: 'Electrician', icon: 'zap',     bg: '#FEF9C3', color: '#A16207' },
  { id: 'clean',  label: 'Cleaner',     icon: 'spray',   bg: '#D1FAE5', color: '#047857' },
  { id: 'beauty', label: 'Beauty',      icon: 'scissor', bg: '#FCE7F3', color: '#BE185D' },
  { id: 'tutor',  label: 'Tutor',       icon: 'bookic',  bg: '#E0E7FF', color: '#4338CA' },
];

export const EXAMPLES = [
  'Mujhe kal subah G-13 mein AC technician chahiye',
  'Need plumber in F-10 today evening',
  'Need beautician in F-11 tomorrow',
  'مجھے آج شام الیکٹریشن چاہیے',
];

export const LOAD_LABELS = [
  'Understanding your request',
  'Resolving location',
  'Discovering providers',
  'Ranking the best match',
  'Creating your booking',
  'Scheduling reminder',
];

export const CITIES = ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi'];
