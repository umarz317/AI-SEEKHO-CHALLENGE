function classifyWithRules({ text, source = 'provider' }) {
  const body = String(text || '').trim();
  const lower = body.toLowerCase();
  const slot = extractProposedSlot(body);

  if (/\b(cancel|cancelled|canceled|can't come|cannot come|not coming|sorry.*cannot|sorry.*can't)\b/i.test(body)) {
    return {
      type: 'cancel_requested',
      confidence: 0.85,
      proposedSlot: null,
      reason: body,
      assistantMessage: source === 'provider'
        ? 'Provider is asking to cancel this booking. Please approve cancellation only if you want to close it.'
        : 'Cancellation requested. Please confirm before the provider is notified.',
      parser: 'rules',
    };
  }

  if (
    slot ||
    /\b(reschedule|another time|later|earlier|tomorrow|today|tonight|morning|afternoon|evening|pm|am)\b/i.test(lower)
  ) {
    return {
      type: 'reschedule_proposed',
      confidence: slot ? 0.85 : 0.65,
      proposedSlot: slot || body,
      reason: body,
      assistantMessage: `Provider proposed a new time: ${slot || body}. Approve it only if this works for you.`,
      parser: 'rules',
    };
  }

  if (/\?$/.test(body) || /\b(where|address|location|confirm|please|can you|could you)\b/i.test(lower)) {
    return {
      type: 'needs_user_reply',
      confidence: 0.65,
      proposedSlot: null,
      reason: body,
      assistantMessage: 'Provider needs a reply from you.',
      parser: 'rules',
    };
  }

  return {
    type: 'plain_message',
    confidence: 0.6,
    proposedSlot: null,
    reason: body,
    assistantMessage: null,
    parser: 'rules',
  };
}

async function classifyConversationMessage(input) {
  const llm = await classifyWithGemini(input).catch(() => null);
  return llm || classifyWithRules(input);
}

async function classifyWithGemini({ text, source = 'provider', booking }) {
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
            type: {
              type: 'STRING',
              description: 'plain_message, reschedule_proposed, cancel_requested, needs_user_reply, or unknown',
            },
            confidence: { type: 'NUMBER' },
            proposedSlot: { type: 'STRING', description: 'New proposed time/date if present, else null' },
            reason: { type: 'STRING' },
            assistantMessage: { type: 'STRING' },
          },
        },
      },
      contents: [{
        role: 'user',
        parts: [{
          text: [
            'Classify this service booking follow-up chat message.',
            'Return JSON only.',
            'Allowed type values: plain_message, reschedule_proposed, cancel_requested, needs_user_reply, unknown.',
            'Reschedule and cancel actions require user approval before changing the booking.',
            'For reschedule_proposed, resolve the proposedSlot into an ISO 8601 datetime with timezone when the booking date is known.',
            'If the provider says an hour without am/pm, infer the most likely future time on the booking date using the existing booking slot as context.',
            'Example: booking is 12:00 PM and provider says "3 bajy possible hai?" -> proposedSlot should be 3:00 PM on the booking date.',
            `Message source: ${source}`,
            `Booking: ${JSON.stringify({
              bookingId: booking?.bookingId,
              serviceType: booking?.serviceType,
              slot: booking?.slot,
              slotLabel: booking?.slotLabel,
              location: booking?.location,
              status: booking?.status,
            })}`,
            `Message: ${text}`,
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

  const allowed = ['plain_message', 'reschedule_proposed', 'cancel_requested', 'needs_user_reply', 'unknown'];
  return {
    type: allowed.includes(parsed.type) ? parsed.type : 'unknown',
    confidence: normalizeConfidence(parsed.confidence),
    proposedSlot: typeof parsed.proposedSlot === 'string' ? parsed.proposedSlot : null,
    reason: typeof parsed.reason === 'string' ? parsed.reason : String(text || ''),
    assistantMessage: typeof parsed.assistantMessage === 'string' ? parsed.assistantMessage : null,
    parser: 'gemini',
  };
}

function extractProposedSlot(text) {
  const iso = String(text || '').match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?/);
  if (iso) return iso[0];
  const dateTime = String(text || '').match(/\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i);
  return dateTime ? dateTime[0].trim() : null;
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
  classifyConversationMessage,
  classifyWithRules,
};
