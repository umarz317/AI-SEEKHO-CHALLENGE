// aiseekho-app.jsx — App state machine + Demo layout + Tweaks
const { useState, useCallback, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#10B981",
  "animSpeed": "normal",
  "showScores": true
}/*EDITMODE-END*/;

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen({ step }) {
  return (
    <div style={{ padding:'32px 20px', maxWidth:480, margin:'0 auto', animation:'fadeUp .4s ease' }}>
      <div style={{ marginBottom:24 }}>
        <p style={{ fontSize:11, fontWeight:700, color:T.agent, letterSpacing:'.07em', textTransform:'uppercase', marginBottom:8 }}>
          Service Agent
        </p>
        <h2 style={{ fontSize:24, fontWeight:800, color:T.text, marginBottom:4 }}>
          Working on your request…
        </h2>
        <p style={{ fontSize:13, color:T.muted }}>
          Your AI agent is understanding, finding, and ranking providers
        </p>
      </div>
      <Card>
        <LoadingSequence step={step} />
      </Card>
    </div>
  );
}

// ── Demo layout (judge-facing) ────────────────────────────────────────────────
const ADAPTERS = [
  { name:'App Mode',      value:'Demo',            tag:'demo'  },
  { name:'Intent Mode',   value:'Mock',            tag:'mock'  },
  { name:'Location Mode', value:'Mock',            tag:'mock'  },
  { name:'Provider Mode', value:'Mock',            tag:'mock'  },
  { name:'Distance Mode', value:'Haversine',       tag:'local' },
  { name:'Booking Store', value:'Local Memory',    tag:'local' },
  { name:'Reminder Mode', value:'Mock',            tag:'mock'  },
];

const COMPAT_MAP = [
  ['Intent:',    'Claude Haiku  →  Google Dialogflow CX'],
  ['Location:',  'Mock GeoAPI  →  Google Maps Geocoding API'],
  ['Distance:',  'Haversine  →  Google Maps Distance Matrix'],
  ['Booking:',   'LocalStore  →  Google Firestore'],
  ['Reminder:',  'Mock Scheduler  →  Google Cloud Tasks'],
];

const FLOW_STEPS = [
  { n:1, label:'Request',        color:'#3B82F6', content:'"Mujhe kal subah G-13 mein AC technician chahiye"', sub:'Roman Urdu · Islamabad' },
  { n:2, label:'Understanding',  color:'#8B5CF6', content:'AC Technician · G-13 · Tomorrow 9–12 AM',          sub:'Confidence: 94%' },
  { n:3, label:'Recommendation', color:'#10B981', content:'Ali AC Services · ⭐ 4.8 · 2.1 km · 10:00 AM',      sub:'Match score: 0.913' },
  { n:4, label:'Booking',        color:'#22C55E', content:'BK-20260517-001 · Confirmed',                      sub:'Reminder: 9:00 AM' },
  { n:5, label:'Trace',          color:'#F59E0B', content:'6 agent steps · All successful',                   sub:'TRC-20260517-001' },
];

