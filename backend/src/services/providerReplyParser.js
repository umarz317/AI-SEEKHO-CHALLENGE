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

function parseButtonPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const match = payload.match(/^(ACCEPT|REJECT)_(BK-\d{8}-\d{3,})$/i);
  if (!match) return null;
  return {
    intent: match[1].toUpperCase() === 'ACCEPT' ? 'accepted' : 'rejected',
    bookingId: match[2].toUpperCase(),
    confidence: 1,
    proposedSlot: null,
  };
}

async function parseProviderReply({ text, buttonPayload }) {
  const fromButton = parseButtonPayload(buttonPayload);
  if (fromButton) {
    return { ...fromButton, parser: 'button' };
  }

  const body = String(text || '').trim();
  const bookingId = extractBookingId(body);

  const ruleResult = parseWithRules(body);
  if (ruleResult.intent !== 'unknown') {
    return { ...ruleResult, bookingId, parser: 'rules' };
  }

  const llmResult = await parseWithGemini(body).catch(() => null);
  if (llmResult?.intent) {
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

function parseWithRules(text) {
  if (ACCEPT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: 'accepted', confidence: 0.9, proposedSlot: null };
  }
  if (REJECT_PATTERNS.some((pattern) => pattern.test(text))) {
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
            'Classify this provider reply to a booking request.',
            'Return JSON only. intent must be accepted, rejected, proposed_time, or unknown.',
            `Reply: ${text}`,
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
