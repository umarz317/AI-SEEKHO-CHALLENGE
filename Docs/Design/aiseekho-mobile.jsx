// aiseekho-mobile.jsx — Refined Android prototype
const { useState, useCallback, useEffect } = React;

// ── Refined design tokens ─────────────────────────────────────────────────────
const M = {
  bg:          '#FAFBFD',
  surface:     '#FFFFFF',
  surfaceVar:  '#F4F6FA',
  surfaceLow:  '#F8FAFC',
  primary:     '#1E293B',
  primaryGrad: '#243349',
  accent:      '#10B981',
  accentDark:  '#059669',
  accentDeep:  '#047857',
  accentBg:    '#ECFDF5',
  accentSoft:  '#D1FAE5',
  agent:       '#6366F1',
  agentBg:     '#EEF2FF',
  purple:      '#8B5CF6',
  purpleBg:    '#F5F3FF',
  text:        '#0F172A',
  textMute:    '#64748B',
  textDim:     '#94A3B8',
  border:      '#E2E8F0',
  borderHi:    '#CBD5E1',
  divider:     '#F1F5F9',
  success:     '#22C55E',
  successBg:   '#F0FDF4',
  amber:       '#F59E0B',
  amberBg:     '#FEF3C7',
  error:       '#EF4444',
};

// ── Icon library (custom SVG, no emoji) ───────────────────────────────────────
const ICONS = {
  back:     <path d="M19 12H5M12 19l-7-7 7-7"/>,
  arrow:    <path d="M5 12h14M12 5l7 7-7 7"/>,
  bell:     <><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
  pin:      <><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
  clock:    <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
  cal:      <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  globe:    <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/></>,
  sparkle:  <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>,
  check:    <polyline points="20 6 9 17 4 12"/>,
  msg:      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>,
  shield:   <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6l-9-4z"/>,
  star:     <polygon points="12 2 15 9 22 9.3 17 14 18 21 12 17.8 6 21 7 14 2 9.3 9 9 12 2"/>,
  snow:     <><line x1="12" y1="2" x2="12" y2="22"/><line x1="20" y1="7" x2="4" y2="17"/><line x1="20" y1="17" x2="4" y2="7"/></>,
  zap:      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
  wrench:   <path d="M14.7 6.3a4 4 0 0 1-1.7 5.4L20 18.6 18.6 20l-6.9-6.9a4 4 0 0 1-5.4-5l2.6 2.6 1.7-1.7-2.6-2.6a4 4 0 0 1 6.7 0z"/>,
  scissor:  <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.1" y2="15.9"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8.1" y1="8.1" x2="12" y2="12"/></>,
  bookic:   <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>,
  spray:    <><path d="M9 11h6v11H9zM12 4v5M9 4h6M15 7a3 3 0 1 0 0-6"/></>,
  chev:     <polyline points="6 9 12 15 18 9"/>,
  list:     <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  homeic:   <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  cpu:      <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></>,
  flow:     <><path d="M3 12h4l3-9 4 18 3-9h4"/></>,
  alarm:    <><circle cx="12" cy="13" r="8"/><path d="M5 3L2 6M22 6l-3-3M12 9v4l2 2"/></>,
};

function Ic({ name, size = 18, color = M.textMute, fill = false, weight = 1.75 }) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill={fill ? color : 'none'}
      stroke={!fill ? color : 'none'}
      strokeWidth={weight}
      strokeLinecap="round" strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const MDATA = {
  query: "Mujhe kal subah G-13 mein AC technician chahiye",
  understanding: {
    serviceType: "AC Technician",
    location: "G-13, Islamabad",
    dateLabel: "Tomorrow",
    dateFull:  "Saturday, May 17",
    timeWindowLabel: "9:00 AM – 12:00 PM",
    detectedLanguage: "Roman Urdu",
    confidence: 94,
  },
  provider: {
    name: "Ali AC Services",
    initials: "AS",
    gradient: ['#10B981', '#047857'],
    verified: true,
    rating: 4.8,
    reviews: 127,
    distance: "2.1 km",
    availability: "10:00 AM",
    completedJobs: 312,
    responseMin: 4,
    score: 0.913,
    yearsActive: 7,
    reasons: ["Available in window", "Nearby", "High rating", "Fast response", "Strong history"],
    description: "Closest high-rated technician available tomorrow morning in G-13.",
  },
  alternatives: [
    { name: "CoolAir Islamabad",   initials: "CA", gradient: ['#3B82F6','#1D4ED8'], rating: 4.9, distance: "5.4 km", availability: "11:30 AM", score: 0.871, note: "Higher rating, farther away." },
    { name: "Arctic AC Solutions", initials: "AR", gradient: ['#06B6D4','#0E7490'], rating: 4.6, distance: "3.2 km", availability: "2:00 PM",  score: 0.822, note: "Closer, afternoon only." },
  ],
  booking: {
    bookingId: "BK-20260517-001",
    providerName: "Ali AC Services",
    slot: "Saturday, May 17 · 10:00 AM",
    location: "G-13, Islamabad",
    confirmationMessage: "Booking confirmed for 10:00 AM tomorrow.",
    reminderMessage: "Reminder set for 9:00 AM — 1 hour before arrival.",
    fee: "Free consultation",
  },
  trace: [
    { agent:"Intent Understanding",  tool:"parse_request",     source:"Claude Haiku",       icon:"sparkle", color:M.purple,  output:"Extracted AC Technician, G-13, tomorrow morning · Roman Urdu · 94%" },
    { agent:"Location Resolution",   tool:"resolve_location",  source:"Mock GeoAPI",        icon:"pin",     color:M.agent,   output:"G-13 → 33.6844°N, 73.0479°E (Islamabad)" },
    { agent:"Provider Discovery",    tool:"find_providers",    source:"Mock Provider DB",   icon:"list",    color:'#0EA5E9', output:"Found 3 technicians within 10 km, available tomorrow morning" },
    { agent:"Provider Ranking",      tool:"rank_providers",    source:"Scoring Engine",     icon:"flow",    color:M.amber,   output:"Ali AC Services selected · score 0.913 (avail 0.95, prox 0.91, rating 0.96)" },
    { agent:"Booking",               tool:"create_booking",    source:"Booking Store",      icon:"check",   color:M.accent,  output:"Booking BK-20260517-001 created · May 17 @ 10:00 AM · CONFIRMED" },
    { agent:"Follow-up",             tool:"schedule_reminder", source:"Scheduler",          icon:"alarm",   color:M.success, output:"Reminder scheduled for May 17, 9:00 AM" },
  ],
};