function DemoLayout() {
  const [tab, setTab] = useState('trace');

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'calc(100vh - 60px)' }}>

      {/* ── Left: workflow ── */}
      <div style={{ padding:'28px', borderRight:`1px solid ${T.border}`, overflowY:'auto' }}>
        <h2 style={{ fontSize:18, fontWeight:800, color:T.text, marginBottom:4 }}>Full Workflow</h2>
        <p style={{ fontSize:13, color:T.muted, marginBottom:24, lineHeight:1.5 }}>
          Complete agentic flow — from natural-language request to confirmed booking
        </p>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'stretch' }}>
          {FLOW_STEPS.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                background:  T.card,
                border:      `1px solid ${T.border}`,
                borderLeft:  `4px solid ${step.color}`,
                borderRadius:10,
                padding:     '14px 16px',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                  <span style={{
                    background:    step.color,
                    color:         '#fff',
                    borderRadius:  '50%',
                    width:20, height:20,
                    display:       'inline-flex',
                    alignItems:    'center',
                    justifyContent:'center',
                    fontSize:11, fontWeight:800, flexShrink:0,
                  }}>{step.n}</span>
                  <span style={{ fontSize:11, fontWeight:800, color:step.color, textTransform:'uppercase', letterSpacing:'.06em' }}>
                    {step.label}
                  </span>
                </div>
                <p style={{ fontSize:13, color:T.text, fontWeight:600, marginBottom:2, lineHeight:1.4 }}>{step.content}</p>
                <p style={{ fontSize:12, color:T.muted }}>{step.sub}</p>
              </div>
              {i < FLOW_STEPS.length - 1 && (
                <div style={{ textAlign:'center', color:T.border, fontSize:22, lineHeight:1, padding:'3px 0' }}>↓</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Right: trace / adapters ── */}
      <div style={{ padding:'28px', overflowY:'auto', background:T.bg }}>

        {/* Tab bar */}
        <div style={{
          display:'grid', gridTemplateColumns:'1fr 1fr',
          background:T.card, border:`1px solid ${T.border}`,
          borderRadius:10, padding:4, marginBottom:22, gap:4,
        }}>
          {[['trace','Agent Trace'],['adapters','Adapters']].map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background:    tab === id ? T.primary : 'transparent',
                color:         tab === id ? '#fff'    : T.muted,
                border:        'none',
                borderRadius:  7,
                padding:       '8px 12px',
                fontSize:      12,
                fontWeight:    700,
                fontFamily:    'var(--font)',
                cursor:        'pointer',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                transition:    'all .2s',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        {tab === 'trace' && <TraceTimeline events={MOCK.trace} />}

        {tab === 'adapters' && (
          <div>
            <h3 style={{ fontSize:15, fontWeight:800, color:T.text, marginBottom:4 }}>Adapter Status</h3>
            <p style={{ fontSize:12, color:T.muted, marginBottom:16, lineHeight:1.55 }}>
              Mock-first architecture. All adapters swap to production APIs without UI changes.
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
              {ADAPTERS.map((a, i) => {
                const color = a.tag === 'mock'  ? T.warning
                            : a.tag === 'demo'  ? T.accent
                            : T.agent;
                const bg    = a.tag === 'mock'  ? T.warnBg
                            : a.tag === 'demo'  ? T.accentLt
                            : T.agentBg;
                return (
                  <div key={i} style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    background:T.card, border:`1px solid ${T.border}`,
                    borderRadius:8, padding:'10px 14px',
                  }}>
                    <span style={{ fontSize:13, color:T.muted }}>{a.name}</span>
                    <Badge label={a.value} color={color} bg={bg} />
                  </div>
                );
              })}
            </div>

            <Card style={{ padding:'14px 16px' }}>
              <p style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:10 }}>Google API compatibility map</p>
              {COMPAT_MAP.map(([k, v], i) => (
                <div key={i} style={{ display:'flex', gap:8, padding:'3px 0', fontSize:11 }}>
                  <span style={{ color:T.agent, fontWeight:700, minWidth:72, flexShrink:0 }}>{k}</span>
                  <span style={{ color:T.muted, fontFamily:'var(--font-mono)', lineHeight:1.4 }}>{v}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [screen,   setScreen]   = useState('input');
  const [loadStep, setLoadStep] = useState(0);
  const [demo,     setDemo]     = useState(false);
  const [t,        setTweak]    = useTweaks(TWEAK_DEFAULTS);

  // Run full 6-step loading animation, then call onDone
  const runFullLoad = useCallback((onDone) => {
    setScreen('loading');
    setLoadStep(0);
    const delay = t.animSpeed === 'fast' ? 280 : t.animSpeed === 'slow' ? 700 : 460;
    let s = 0;
    const id = setInterval(() => {
      s++;
      setLoadStep(s);
      if (s >= 6) {
        clearInterval(id);
        setTimeout(onDone, 260);
      }
    }, delay);
  }, [t.animSpeed]);

  // Run partial load (booking step only)
  const runBookingLoad = useCallback((onDone) => {
    setScreen('loading');
    setLoadStep(4);
    const delay = t.animSpeed === 'fast' ? 280 : t.animSpeed === 'slow' ? 700 : 460;
    setTimeout(() => { setLoadStep(5); }, delay);
    setTimeout(() => { setLoadStep(6); }, delay * 2);
    setTimeout(onDone, delay * 2 + 260);
  }, [t.animSpeed]);

  const onSubmit   = useCallback(() => runFullLoad(() => setScreen('understanding')), [runFullLoad]);
  const onContinue = useCallback(() => runFullLoad(() => setScreen('recommendation')), [runFullLoad]);
  const onConfirm  = useCallback(() => runBookingLoad(() => setScreen('booking')), [runBookingLoad]);

  return (
    <div className={demo ? 'app-shell app-shell-demo' : 'app-shell'} style={{ fontFamily:'var(--font)' }}>
      <AppHeader onToggleDemo={() => setDemo(v => !v)} demoMode={demo} />

      {demo ? (
        <DemoLayout />
      ) : (
        <>
          <StepIndicator screen={screen} />
          <div style={{ flex:1 }}>
            {screen === 'input'          && <InputScreen          onSubmit={onSubmit} />}
            {screen === 'loading'        && <LoadingScreen        step={loadStep} />}
            {screen === 'understanding'  && <UnderstandingScreen  onContinue={onContinue} onEdit={() => setScreen('input')} />}
            {screen === 'recommendation' && <RecommendationScreen onConfirm={onConfirm} />}
            {screen === 'booking'        && <BookingScreen        onViewTrace={() => setScreen('trace')} onRestart={() => setScreen('input')} />}
            {screen === 'trace'          && <TraceScreen          onBack={() => setScreen('booking')} />}
          </div>
        </>
      )}

      {/* ── Tweaks panel ── */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakColor
            label="Accent color"
            value={t.accentColor}
            options={['#10B981','#3B82F6','#F59E0B','#8B5CF6']}
            onChange={v => setTweak('accentColor', v)}
          />
        </TweakSection>
        <TweakSection label="Demo">
          <TweakRadio
            label="Animation speed"
            value={t.animSpeed}
            options={['fast','normal','slow']}
            onChange={v => setTweak('animSpeed', v)}
          />
          <TweakToggle
            label="Show match scores"
            value={t.showScores}
            onChange={v => setTweak('showScores', v)}
          />
          <TweakButton label="Go to trace" onClick={() => { setDemo(false); setScreen('trace'); }} />
          <TweakButton label="Reset flow"  onClick={() => { setDemo(false); setScreen('input'); }} secondary />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
