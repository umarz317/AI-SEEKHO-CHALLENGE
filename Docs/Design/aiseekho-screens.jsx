// aiseekho-screens.jsx — mock data + all 5 screen components
const { useState, useEffect } = React;

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK = {
  query: "Mujhe kal subah G-13 mein AC technician chahiye",

  understanding: {
    serviceType:      "AC Technician",
    location:         "G-13, Islamabad",
    dateLabel:        "Tomorrow (Sat, May 17, 2026)",
    timeWindowLabel:  "9:00 AM – 12:00 PM",
    detectedLanguage: "Roman Urdu",
    confidence:       94,
  },

  provider: {
    name:          "Ali AC Services",
    rating:        4.8,
    reviews:       127,
    distance:      "2.1 km",
    availability:  "10:00 AM",
    completedJobs: 312,
    score:         0.913,
    reasons:       ["Available in requested window", "Nearby", "High rating", "Fast response", "Strong job history"],
    description:   "Closest available high-rated AC technician in G-13 for tomorrow morning.",
  },

  alternatives: [
    { name:"CoolAir Islamabad",  rating:4.9, distance:"5.4 km", availability:"11:30 AM", score:0.871, note:"Higher rating but farther away." },
    { name:"Arctic AC Solutions",rating:4.6, distance:"3.2 km", availability:"2:00 PM",  score:0.822, note:"Closer but afternoon-only." },
  ],

  booking: {
    bookingId:           "BK-20260517-001",
    providerName:        "Ali AC Services",
    slot:                "Saturday, May 17 · 10:00 AM",
    location:            "G-13, Islamabad",
    confirmationMessage: "Booking confirmed with Ali AC Services for 10:00 AM tomorrow.",
    reminderMessage:     "Reminder set for 9:00 AM on May 17 — 1 hour before arrival.",
    fee:                 "Consultation: Free · Service fee quoted on-site",
  },

  trace: [
    { agent:"IntentUnderstandingAgent", tool:"parse_request",     status:"success", source:"Claude Haiku",      output:"Extracted: AC Technician, G-13, tomorrow morning. Language: Roman Urdu. Confidence: 94%." },
    { agent:"LocationResolutionAgent",  tool:"resolve_location",  status:"success", source:"Mock GeoAPI",       output:"G-13 resolved → 33.6844°N, 73.0479°E (Islamabad, Pakistan)." },
    { agent:"ProviderDiscoveryAgent",   tool:"find_providers",    status:"success", source:"Mock Provider DB",  output:"Found 3 AC technicians within 10 km radius available tomorrow morning." },
    { agent:"ProviderRankingAgent",     tool:"rank_providers",    status:"success", source:"Scoring Engine",    output:"Ali AC Services selected: score 0.913 (avail 0.95, proximity 0.91, rating 0.96)." },
    { agent:"BookingAgent",             tool:"create_booking",    status:"success", source:"Mock Booking Store",output:"Booking BK-20260517-001 created. Slot: May 17 @ 10:00 AM. Status: CONFIRMED." },
    { agent:"FollowUpAgent",            tool:"schedule_reminder", status:"success", source:"Mock Scheduler",    output:"Reminder scheduled: May 17, 9:00 AM (1 hour before appointment)." },
  ],
};

const EXAMPLES = [
  "Mujhe kal subah G-13 mein AC technician chahiye",
  "Need plumber in F-10 today evening",
  "Need beautician in F-11 tomorrow afternoon",
  "مجھے آج شام G-6 میں الیکٹریشن چاہیے",
];