const CATEGORIES = [
  { id:'ac',     label:'AC',         icon:'snow',     bg:'#EFF6FF', color:'#2563EB' },
  { id:'plumb',  label:'Plumber',    icon:'wrench',   bg:'#FEF3C7', color:'#B45309' },
  { id:'elec',   label:'Electrician',icon:'zap',      bg:'#FEF9C3', color:'#A16207' },
  { id:'clean',  label:'Cleaner',    icon:'spray',    bg:'#D1FAE5', color:'#047857' },
  { id:'beauty', label:'Beauty',     icon:'scissor',  bg:'#FCE7F3', color:'#BE185D' },
  { id:'tutor',  label:'Tutor',      icon:'bookic',   bg:'#E0E7FF', color:'#4338CA' },
];

const EXAMPLES = [
  "Mujhe kal subah G-13 mein AC technician chahiye",
  "Need plumber in F-10 today evening",
  "Need beautician in F-11 tomorrow",
  "مجھے آج شام الیکٹریشن چاہیے",
];

const LOAD_LABELS = [
  "Understanding your request",
  "Resolving location",
  "Discovering providers",
  "Ranking the best match",
  "Creating your booking",
  "Scheduling reminder",
];

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ initials, gradient = ['#10B981', '#059669'], size = 52, ring = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 800, fontSize: size * 0.36,
      flexShrink: 0,
      letterSpacing: '.02em',
      boxShadow: `0 6px 18px ${gradient[0]}40, 0 0 0 ${ring ? '3px' : '0'} #fff, 0 0 0 ${ring ? '4px' : '0'} ${gradient[0]}30`,
    }}>
      {initials}
    </div>
  );
}

// ── Top App Bar ────────────────────────────────────────────────────────────────
function TopBar({ title, onBack, action, subtitle }) {
  return (
    <div style={{
      height: 60, flexShrink: 0,
      background: M.surface,
      borderBottom: `1px solid ${M.divider}`,
      display: 'flex', alignItems: 'center',
      padding: '0 6px',
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          width: 44, height: 44, borderRadius: '50%',
          border: 'none', background: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic name="back" size={22} color={M.text} />
        </button>
      ) : (
        <div style={{ width: 14 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 17, fontWeight: 700, color: M.text,
          fontFamily: 'var(--font)', letterSpacing: '-.01em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 11, color: M.textMute, fontWeight: 500, marginTop: 1 }}>{subtitle}</div>
        )}
      </div>
      {action || <div style={{ width: 44 }} />}
    </div>
  );
}

// ── Bottom Navigation ──────────────────────────────────────────────────────────
function BottomNav() {
  const tabs = [
    { id: 'book',    label: 'Book',     icon: 'homeic' },
    { id: 'history', label: 'Bookings', icon: 'list'   },
    { id: 'profile', label: 'Profile',  icon: 'user'   },
  ];
  return (
    <div style={{
      height: 64, flexShrink: 0,
      background: M.surface,
      borderTop: `1px solid ${M.divider}`,
      display: 'flex',
      paddingTop: 4,
    }}>
      {tabs.map(({ id, label, icon }) => {
        const active = id === 'book';
        return (
          <div key={id} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start', gap: 3,
          }}>
            <div style={{
              width: 56, height: 28, borderRadius: 14,
              background: active ? M.accentSoft : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .2s',
            }}>
              <Ic name={icon} size={20} color={active ? M.accentDeep : M.textDim} weight={2} />
            </div>
            <span style={{
              fontSize: 10.5,
              fontWeight: active ? 700 : 500,
              color: active ? M.accentDeep : M.textDim,
              letterSpacing: '.01em',
            }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────────────
function FilledBtn({ children, onClick, disabled, icon }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 52,
      background: disabled ? M.borderHi : M.text,
      color: disabled ? M.textMute : '#fff',
      border: 'none', borderRadius: 14,
      fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: disabled ? 'none' : '0 4px 20px rgba(15,23,42,.18), 0 1px 2px rgba(15,23,42,.1)',
      transition: 'all .2s',
    }}>
      {children}
      {!disabled && <Ic name="arrow" size={18} color="#fff" weight={2.2} />}
    </button>
  );
}

function AccentBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 52,
      background: disabled ? M.borderHi : `linear-gradient(135deg, ${M.accent} 0%, ${M.accentDark} 100%)`,
      color: disabled ? M.textMute : '#fff',
      border: 'none', borderRadius: 14,
      fontSize: 15, fontWeight: 700, fontFamily: 'var(--font)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: disabled ? 'none' : `0 6px 24px ${M.accent}55, 0 1px 2px ${M.accentDeep}40`,
      transition: 'all .2s',
    }}>
      {children}
      {!disabled && <Ic name="arrow" size={18} color="#fff" weight={2.2} />}
    </button>
  );
}

function OutlinedBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', height: 52,
      background: M.surface, color: M.text,
      border: `1.5px solid ${M.border}`, borderRadius: 14,
      fontSize: 14, fontWeight: 600, fontFamily: 'var(--font)',
      cursor: 'pointer',
    }}>
      {children}
    </button>
  );
}

// ── Cards & primitives ────────────────────────────────────────────────────────
function MCard({ children, style, padded = true }) {
  return (
    <div style={{
      background: M.surface, borderRadius: 18,
      border: `1px solid ${M.border}`,
      boxShadow: '0 1px 3px rgba(15,23,42,.04), 0 1px 2px rgba(15,23,42,.03)',
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  );
}

function Pill({ label, color, bg, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg || M.surfaceVar,
      color:      color || M.textMute,
      borderRadius: 20, padding: '4px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {icon && <Ic name={icon} size={11} color={color || M.textMute} weight={2.4} />}
      {label}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 1 · HOME
// ════════════════════════════════════════════════════════════════════════════════
function HomeScreen({ onSubmit }) {
  const [query, setQuery] = useState('');
  const [city,  setCity]  = useState('Islamabad');
  const [focus, setFocus] = useState(false);

  const isUrdu      = /[\u0600-\u06FF]/.test(query);
  const isRomanUrdu = !isUrdu && /mujhe|chahiye|subah|mein|kal|aaj/i.test(query);
  const langLabel   = isUrdu ? 'Urdu' : isRomanUrdu ? 'Roman Urdu' : query.length > 3 ? 'English' : null;

  return (
    <div style={{ background: M.bg, minHeight: '100%', paddingBottom: 8 }}>
      {/* Greeting */}
      <div style={{ padding: '20px 18px 18px' }}>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: M.text,
          lineHeight: 1.15, letterSpacing: '-.02em', marginBottom: 4,
        }}>
          Hi there.
        </h1>
        <p style={{ fontSize: 15, color: M.textMute, fontWeight: 500 }}>
          How can I help today?
        </p>
      </div>

      {/* Hero input card */}
      <div style={{ padding: '0 14px' }}>
        <MCard style={{
          position: 'relative',
          border: focus ? `1.5px solid ${M.accent}` : `1px solid ${M.border}`,
          boxShadow: focus
            ? `0 8px 28px ${M.accent}22, 0 1px 3px rgba(15,23,42,.06)`
            : '0 2px 8px rgba(15,23,42,.05)',
          transition: 'all .25s',
        }}>
          {/* Top accent strip */}
          <div style={{
            height: 3, background: `linear-gradient(90deg, ${M.accent} 0%, ${M.agent} 100%)`,
            opacity: focus ? 1 : 0.35, transition: 'opacity .25s',
          }} />

          <div style={{ padding: '14px 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 9,
                background: M.accentSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic name="sparkle" size={15} color={M.accentDeep} fill />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: M.text, lineHeight: 1.1 }}>
                  Service request
                </div>
                <div style={{ fontSize: 11, color: M.textMute, marginTop: 1 }}>
                  Describe what you need · any language
                </div>
              </div>
            </div>

            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              placeholder="e.g. Mujhe kal subah G-13 mein AC technician chahiye"
              rows={3}
              style={{
                width: '100%', resize: 'none',
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: 14, fontFamily: 'var(--font)',
                color: M.text, lineHeight: 1.55,
                direction: isUrdu ? 'rtl' : 'ltr',
              }}
            />

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderTop: `1px solid ${M.divider}`, paddingTop: 8, marginTop: 2,
            }}>
              <span style={{ fontSize: 11, color: M.textDim, fontWeight: 500 }}>
                {query.length} chars
              </span>
              {langLabel && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: M.agentBg, color: M.agent,
                  borderRadius: 6, padding: '3px 9px',
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
                  textTransform: 'uppercase',
                }}>
                  <Ic name="globe" size={11} color={M.agent} weight={2.4} />
                  {langLabel}
                </span>
              )}
            </div>
          </div>
        </MCard>

        {/* City row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: M.surface, borderRadius: 14,
          border: `1px solid ${M.border}`,
          padding: '0 14px', height: 48,
          marginTop: 10,
        }}>
          <Ic name="pin" size={18} color={M.textMute} />
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, fontFamily: 'var(--font)', color: M.text,
              fontWeight: 600, cursor: 'pointer', appearance: 'none',
            }}
          >
            {['Islamabad','Rawalpindi','Lahore','Karachi'].map(c => <option key={c}>{c}</option>)}
          </select>
          <Ic name="chev" size={16} color={M.textDim} weight={2} />
        </div>
      </div>

      {/* Categories */}
      <div style={{ padding: '22px 14px 0' }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: M.textDim,
          letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Popular services
        </p>
        <div style={{
          display: 'flex', gap: 8, overflowX: 'auto',
          paddingBottom: 4, scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setQuery(`Need ${c.label.toLowerCase()} `)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: M.surface, border: `1px solid ${M.border}`,
                borderRadius: 14, padding: '10px 4px',
                width: 64, flexShrink: 0,
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic name={c.icon} size={18} color={c.color} weight={2} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: M.text }}>{c.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Examples */}
      <div style={{ padding: '20px 14px 12px' }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: M.textDim,
          letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          Try one of these
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EXAMPLES.map((ex, i) => {
            const isAr = /[\u0600-\u06FF]/.test(ex);
            const sel = query === ex;
            return (
              <button key={i} onClick={() => setQuery(ex)} style={{
                background: sel ? M.accentSoft : M.surface,
                color: sel ? M.accentDeep : M.text,
                border: `1px solid ${sel ? M.accent : M.border}`,
                borderRadius: 12, padding: '11px 14px',
                textAlign: isAr ? 'right' : 'left',
                fontSize: 13, fontFamily: 'var(--font)',
                fontWeight: sel ? 600 : 400,
                cursor: 'pointer', direction: isAr ? 'rtl' : 'ltr',
                lineHeight: 1.4,
              }}>
                {ex}
              </button>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '8px 14px 16px' }}>
        <AccentBtn onClick={() => onSubmit(query || MDATA.query)}>
          Find a provider
        </AccentBtn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 2 · LOADING (refined with AI orb)
// ════════════════════════════════════════════════════════════════════════════════
function MLoadingScreen({ step }) {
  const progress = Math.min(step / 6, 1);
  return (
    <div style={{
      padding: '32px 18px', animation: 'fadeUp .4s ease',
      display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '70%',
    }}>
      {/* AI Orb */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: `conic-gradient(from 0deg, ${M.accent}, ${M.agent}, ${M.purple}, ${M.accent})`,
          animation: 'spin 2.4s linear infinite',
          padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: M.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ic name="sparkle" size={32} color={M.accentDeep} fill />
          </div>
        </div>
        <div style={{
          position: 'absolute', inset: -8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${M.accent}22 0%, transparent 70%)`,
          animation: 'pulseRing 2s infinite', zIndex: -1,
        }} />
      </div>

      {/* Label */}
      <p style={{
        fontSize: 17, fontWeight: 700, color: M.text,
        textAlign: 'center', marginBottom: 4, letterSpacing: '-.01em',
      }}>
        {step < LOAD_LABELS.length ? LOAD_LABELS[step] : 'All done!'}
      </p>
      <p style={{ fontSize: 13, color: M.textMute, textAlign: 'center', marginBottom: 24 }}>
        Step {Math.min(step + 1, 6)} of 6
      </p>

      {/* Progress bar */}
      <div style={{
        width: '100%', maxWidth: 280,
        height: 4, background: M.divider, borderRadius: 2, overflow: 'hidden', marginBottom: 28,
      }}>
        <div style={{
          width: `${progress * 100}%`, height: '100%',
          background: `linear-gradient(90deg, ${M.accent}, ${M.agent})`,
          borderRadius: 2, transition: 'width .4s ease',
        }} />
      </div>

      {/* Step pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {LOAD_LABELS.map((label, i) => {
          const done = i < step, cur = i === step;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 12px', borderRadius: 10,
              background: cur ? M.accentBg : 'transparent',
              opacity: done || cur ? 1 : 0.4, transition: 'all .3s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: done ? M.success : cur ? M.accent : M.borderHi,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {done && <Ic name="check" size={11} color="#fff" weight={3} />}
                {cur && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </div>
              <span style={{ fontSize: 13, fontWeight: cur ? 600 : 500, color: cur ? M.accentDeep : M.textMute }}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 3 · UNDERSTANDING
// ════════════════════════════════════════════════════════════════════════════════
function MUnderstandingScreen({ onContinue, onEdit }) {
  const u = MDATA.understanding;
  const rows = [
    { icon: 'snow',  label: 'Service',     value: u.serviceType,     color: '#2563EB', bg: '#EFF6FF' },
    { icon: 'pin',   label: 'Location',    value: u.location,        color: M.text,    bg: M.surfaceVar },
    { icon: 'cal',   label: 'Date',        value: u.dateFull,        color: M.text,    bg: M.surfaceVar },
    { icon: 'clock', label: 'Time',        value: u.timeWindowLabel, color: M.text,    bg: M.surfaceVar },
    { icon: 'globe', label: 'Language',    value: u.detectedLanguage, color: M.text,   bg: M.surfaceVar },
  ];
  return (
    <div style={{ padding: '16px 14px 24px', animation: 'slideInRight .28s ease' }}>
      {/* Original query bubble */}
      <div style={{
        background: M.surfaceLow, borderRadius: 12, padding: '11px 14px',
        marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
        border: `1px solid ${M.divider}`,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0,
          background: M.purpleBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic name="msg" size={13} color={M.purple} weight={2} />
        </div>
        <span style={{ fontSize: 13, color: M.textMute, fontStyle: 'italic', lineHeight: 1.5 }}>
          "{MDATA.query}"
        </span>
      </div>

      {/* Parsed card */}
      <MCard style={{ marginBottom: 12 }}>
        {/* Header with confidence ring */}
        <div style={{
          padding: '14px 16px', borderBottom: `1px solid ${M.divider}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: M.textDim, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Parsed by AI
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.text, marginTop: 2 }}>
              {u.confidence}% confident
            </div>
          </div>
          <ConfidenceRing value={u.confidence} />
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            borderBottom: i < rows.length - 1 ? `1px solid ${M.divider}` : 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: r.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ic name={r.icon} size={16} color={r.color} weight={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: M.textDim, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                {r.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: M.text, marginTop: 1 }}>
                {r.value}
              </div>
            </div>
          </div>
        ))}
      </MCard>

      {/* AI note */}
      <div style={{
        background: `linear-gradient(135deg, ${M.agentBg} 0%, ${M.purpleBg} 100%)`,
        border: `1px solid ${M.agent}30`,
        borderRadius: 14, padding: '12px 14px', marginBottom: 18,
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: '#fff', boxShadow: `0 2px 6px ${M.agent}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic name="sparkle" size={14} color={M.agent} fill />
        </div>
        <span style={{ fontSize: 13, color: '#3730A3', lineHeight: 1.5 }}>
          Searching for a <strong>high-rated AC technician</strong> near <strong>G-13</strong>{' '}
          available <strong>tomorrow morning</strong>.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <AccentBtn onClick={onContinue}>Find providers</AccentBtn>
        <OutlinedBtn onClick={onEdit}>Edit details</OutlinedBtn>
      </div>
    </div>
  );
}

// Confidence ring SVG
function ConfidenceRing({ value }) {
  const r = 18, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r={r} stroke={M.divider} strokeWidth="3" fill="none" />
      <circle cx="22" cy="22" r={r} stroke={M.accent} strokeWidth="3" fill="none"
        strokeDasharray={c} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill={M.text} fontFamily="var(--font)">
        {value}
      </text>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 4 · RECOMMENDATION
// ════════════════════════════════════════════════════════════════════════════════
function MRecommendationScreen({ onConfirm }) {
  const [showAlt, setShowAlt] = useState(false);
  const p = MDATA.provider;
  return (
    <div style={{ padding: '16px 14px 24px', animation: 'slideInRight .28s ease' }}>
      {/* Provider hero */}
      <MCard style={{ marginBottom: 12 }}>
        <div style={{ padding: '18px 16px 14px' }}>
          {/* Avatar + identity */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
            <Avatar initials={p.initials} gradient={p.gradient} size={54} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: M.text, letterSpacing: '-.01em' }}>{p.name}</h3>
                {p.verified && <Ic name="shield" size={14} color={M.accent} fill />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Ic name="star" size={13} color={M.amber} fill />
                <span style={{ fontWeight: 700, fontSize: 13, color: M.text }}>{p.rating}</span>
                <span style={{ fontSize: 12, color: M.textMute }}>· {p.reviews} reviews · {p.yearsActive} yrs</span>
              </div>
            </div>
            <span style={{
              background: M.accentSoft, color: M.accentDeep,
              fontSize: 10, fontWeight: 800, padding: '4px 9px',
              borderRadius: 7, letterSpacing: '.06em', textTransform: 'uppercase',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              alignSelf: 'flex-start', flexShrink: 0,
            }}>
              <Ic name="sparkle" size={10} color={M.accentDeep} fill /> AI
            </span>
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            background: M.surfaceLow, border: `1px solid ${M.divider}`,
            borderRadius: 12, overflow: 'hidden', marginBottom: 14,
          }}>
            {[
              { icon: 'pin',   label: 'Distance',  value: p.distance },
              { icon: 'clock', label: 'Available', value: p.availability },
              { icon: 'flow',  label: 'Jobs',      value: `${p.completedJobs}+` },
            ].map((s, i, arr) => (
              <div key={i} style={{
                padding: '10px 4px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? `1px solid ${M.divider}` : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 3 }}>
                  <Ic name={s.icon} size={14} color={M.textDim} weight={2} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: M.text }}>{s.value}</div>
                <div style={{ fontSize: 10, color: M.textMute, marginTop: 1 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Why */}
          <p style={{ fontSize: 10, fontWeight: 700, color: M.textDim, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 7 }}>
            Why this provider
          </p>
          <p style={{ fontSize: 13, color: M.textMute, lineHeight: 1.55, marginBottom: 10 }}>{p.description}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {p.reasons.map((r, i) => (
              <Pill key={i} label={r} color={M.accentDeep} bg={M.accentSoft} icon="check" />
            ))}
          </div>
        </div>

        {/* Match score footer */}
        <div style={{
          background: `linear-gradient(135deg, ${M.accentSoft} 0%, ${M.accentBg} 100%)`,
          padding: '12px 16px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          borderTop: `1px solid ${M.divider}`,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: M.accentDeep, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Match Score
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: M.accentDeep, lineHeight: 1, marginTop: 2 }}>
              {p.score}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            color: M.accentDeep, fontSize: 11, fontWeight: 700,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: M.accent }} />
            EXCELLENT MATCH
          </div>
        </div>
      </MCard>

      {/* Alternatives */}
      <button onClick={() => setShowAlt(v => !v)} style={{
        background: 'none', border: 'none', color: M.text, fontSize: 13, fontWeight: 700,
        fontFamily: 'var(--font)', cursor: 'pointer', padding: '8px 0',
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, width: '100%',
        justifyContent: 'space-between',
      }}>
        <span>Other options · {MDATA.alternatives.length}</span>
        <span style={{ display: 'inline-block', transform: showAlt ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
          <Ic name="chev" size={16} color={M.textMute} weight={2} />
        </span>
      </button>

      {showAlt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, animation: 'fadeUp .25s ease' }}>
          {MDATA.alternatives.map((alt, i) => (
            <MCard key={i} style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Avatar initials={alt.initials} gradient={alt.gradient} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{alt.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Ic name="star" size={11} color={M.amber} fill />
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{alt.rating}</span>
                    <span style={{ fontSize: 11, color: M.textMute }}>· {alt.distance} · {alt.availability}</span>
                  </div>
                  <p style={{ fontSize: 11, color: M.textMute }}>{alt.note}</p>
                </div>
                <span style={{
                  background: M.surfaceLow, color: M.textMute,
                  fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                  fontFamily: 'var(--font-mono)',
                }}>{alt.score}</span>
              </div>
            </MCard>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <AccentBtn onClick={onConfirm}>Confirm booking</AccentBtn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 5 · BOOKING
// ════════════════════════════════════════════════════════════════════════════════
function MBookingScreen({ onViewTrace, onRestart }) {
  const b = MDATA.booking;
  const p = MDATA.provider;
  return (
    <div style={{ padding: '12px 14px 24px', animation: 'slideInRight .28s ease' }}>
      {/* Success header */}
      <div style={{ textAlign: 'center', padding: '20px 0 22px' }}>
        <div style={{
          position: 'relative', width: 76, height: 76, margin: '0 auto 14px',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(circle, ${M.success}33 0%, transparent 70%)`,
            borderRadius: '50%',
          }} />
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            background: '#fff', border: `3px solid ${M.success}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'checkPop .55s ease',
            boxShadow: `0 8px 24px ${M.success}40`,
          }}>
            <Ic name="check" size={32} color={M.success} weight={3.5} />
          </div>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: M.text, marginBottom: 4, letterSpacing: '-.01em' }}>
          You're all set!
        </h2>
        <p style={{ fontSize: 13, color: M.textMute }}>
          Your AI agent completed the booking
        </p>
      </div>

      {/* Provider strip */}
      <MCard style={{ marginBottom: 10 }}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar initials={p.initials} gradient={p.gradient} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{p.name}</span>
              {p.verified && <Ic name="shield" size={12} color={M.accent} fill />}
            </div>
            <div style={{ fontSize: 12, color: M.textMute, marginTop: 1 }}>
              <Ic name="star" size={10} color={M.amber} fill /> {p.rating} · {p.distance}
            </div>
          </div>
          <button style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `1px solid ${M.border}`, background: M.surface,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <Ic name="msg" size={16} color={M.text} />
          </button>
        </div>
      </MCard>

      {/* Booking details */}
      <MCard style={{ marginBottom: 10 }}>
        <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${M.divider}` }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: M.textDim, letterSpacing: '.05em', textTransform: 'uppercase' }}>Booking details</span>
          <span style={{
            background: M.successBg, color: M.success,
            fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
            textTransform: 'uppercase', letterSpacing: '.06em',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: M.success }} />
            Confirmed
          </span>
        </div>
        {[
          { icon: 'cal',   label: 'When',       val: b.slot },
          { icon: 'pin',   label: 'Location',   val: b.location },
          { icon: 'flow',  label: 'Booking ID', val: b.bookingId, mono: true },
        ].map((r, i, a) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px',
            borderBottom: i < a.length - 1 ? `1px solid ${M.divider}` : 'none',
          }}>
            <Ic name={r.icon} size={16} color={M.textMute} weight={2} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: M.textDim, fontWeight: 600 }}>{r.label}</div>
              <div style={{
                fontSize: r.mono ? 12 : 13, fontWeight: 700, color: M.text, marginTop: 1,
                fontFamily: r.mono ? 'var(--font-mono)' : 'inherit',
              }}>{r.val}</div>
            </div>
          </div>
        ))}
      </MCard>

      {/* Reminder pill */}
      <div style={{
        background: M.purpleBg, border: `1px solid ${M.purple}30`,
        borderRadius: 14, padding: '11px 14px', marginBottom: 14,
        display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: '#fff', boxShadow: `0 2px 6px ${M.purple}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ic name="alarm" size={15} color={M.purple} weight={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#5B21B6' }}>Reminder scheduled</div>
          <div style={{ fontSize: 12, color: '#7C3AED', marginTop: 1 }}>9:00 AM tomorrow · 1 hr before arrival</div>
        </div>
      </div>

      {/* Agent completion */}
      <MCard style={{ marginBottom: 18, background: M.surfaceLow, border: 'none' }}>
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Ic name="sparkle" size={12} color={M.accentDeep} fill />
            <span style={{ fontSize: 10, fontWeight: 700, color: M.textDim, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Agent actions completed
            </span>
          </div>
          {['Booking created', 'Reminder scheduled', 'Trace generated'].map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 9,
              paddingTop: i > 0 ? 7 : 0,
              animation: `fadeIn .3s ease ${i * .12}s both`,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: M.success, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ic name="check" size={11} color="#fff" weight={3} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: M.text }}>{s}</span>
            </div>
          ))}
        </div>
      </MCard>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <FilledBtn onClick={onViewTrace}>View agent trace</FilledBtn>
        <OutlinedBtn onClick={onRestart}>Start another request</OutlinedBtn>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SCREEN 6 · TRACE (refined)
// ════════════════════════════════════════════════════════════════════════════════
function MTraceScreen() {
  return (
    <div style={{ padding: '16px 14px 24px', animation: 'slideInRight .28s ease' }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${M.primary} 0%, ${M.primaryGrad} 100%)`,
        borderRadius: 16, padding: '16px 16px 14px', marginBottom: 14,
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Ic name="cpu" size={14} color={M.accent} weight={2} />
          <span style={{ fontSize: 11, fontWeight: 700, color: M.accent, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Agentic Workflow
          </span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, letterSpacing: '-.01em' }}>
          6 agents · 6 tools
        </h2>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5, marginBottom: 10 }}>
          How your request became a confirmed booking
        </p>
        <div style={{
          background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 8, padding: '6px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Trace ID</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#fff' }}>TRC-20260517-001</span>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {MDATA.trace.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: i < MDATA.trace.length - 1 ? 14 : 0 }}>
            {/* Dot + connector */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: `linear-gradient(135deg, ${ev.color} 0%, ${ev.color}cc 100%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${ev.color}40`,
              }}>
                <Ic name={ev.icon} size={16} color="#fff" weight={2.2} fill={ev.icon === 'sparkle' || ev.icon === 'star'} />
              </div>
              {i < MDATA.trace.length - 1 && (
                <div style={{ width: 2, flex: 1, background: M.divider, marginTop: 4, minHeight: 24 }} />
              )}
            </div>
            {/* Content */}
            <MCard style={{ flex: 1, marginBottom: 0, padding: '11px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: M.text, letterSpacing: '-.01em' }}>{ev.agent}</span>
                <span style={{
                  background: M.successBg, color: M.success,
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                  letterSpacing: '.05em', textTransform: 'uppercase', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <Ic name="check" size={8} color={M.success} weight={3} /> OK
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 10.5 }}>
                <span style={{ color: M.textDim }}>
                  <span style={{ color: M.textMute, fontWeight: 600 }}>tool</span> {ev.tool}
                </span>
                <span style={{ color: M.borderHi }}>·</span>
                <span style={{ color: M.textDim }}>
                  <span style={{ color: M.textMute, fontWeight: 600 }}>via</span> {ev.source}
                </span>
              </div>
              <div style={{
                background: M.surfaceLow, border: `1px solid ${M.divider}`,
                borderRadius: 6, padding: '6px 9px',
                fontSize: 11, color: M.textMute, lineHeight: 1.5,
                fontFamily: 'var(--font-mono)',
              }}>
                {ev.output}
              </div>
            </MCard>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// APP
// ════════════════════════════════════════════════════════════════════════════════
const MOBILE_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "animSpeed": "normal",
  "frameWidth": 393
}/*EDITMODE-END*/;

function AiseekhoMobileApp({ animSpeed }) {
  const [screen,   setScreen]   = useState('home');
  const [loadStep, setLoadStep] = useState(0);
  const [navDir,   setNavDir]   = useState('forward');

  const bars = {
    home:           { title: 'AISEEKHO',           back: null,            sub: 'AI Service Agent' },
    loading:        { title: 'Working on it…',     back: null,            sub: null },
    understanding:  { title: 'Your request',       back: 'home',          sub: 'AI understood this' },
    recommendation: { title: 'Best match',         back: 'understanding', sub: 'Top of 3 providers' },
    booking:        { title: 'Confirmed',          back: null,            sub: 'Booking complete' },
    trace:          { title: 'Agent trace',        back: 'booking',       sub: '6 steps · all successful' },
  };
  const bar = bars[screen] || { title: '', back: null };

  const go = useCallback((dest, dir = 'forward') => {
    setNavDir(dir); setScreen(dest);
  }, []);

  const runLoad = useCallback((onDone) => {
    go('loading');
    setLoadStep(0);
    const delay = animSpeed === 'fast' ? 280 : animSpeed === 'slow' ? 650 : 460;
    let s = 0;
    const id = setInterval(() => {
      s++; setLoadStep(s);
      if (s >= 6) { clearInterval(id); setTimeout(onDone, 260); }
    }, delay);
  }, [go, animSpeed]);

  const onSubmit   = useCallback(() => runLoad(() => go('understanding')), [runLoad, go]);
  const onContinue = useCallback(() => runLoad(() => go('recommendation')), [runLoad, go]);
  const onConfirm  = useCallback(() => {
    go('loading'); setLoadStep(4);
    const d = animSpeed === 'fast' ? 280 : 440;
    setTimeout(() => setLoadStep(5), d);
    setTimeout(() => setLoadStep(6), d * 2);
    setTimeout(() => go('booking'), d * 2 + 260);
  }, [go, animSpeed]);

  // Top bar right action
  const topAction = screen === 'home' ? (
    <button style={{
      width: 40, height: 40, borderRadius: '50%',
      border: 'none', background: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginRight: 4, position: 'relative',
    }}>
      <Ic name="bell" size={20} color={M.text} />
      <span style={{
        position: 'absolute', top: 9, right: 11,
        width: 6, height: 6, borderRadius: '50%', background: M.accent,
        boxShadow: `0 0 0 2px ${M.surface}`,
      }} />
    </button>
  ) : null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: M.bg }}>
      <TopBar
        title={bar.title}
        subtitle={bar.sub}
        onBack={bar.back ? () => go(bar.back, 'back') : null}
        action={topAction}
      />
      <div
        key={screen}
        style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          animation: `${navDir === 'forward' ? 'slideInRight' : 'slideInLeft'} .28s ease`,
        }}
      >
        {screen === 'home'           && <HomeScreen           onSubmit={onSubmit} />}
        {screen === 'loading'        && <MLoadingScreen       step={loadStep} />}
        {screen === 'understanding'  && <MUnderstandingScreen onContinue={onContinue} onEdit={() => go('home', 'back')} />}
        {screen === 'recommendation' && <MRecommendationScreen onConfirm={onConfirm} />}
        {screen === 'booking'        && <MBookingScreen       onViewTrace={() => go('trace')} onRestart={() => go('home', 'back')} />}
        {screen === 'trace'          && <MTraceScreen />}
      </div>
      <BottomNav />
    </div>
  );
}

function MobileRoot() {
  const [t, setTweak] = useTweaks(MOBILE_TWEAK_DEFAULTS);
  return (
    <div style={{
      minHeight: '100vh', background: '#0C1525',
      backgroundImage: 'radial-gradient(ellipse 70% 55% at 12% 20%, rgba(16,185,129,.10) 0%, transparent 100%), radial-gradient(ellipse 55% 65% at 88% 80%, rgba(99,102,241,.10) 0%, transparent 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', fontFamily: 'var(--font)',
    }}>
      <div>
        <AndroidDevice width={t.frameWidth} height={852}>
          <AiseekhoMobileApp animSpeed={t.animSpeed} />
        </AndroidDevice>
        <p style={{ textAlign: 'center', marginTop: 18, color: 'rgba(255,255,255,.25)', fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          AISEEKHO · Android Prototype
        </p>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Device">
          <TweakSlider label="Frame width" value={t.frameWidth} min={320} max={460} step={1} unit="px" onChange={v => setTweak('frameWidth', v)} />
        </TweakSection>
        <TweakSection label="Animation">
          <TweakRadio label="Speed" value={t.animSpeed} options={['fast','normal','slow']} onChange={v => setTweak('animSpeed', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<MobileRoot />);
