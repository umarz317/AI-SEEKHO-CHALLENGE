const ACCEPT_PATTERNS = [
  /\byes\b/i,
  /\by\b/i,
  /\bok\b/i,
  /\bokay\b/i,
  /\baccept(?:ed)?\b/i,
  /\bavailable\b/i,
  /\bconfirm(?:ed)?\b/i,
  /\bhaan\b/i,
  /\bhan\b/i,
  /\btheek\b/i,
  /جی|ہاں/,
];

const REJECT_PATTERNS = [
  /\bno\b/i,
  /\bn\b/i,
  /\breject(?:ed)?\b/i,
  /\bunavailable\b/i,
  /\bbusy\b/i,
  /\bnot available\b/i,
  /\bcan't\b/i,
  /\bcannot\b/i,
  /\bnahi\b/i,
  /\bnahin\b/i,
  /نہیں/,
];

function extractBookingId(text = '') {
  const match = String(text).match(/\bBK-\d{8}-\d{3,}\b/i);
  return match ? match[0].toUpperCase() : null;
}

// Twilio quick-reply / list buttons can deliver the payload in several shapes
// depending on how the WhatsApp template was registered:
//   - "ACCEPT_BK-20260522-002"  (payload with embedded booking id)
//   - "ACCEPT" / "REJECT"        (bare action payload)
//   - "Accept" / "Reject" / "Yes" / "No"   (literal button title forwarded as payload)
//   - undefined, when the channel only forwards the button title in `Body`
// We normalise all of those into an intent here. Missing booking id is OK —
// the route will fall back to the provider's latest active booking.
function parseButtonPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;

  const raw = payload.trim();
  if (!raw) return null;

  // Match optional embedded booking id: "ACCEPT" or "ACCEPT_BK-..." or "Accept BK-..."
  const withIdMatch = raw.match(/^(accept|approve|yes|confirm|reject|decline|no)\b[\s_-]*(BK-\d{8}-\d{3,})?$/i);
  if (!withIdMatch) return null;

  const action = withIdMatch[1].toLowerCase();
  const accepted = ['accept', 'approve', 'yes', 'confirm'].includes(action);

  return {
    intent: accepted ? 'accepted' : 'rejected',
    bookingId: withIdMatch[2] ? withIdMatch[2].toUpperCase() : null,
    confidence: 1,
    proposedSlot: null,
  };
}

async function parseProviderReply({ text, buttonPayload, allowLlm = true }) {
  const fromButton = parseButtonPayload(buttonPayload);
  if (fromButton) {
    return { ...fromButton, parser: 'button' };
  }

  const body = String(text || '').trim();
  const bookingId = extractBookingId(body);

  if (!body) {
    return {
      bookingId,
      intent: 'unknown',
      confidence: 0,
      proposedSlot: null,
      parser: 'rules',
    };
  }

  // Word-count heuristic: short one-/two-word replies ("yes", "ok thanks",
  // "haan ji") are best served by the regex fast-path. Anything longer is
  // probably a natural-language reply that rules would mis-classify (e.g.
  // "Yes but can we do 4pm instead?" → looks like accept by rules but is
  // really a counter-proposal). For those we ALWAYS call the LLM.
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const isShort = wordCount <= 3;

  const ruleResult = parseWithRules(body);

  // Fast path: short, unambiguous reply that rules already understand.
  if (isShort && ruleResult.intent !== 'unknown') {
    return { ...ruleResult, bookingId, parser: 'rules' };
  }

  // Natural-language path: run the LLM and prefer its answer (it can also
  // detect proposed_time, which rules cannot). Fall back to whatever rules
  // saw if the LLM is unconfigured, errors, or returns 'unknown'.
  const llmResult = allowLlm
    ? await parseWithGemini(body).catch((err) => {
      console.warn('[providerReplyParser] LLM failed, falling back to rules:', err?.message || err);
      return null;
    })
    : null;

  if (llmResult?.intent && llmResult.intent !== 'unknown') {
    return { ...llmResult, bookingId, parser: 'gemini' };
  }

  if (ruleResult.intent !== 'unknown') {
    return { ...ruleResult, bookingId, parser: 'rules' };
  }

  // Last resort: keep whatever the LLM said (even 'unknown' with low
  // confidence) so downstream logging shows the LLM was at least asked.
  if (llmResult) {
    return { ...llmResult, bookingId, parser: 'gemini' };
  }

  return {
    bookingId,
    intent: 'unknown',
    confidence: 0,
    proposedSlot: null,
    parser: 'rules',
  };
}