// ── Screen 1 · Request Input ──────────────────────────────────────────────────
function InputScreen({ onSubmit }) {
  const [query, setQuery] = useState('');
  const [city,  setCity]  = useState('Islamabad');
  const [focus, setFocus] = useState(false);

  const isUrdu      = /[\u0600-\u06FF]/.test(query);
  const isRomanUrdu = !isUrdu && /mujhe|chahiye|subah|mein|kal|aaj|shaam/i.test(query);
  const langTag = isUrdu      ? { label:'Urdu',       c:T.purple, bg:T.purpleBg }
                : isRomanUrdu ? { label:'Roman Urdu', c:T.agent,  bg:T.agentBg  }
                : query.length > 3 ? { label:'English',    c:T.accent, bg:T.accentLt }
                : null;

  return (
    <div style={{ padding:'24px 20px 48px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>

      {/* Hero */}
      <div style={{ textAlign:'center', marginBottom:28 }}>
        <span style={{
          display:'inline-flex', alignItems:'center', gap:7,
          background:T.accentLt, color:T.accentDk,
          borderRadius:20, padding:'5px 14px',
          fontSize:12, fontWeight:700, marginBottom:14, letterSpacing:'.02em',
        }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:T.accent, display:'inline-block', animation:'pulseRing 2s infinite' }} />
          AI Agent Ready
        </span>
        <h1 style={{ fontSize:28, fontWeight:800, color:T.text, lineHeight:1.2, marginBottom:8 }}>
          Book a local service
        </h1>
        <p style={{ fontSize:14, color:T.muted, lineHeight:1.65 }}>
          Describe what you need in <strong style={{color:T.text}}>English</strong>,{' '}
          <strong style={{color:T.text}}>Urdu</strong>, or{' '}
          <strong style={{color:T.text}}>Roman Urdu</strong>
        </p>
      </div>

      {/* Input card */}
      <Card style={{ marginBottom:14 }}>
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <label style={{ fontSize:13, fontWeight:700, color:T.text }}>What service do you need?</label>
            {langTag && <Badge label={langTag.label} color={langTag.c} bg={langTag.bg} />}
          </div>
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setFocus(false)}
            placeholder="e.g. Mujhe kal subah G-13 mein AC technician chahiye"
            rows={4}
            style={{
              width:'100%', resize:'none',
              border:`2px solid ${focus ? T.accent : T.border}`,
              borderRadius:10, padding:'12px 14px',
              fontSize:14, fontFamily:'var(--font)',
              color:T.text, background:T.bg,
              outline:'none', lineHeight:1.6,
              transition:'border-color .2s',
              direction: isUrdu ? 'rtl' : 'ltr',
            }}
          />
        </div>

        {/* City */}
        <div>
          <label style={{ fontSize:13, fontWeight:700, color:T.text, display:'block', marginBottom:6 }}>City</label>
          <div style={{ position:'relative' }}>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              style={{
                width:'100%', border:`2px solid ${T.border}`,
                borderRadius:10, padding:'11px 14px',
                fontSize:14, fontFamily:'var(--font)',
                color:T.text, background:'#fff',
                outline:'none', cursor:'pointer', appearance:'none',
              }}
            >
              {['Islamabad','Rawalpindi','Lahore','Karachi'].map(c => <option key={c}>{c}</option>)}
            </select>
            <span style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', color:T.muted, pointerEvents:'none', fontSize:12 }}>▾</span>
          </div>
        </div>
      </Card>

      {/* Examples */}
      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>
          Try an example
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {EXAMPLES.map((ex, i) => {
            const isAr = /[\u0600-\u06FF]/.test(ex);
            const sel  = query === ex;
            return (
              <button
                key={i}
                onClick={() => setQuery(ex)}
                style={{
                  background:   sel ? T.accentLt : T.card,
                  border:       `1.5px solid ${sel ? T.accent : T.border}`,
                  borderRadius: 8,
                  padding:      '9px 12px',
                  textAlign:    isAr ? 'right' : 'left',
                  fontSize:     13,
                  color:        sel ? T.accentDk : T.text,
                  fontFamily:   'var(--font)',
                  cursor:       'pointer',
                  fontWeight:   sel ? 600 : 400,
                  transition:   'all .18s',
                  direction:    isAr ? 'rtl' : 'ltr',
                  lineHeight:   1.45,
                }}
              >
                {ex}
              </button>
            );
          })}
        </div>
      </div>

      <PrimaryBtn onClick={() => onSubmit(query || MOCK.query)}>
        Find a provider →
      </PrimaryBtn>
    </div>
  );
}

