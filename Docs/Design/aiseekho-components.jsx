// aiseekho-components.jsx — shared design tokens + UI primitives
const { useState } = React;

// ── Design tokens (mirrors CSS vars for inline use) ──────────────────────────
const T = {
  primary:   '#1E293B',
  accent:    '#10B981',
  accentLt:  '#ECFDF5',
  accentDk:  '#059669',
  bg:        '#F1F5F9',
  card:      '#FFFFFF',
  text:      '#0F172A',
  muted:     '#64748B',
  border:    '#E2E8F0',
  success:   '#22C55E',
  successBg: '#F0FDF4',
  warning:   '#F59E0B',
  warnBg:    '#FFFBEB',
  error:     '#EF4444',
  agent:     '#3B82F6',
  agentBg:   '#EFF6FF',
  purple:    '#8B5CF6',
  purpleBg:  '#F5F3FF',
};

// ── Logo ─────────────────────────────────────────────────────────────────────
function AiseekhoLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="16,2 28,9.5 28,22.5 16,30 4,22.5 4,9.5"
               stroke={T.accent} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="3.5" fill={T.accent} />
      <line x1="16" y1="5.5"  x2="16" y2="12"   stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="16" y1="20"   x2="16" y2="26.5"  stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="6"  y1="11"   x2="12.2" y2="14"  stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="19.8" y1="18" x2="26" y2="21"    stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26"  y1="11"  x2="19.8" y2="14"  stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12.2" y1="18" x2="6"  y2="21"    stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── App Header ────────────────────────────────────────────────────────────────