// Phrases that look like rejection-ish words but are really benign.
const BENIGN_NO_PHRASES = [
  /\bno problem\b/i,
  /\bno worries\b/i,
  /\bnot a problem\b/i,
  /\bno issue\b/i,
];

function parseWithRules(text) {
  // Strip booking IDs so an embedded "BK-..." doesn't confuse the matchers.
  const cleaned = String(text).replace(/\bBK-\d{8}-\d{3,}\b/gi, '').trim();
  if (!cleaned) return { intent: 'unknown', confidence: 0, proposedSlot: null };

  // If the only "no" in the message is part of a benign phrase, ignore it.
  const benignNo = BENIGN_NO_PHRASES.some((p) => p.test(cleaned));

  if (ACCEPT_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return { intent: 'accepted', confidence: 0.9, proposedSlot: null };
  }
  if (!benignNo && REJECT_PATTERNS.some((pattern) => pattern.test(cleaned))) {
    return { intent: 'rejected', confidence: 0.9, proposedSlot: null };
  }
  return { intent: 'unknown', confidence: 0, proposedSlot: null };
}

async function parseWithGemini(text) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            intent: {
              type: 'STRING',
              description: 'accepted, rejected, proposed_time, or unknown',
            },
            confidence: { type: 'NUMBER' },
            proposedSlot: {
              type: 'STRING',
              description: 'Provider proposed time in original text or null',
            },
          },
        },
      },
      contents: [{
        role: 'user',
        parts: [{
          text: [
            'You classify a service provider\'s reply to a booking request sent via WhatsApp.',
            'The provider may reply in English, Urdu, Roman-Urdu, Hindi, or a mix.',
            '',
            'Return JSON ONLY with keys: intent, confidence (0..1), proposedSlot (string or null).',
            '',
            'intent must be exactly one of:',
            '- "accepted"      → provider agrees to the job at the proposed time.',
            '  examples: "Yes", "Ok", "Sure I\'m coming", "Haan ji aa jaunga", "Theek hai", "Confirmed", "On my way".',
            '- "rejected"      → provider cannot or will not take the job at all.',
            '  examples: "No", "Busy", "Nahi yaar", "Sorry I am out of city", "Cannot do today", "Booked already".',
            '- "proposed_time" → provider can take it but suggests a DIFFERENT time/day.',
            '  examples: "Can we do 4pm instead?", "Tomorrow morning works better", "Kal subah free hoon",',
            '            "I\'ll come at 6 instead of 5", "Day after possible?".',
            '  When this is the intent, set proposedSlot to the time/day text the provider offered (verbatim).',
            '- "unknown"       → anything ambiguous, off-topic, or just a question without a yes/no.',
            '',
            'Heuristics:',
            '- A reply that contains "yes" but also proposes a different time is "proposed_time", not "accepted".',
            '- A reply that contains "no" but is just clarifying (e.g. "no problem") is usually "accepted".',
            '- Roman-Urdu "haan" = yes, "nahi" = no, "kal" = tomorrow, "subah" = morning, "shaam" = evening.',
            '',
            `Provider reply: ${JSON.stringify(text)}`,
          ].join('\n'),
        }],
      }],
    }),
  });

  if (!response.ok) return null;
  const body = await response.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = parseJson(raw);
  if (!parsed) return null;

  const intent = ['accepted', 'rejected', 'proposed_time', 'unknown'].includes(parsed.intent)
    ? parsed.intent
    : 'unknown';
  return {
    intent,
    confidence: normalizeConfidence(parsed.confidence),
    proposedSlot: typeof parsed.proposedSlot === 'string' ? parsed.proposedSlot : null,
  };
}

function parseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.5;
  return Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric));
}

module.exports = {
  extractBookingId,
  parseProviderReply,
  parseWithRules,
  parseButtonPayload,
};