// ── Screen 2 · Understanding ──────────────────────────────────────────────────
function UnderstandingScreen({ onContinue, onEdit }) {
  const u = MOCK.understanding;
  const rows = [
    { label:'Service',     value:u.serviceType,     accent:true },
    { label:'Location',    value:u.location },
    { label:'Date',        value:u.dateLabel },
    { label:'Time Window', value:u.timeWindowLabel },
    { label:'Language',    value:u.detectedLanguage },
  ];

  return (
    <div style={{ padding:'24px 20px 48px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>
      <div style={{ marginBottom:18 }}>
        <p style={{ fontSize:11, fontWeight:700, color:T.agent, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>
          Step 2 · AI Understanding
        </p>
        <h2 style={{ fontSize:24, fontWeight:800, color:T.text }}>Here's what I understood</h2>
      </div>

      {/* Original query */}
      <div style={{
        background:T.bg, border:`1px solid ${T.border}`, borderRadius:10,
        padding:'10px 14px', marginBottom:16,
        display:'flex', gap:8, alignItems:'flex-start',
      }}>
        <span style={{ fontSize:15, flexShrink:0 }}>💬</span>
        <span style={{ fontSize:13, color:T.muted, fontStyle:'italic', lineHeight:1.5 }}>
          "{MOCK.query}"
        </span>
      </div>

      {/* Parsed card */}
      <Card anim style={{ marginBottom:14 }}>
        {/* Confidence header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
          <span style={{ fontSize:12, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.05em' }}>
            Parsed Request
          </span>
          <span style={{
            display:'inline-flex', alignItems:'center', gap:5,
            background:T.successBg, color:T.success,
            borderRadius:6, padding:'3px 8px',
            fontSize:12, fontWeight:700,
          }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:T.success, display:'inline-block' }} />
            {u.confidence}% confidence
          </span>
        </div>

        {rows.map((r, i) => (
          <div key={i} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'10px 0',
            borderBottom: i < rows.length-1 ? `1px solid ${T.border}` : 'none',
          }}>
            <span style={{ fontSize:13, color:T.muted, fontWeight:500 }}>{r.label}</span>
            <span style={{ fontSize:14, fontWeight:700, color: r.accent ? T.accent : T.text }}>{r.value}</span>
          </div>
        ))}
      </Card>

      {/* AI note */}
      <div style={{
        background:T.agentBg, border:'1px solid #BFDBFE',
        borderRadius:10, padding:'12px 14px', marginBottom:22,
        display:'flex', gap:8, alignItems:'flex-start',
        fontSize:13, color:'#1D4ED8', lineHeight:1.55,
      }}>
        <span style={{ flexShrink:0, fontSize:15 }}>🤖</span>
        <span>
          Looking for a <strong>highly-rated AC technician</strong> near <strong>G-13</strong> for{' '}
          <strong>tomorrow morning</strong>. Ready to find the best match.
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <PrimaryBtn onClick={onContinue}>Looks good — Find providers →</PrimaryBtn>
        <SecondaryBtn onClick={onEdit}>Edit details</SecondaryBtn>
      </div>
    </div>
  );
}

// ── Screen 3 · Recommendation ─────────────────────────────────────────────────
function RecommendationScreen({ onConfirm }) {
  const [showAlt, setShowAlt] = useState(false);
  const p = MOCK.provider;

  return (
    <div style={{ padding:'24px 20px 48px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>
      <div style={{ marginBottom:18 }}>
        <p style={{ fontSize:11, fontWeight:700, color:T.accent, letterSpacing:'.06em', textTransform:'uppercase', marginBottom:6 }}>
          Step 3 · Best Match Found
        </p>
        <h2 style={{ fontSize:24, fontWeight:800, color:T.text }}>Recommended provider</h2>
      </div>

      {/* Main provider card */}
      <Card anim style={{ marginBottom:14, overflow:'hidden', padding:0 }}>
        {/* Gradient accent bar */}
        <div style={{ height:4, background:`linear-gradient(90deg, ${T.accent} 0%, ${T.agent} 100%)` }} />

        <div style={{ padding:'18px 20px' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div>
              <h3 style={{ fontSize:19, fontWeight:800, color:T.text, marginBottom:4 }}>{p.name}</h3>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <Stars rating={p.rating} />
                <span style={{ fontSize:12, color:T.muted }}>{p.reviews} reviews</span>
              </div>
            </div>
            <Badge label="AI Selected" color={T.accent} bg={T.accentLt} />
          </div>

          {/* Stats grid */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
            background:T.bg, borderRadius:10,
            border:`1px solid ${T.border}`, overflow:'hidden', marginBottom:16,
          }}>
            {[
              { label:'Distance',  val:p.distance },
              { label:'Available', val:p.availability },
              { label:'Jobs Done', val:`${p.completedJobs}+` },
            ].map((s, i, a) => (
              <div key={i} style={{
                padding:'12px 0', textAlign:'center',
                borderRight: i < a.length-1 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{ fontSize:15, fontWeight:800, color:T.text }}>{s.val}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Why section */}
          <div style={{ marginBottom:14 }}>
            <p style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              Why this provider?
            </p>
            <p style={{ fontSize:13, color:T.muted, lineHeight:1.55, marginBottom:10 }}>{p.description}</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {p.reasons.map((r, i) => <ReasonChip key={i} label={r} />)}
            </div>
          </div>

          {/* Score pill */}
          <div style={{
            background:T.accentLt, borderRadius:8,
            padding:'8px 14px', display:'flex',
            justifyContent:'space-between', alignItems:'center',
          }}>
            <span style={{ fontSize:12, fontWeight:600, color:T.accentDk }}>Match score</span>
            <span style={{ fontSize:17, fontWeight:800, color:T.accentDk }}>{p.score}</span>
          </div>
        </div>
      </Card>

      {/* Alternatives toggle */}
      <div style={{ marginBottom:22 }}>
        <button
          onClick={() => setShowAlt(v => !v)}
          style={{
            background:'none', border:'none',
            color:T.agent, fontSize:13, fontWeight:700,
            cursor:'pointer', fontFamily:'var(--font)',
            padding:'6px 0', display:'flex', alignItems:'center', gap:6,
          }}
        >
          <span style={{ display:'inline-block', transform: showAlt ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▼</span>
          {showAlt ? 'Hide' : 'Show'} other options ({MOCK.alternatives.length})
        </button>

        {showAlt && (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:10, animation:'fadeUp .3s ease' }}>
            {MOCK.alternatives.map((alt, i) => (
              <Card key={i} style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:3 }}>{alt.name}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <Stars rating={alt.rating} />
                      <span style={{ fontSize:12, color:T.muted }}>{alt.distance} · {alt.availability}</span>
                    </div>
                    <p style={{ fontSize:12, color:T.muted }}>{alt.note}</p>
                  </div>
                  <Badge label={String(alt.score)} color={T.muted} bg={T.bg} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <PrimaryBtn onClick={onConfirm}>Confirm booking →</PrimaryBtn>
    </div>
  );
}

// ── Screen 4 · Booking Confirmation ──────────────────────────────────────────
function BookingScreen({ onViewTrace, onRestart }) {
  const b = MOCK.booking;

  return (
    <div style={{ padding:'24px 20px 48px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>
      {/* Success hero */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{
          width:68, height:68, borderRadius:'50%',
          background:T.successBg, border:`3px solid ${T.success}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          margin:'0 auto 14px',
          animation:'checkPop .55s ease',
        }}>
          <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
            <path d="M3 13 11 21 29 3" stroke={T.success} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 style={{ fontSize:24, fontWeight:800, color:T.text, marginBottom:4 }}>Booking confirmed!</h2>
        <p style={{ fontSize:13, color:T.muted }}>Your AI agent completed the booking</p>
      </div>

      {/* Booking details */}
      <Card anim style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
          <h3 style={{ fontSize:16, fontWeight:800 }}>{b.providerName}</h3>
          <Badge label="Confirmed" color={T.success} bg={T.successBg} />
        </div>
        {[
          { label:'When',       val:b.slot },
          { label:'Location',   val:b.location },
          { label:'Booking ID', val:b.bookingId, mono:true },
          { label:'Fee',        val:b.fee },
        ].map((r, i, a) => (
          <div key={i} style={{
            display:'flex', justifyContent:'space-between', alignItems:'flex-start',
            padding:'9px 0', gap:12,
            borderBottom: i < a.length-1 ? `1px solid ${T.border}` : 'none',
          }}>
            <span style={{ fontSize:13, color:T.muted, flexShrink:0 }}>{r.label}</span>
            <span style={{
              fontSize:  r.mono ? 11 : 13,
              fontWeight:700, color:T.text,
              fontFamily:r.mono ? 'var(--font-mono)' : 'inherit',
              textAlign: 'right',
            }}>
              {r.val}
            </span>
          </div>
        ))}
      </Card>

      {/* Agent messages */}
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
        {[
          { icon:'💬', text:b.confirmationMessage, bdr:'#BFDBFE' },
          { icon:'⏰', text:b.reminderMessage,     bdr:'#DDD6FE' },
        ].map((m, i) => (
          <div key={i} style={{
            background:T.bg, border:`1px solid ${m.bdr}`,
            borderRadius:10, padding:'10px 14px',
            fontSize:13, color:T.muted,
            display:'flex', gap:8, alignItems:'flex-start', lineHeight:1.55,
          }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{m.icon}</span>
            {m.text}
          </div>
        ))}
      </div>

      {/* Agent completion checklist */}
      <Card style={{ marginBottom:22, background:T.bg }}>
        <p style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.07em', marginBottom:10 }}>
          Agent actions completed
        </p>
        {['Booking created','Reminder scheduled','Trace generated'].map((s, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:8,
            paddingTop: i > 0 ? 8 : 0,
            animation:`fadeIn .3s ease ${i * .15}s both`,
          }}>
            <div style={{
              width:18, height:18, borderRadius:'50%',
              background:T.successBg, border:`2px solid ${T.success}`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            }}>
              <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
                <path d="M1 3.5 3 5.5 7 1.5" stroke={T.success} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{s}</span>
          </div>
        ))}
      </Card>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <PrimaryBtn onClick={onViewTrace}>View agent trace →</PrimaryBtn>
        <SecondaryBtn onClick={onRestart}>Start another request</SecondaryBtn>
      </div>
    </div>
  );
}

// ── Screen 5 · Agent Trace ────────────────────────────────────────────────────
function TraceScreen({ onBack }) {
  return (
    <div style={{ padding:'24px 20px 48px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <Badge label="Agent Trace" color={T.purple} bg={T.purpleBg} />
          <Badge label="6 agents"    color={T.muted}  bg={T.bg}       />
        </div>
        <h2 style={{ fontSize:24, fontWeight:800, color:T.text, marginBottom:6 }}>Agentic workflow</h2>
        <p style={{ fontSize:13, color:T.muted, lineHeight:1.55 }}>
          Complete trace of how the AI agent understood, found, ranked, booked, and scheduled your request.
        </p>
      </div>

      {/* Trace ID bar */}
      <div style={{
        background:T.bg, border:`1px solid ${T.border}`,
        borderRadius:8, padding:'8px 14px', marginBottom:20,
        display:'flex', justifyContent:'space-between', alignItems:'center',
      }}>
        <span style={{ fontSize:11, fontWeight:700, color:T.muted, textTransform:'uppercase', letterSpacing:'.06em' }}>Trace ID</span>
        <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:T.text, fontWeight:600 }}>TRC-20260517-001</span>
      </div>

      <TraceTimeline events={MOCK.trace} />

      <div style={{ marginTop:24 }}>
        <SecondaryBtn onClick={onBack}>← Back to booking</SecondaryBtn>
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
Object.assign(window, {
  MOCK, EXAMPLES,
  InputScreen, UnderstandingScreen, RecommendationScreen, BookingScreen, TraceScreen,
});