function AppHeader({ onToggleDemo, demoMode }) {
  return (
    <header style={{
      background:    T.primary,
      height:        60,
      padding:       '0 20px',
      display:       'flex',
      alignItems:    'center',
      justifyContent:'space-between',
      position:      'sticky',
      top:           0,
      zIndex:        100,
      boxShadow:     '0 2px 16px rgba(0,0,0,.25)',
      flexShrink:    0,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <AiseekhoLogo />
        <div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.07em', lineHeight:1 }}>
            AISEEKHO
          </div>
          <div style={{ color:T.accent, fontSize:10, fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginTop:2 }}>
            AI Service Agent
          </div>
        </div>
      </div>

      <button
        onClick={onToggleDemo}
        style={{
          background:    demoMode ? T.accent : 'rgba(255,255,255,.07)',
          color:         demoMode ? '#fff'   : 'rgba(255,255,255,.55)',
          border:        `1px solid ${demoMode ? T.accent : 'rgba(255,255,255,.14)'}`,
          borderRadius:  7,
          padding:       '5px 14px',
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          cursor:        'pointer',
          fontFamily:    'inherit',
          transition:    'all .2s',
        }}
      >
        {demoMode ? '✕ Exit Demo' : 'Demo Mode'}
      </button>
    </header>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────
const STEP_LABELS = ['Request','Review','Match','Booked','Trace'];
const SCREEN_STEP = {
  input:0, loading:0, understanding:1, recommendation:2, booking:3, trace:4,
};

function StepIndicator({ screen }) {
  const active = SCREEN_STEP[screen] ?? 0;
  return (
    <div style={{
      background:   T.card,
      borderBottom: `1px solid ${T.border}`,
      padding:      '12px 16px 10px',
      flexShrink:   0,
    }}>
      <div style={{ display:'flex', alignItems:'center', maxWidth:480, margin:'0 auto' }}>
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={i}>
            {i > 0 && (
              <div style={{
                flex:       1,
                height:     2,
                background: i <= active ? T.accent : T.border,
                transition: 'background .4s ease',
                margin:     '0 3px',
              }} />
            )}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, flexShrink:0 }}>
              <div style={{
                width:      24,
                height:     24,
                borderRadius:'50%',
                background: i <= active ? T.accent : T.border,
                display:    'flex',
                alignItems: 'center',
                justifyContent:'center',
                transition: 'all .3s',
                animation:  i === active ? 'pulseRing 2s infinite' : 'none',
              }}>
                {i < active ? (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4 3.5 6.5 9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span style={{ color:'#fff', fontSize:10, fontWeight:700, lineHeight:1 }}>{i+1}</span>
                )}
              </div>
              <span style={{
                fontSize:      9,
                fontWeight:    i === active ? 700 : 500,
                color:         i === active ? T.accent : i < active ? T.muted : T.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick, disabled }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:         '100%',
        background:    disabled ? T.border : hov ? T.accentDk : T.accent,
        color:         disabled ? T.muted  : '#fff',
        border:        'none',
        borderRadius:  12,
        padding:       '15px 24px',
        fontSize:      15,
        fontWeight:    700,
        fontFamily:    'inherit',
        cursor:        disabled ? 'not-allowed' : 'pointer',
        transition:    'all .18s',
        transform:     hov && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow:     hov && !disabled ? `0 8px 24px ${T.accent}44` : 'none',
        letterSpacing: '.01em',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width:       '100%',
        background:  hov ? T.bg : 'transparent',
        color:       T.text,
        border:      `1.5px solid ${T.border}`,
        borderRadius:12,
        padding:     '14px 24px',
        fontSize:    15,
        fontWeight:  600,
        fontFamily:  'inherit',
        cursor:      'pointer',
        transition:  'all .18s',
      }}
    >
      {children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ children, style, anim }) {
  return (
    <div style={{
      background:   T.card,
      borderRadius: 16,
      border:       `1px solid ${T.border}`,
      boxShadow:    '0 1px 6px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)',
      padding:      '20px',
      animation:    anim ? 'fadeUp .45s ease' : undefined,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }) {
  return (
    <span style={{
      display:       'inline-flex',
      alignItems:    'center',
      background:    bg || T.agentBg,
      color:         color || T.agent,
      borderRadius:  6,
      padding:       '3px 8px',
      fontSize:      11,
      fontWeight:    700,
      letterSpacing: '.03em',
      textTransform: 'uppercase',
      whiteSpace:    'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
      <span style={{ color:T.warning, fontSize:13 }}>★</span>
      <span style={{ fontWeight:700, fontSize:13 }}>{rating}</span>
    </span>
  );
}

// ── Reason chip ───────────────────────────────────────────────────────────────
function ReasonChip({ label }) {
  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         4,
      background:  T.accentLt,
      color:       T.accentDk,
      borderRadius:20,
      padding:     '4px 10px',
      fontSize:    12,
      fontWeight:  600,
      border:      '1px solid #A7F3D0',
    }}>
      <span style={{ fontSize:10 }}>✓</span> {label}
    </span>
  );
}

// ── Loading sequence ──────────────────────────────────────────────────────────
const LOAD_STEPS = [
  { label:'Understanding request',   sub:'Parsing language and intent...' },
  { label:'Resolving location',      sub:'Finding G-13, Islamabad...' },
  { label:'Discovering providers',   sub:'Searching AC technicians nearby...' },
  { label:'Ranking options',         sub:'Scoring availability, distance, rating...' },
  { label:'Creating booking',        sub:'Reserving slot with top provider...' },
  { label:'Scheduling reminder',     sub:'Setting reminder for 9:00 AM...' },
];

function LoadingSequence({ step }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {LOAD_STEPS.map((s, i) => {
        const done = i < step;
        const cur  = i === step;
        return (
          <div key={i} style={{
            display:    'flex',
            alignItems: 'center',
            gap:        12,
            opacity:    done || cur ? 1 : 0.28,
            transition: 'opacity .35s',
          }}>
            <div style={{
              width:          30,
              height:         30,
              borderRadius:   '50%',
              background:     done ? T.successBg : cur ? T.agentBg : T.bg,
              border:         `2px solid ${done ? T.success : cur ? T.agent : T.border}`,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              transition:     'all .3s',
            }}>
              {done ? (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1.5 5 4.5 8 10.5 1.5" stroke={T.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : cur ? (
                <div style={{ width:12, height:12, border:`2px solid ${T.agent}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite' }} />
              ) : (
                <div style={{ width:6, height:6, borderRadius:'50%', background:T.border }} />
              )}
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight: cur ? 700 : done ? 500 : 400, color: cur ? T.text : T.muted }}>
                {s.label}
              </div>
              {cur && (
                <div style={{ fontSize:12, color:T.agent, marginTop:2, animation:'fadeIn .3s' }}>{s.sub}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Trace timeline ────────────────────────────────────────────────────────────
const AGENT_PAL = {
  IntentUnderstandingAgent: { c:'#8B5CF6', bg:'#F5F3FF' },
  LocationResolutionAgent:  { c:'#3B82F6', bg:'#EFF6FF' },
  ProviderDiscoveryAgent:   { c:'#0EA5E9', bg:'#F0F9FF' },
  ProviderRankingAgent:     { c:'#F59E0B', bg:'#FFFBEB' },
  BookingAgent:             { c:'#10B981', bg:'#ECFDF5' },
  FollowUpAgent:            { c:'#22C55E', bg:'#F0FDF4' },
};

function TraceTimeline({ events }) {
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      {events.map((ev, i) => {
        const pal = AGENT_PAL[ev.agent] || { c:T.agent, bg:T.agentBg };
        return (
          <div key={i} style={{ display:'flex', gap:12, paddingBottom: i < events.length-1 ? 16 : 0 }}>
            {/* Dot + connector */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div style={{
                width:          30,
                height:         30,
                borderRadius:   '50%',
                background:     pal.bg,
                border:         `2px solid ${pal.c}`,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                fontSize:       11,
                fontWeight:     800,
                color:          pal.c,
              }}>
                {i + 1}
              </div>
              {i < events.length - 1 && (
                <div style={{ width:2, flex:1, background:T.border, marginTop:6 }} />
              )}
            </div>
            {/* Content */}
            <div style={{
              flex:         1,
              background:   T.bg,
              border:       `1px solid ${T.border}`,
              borderRadius: 10,
              padding:      '12px 14px',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:700, color:T.text, lineHeight:1.3, wordBreak:'break-word' }}>
                  {ev.agent}
                </span>
                <span style={{
                  background:    T.successBg,
                  color:         T.success,
                  fontSize:      10,
                  fontWeight:    700,
                  padding:       '2px 6px',
                  borderRadius:  4,
                  textTransform: 'uppercase',
                  letterSpacing: '.05em',
                  flexShrink:    0,
                }}>
                  ✓ {ev.status}
                </span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 12px', marginBottom:8 }}>
                <span style={{ fontSize:11, color:T.muted }}>
                  <span style={{ fontWeight:600, color:T.text }}>Tool: </span>{ev.tool}
                </span>
                <span style={{ fontSize:11, color:T.muted }}>
                  <span style={{ fontWeight:600, color:T.text }}>Source: </span>{ev.source}
                </span>
              </div>
              <div style={{
                background:   T.card,
                border:       `1px solid ${T.border}`,
                borderRadius: 6,
                padding:      '7px 10px',
                fontSize:     11,
                color:        T.muted,
                fontFamily:   'var(--font-mono)',
                lineHeight:   1.5,
              }}>
                {ev.output}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height:1, background:T.border, margin:'4px 0' }} />;
}

// ── Export ────────────────────────────────────────────────────────────────────
Object.assign(window, {
  T, AiseekhoLogo, AppHeader, StepIndicator,
  PrimaryBtn, SecondaryBtn, Card, Badge, Stars,
  ReasonChip, LoadingSequence, TraceTimeline, Divider,
  SCREEN_STEP, LOAD_STEPS, AGENT_PAL,
});
