// agents/intentAgent.js — Agent 1: Intent Understanding
// Parses natural language into structured service request

const { runWithAdapter } = require('../tools/mode');

const SERVICE_MAP = {
  // English
  'ac': 'ac_technician', 'a/c': 'ac_technician', 'ac technician': 'ac_technician', 'ac tech': 'ac_technician', 'ac repair': 'ac_technician', 'air conditioner': 'ac_technician', 'air conditioning': 'ac_technician', 'cooling': 'ac_technician',
  'plumber': 'plumber', 'plumbing': 'plumber',
  'electrician': 'electrician', 'electric': 'electrician', 'electrical': 'electrician', 'wiring': 'electrician',
  'cleaner': 'cleaner', 'cleaning': 'cleaner', 'maid': 'cleaner', 'house cleaning': 'cleaner',
  'beauty': 'beautician', 'beautician': 'beautician', 'salon': 'beautician', 'makeup': 'beautician', 'makeup artist': 'beautician', 'mehndi': 'beautician',
  'tutor': 'tutor', 'tutoring': 'tutor', 'teacher': 'tutor', 'math tutor': 'tutor', 'academy': 'tutor',
  'carpenter': 'carpenter', 'wood work': 'carpenter', 'furniture repair': 'carpenter',
  // Roman Urdu
  'ac wala': 'ac_technician', 'ac mechanic': 'ac_technician', 'ac ki service': 'ac_technician', 'ac repair wala': 'ac_technician',
  'mistri': 'plumber', 'nalkay wala': 'plumber', 'nalka': 'plumber', 'pani leak': 'plumber', 'pipe wala': 'plumber',
  'bijli wala': 'electrician', 'bijli ka kaam': 'electrician', 'electric ka kaam': 'electrician', 'wiring wala': 'electrician',
  'safai wala': 'cleaner', 'safai wali': 'cleaner', 'ghar ki safai': 'cleaner',
  'beauty parlour': 'beautician', 'makeup wali': 'beautician', 'mehndi wali': 'beautician',
  'ustad': 'tutor', 'home tutor': 'tutor', 'teacher chahiye': 'tutor',
  'carpenter wala': 'carpenter', 'lakri ka kaam': 'carpenter',
  // Urdu
  'اے سی': 'ac_technician',
  'الیکٹریشن': 'electrician', 'الیکٹرشین': 'electrician',
  'بجلی': 'electrician',
  'پلمبر': 'plumber', 'نلکا': 'plumber',
  'صفائی': 'cleaner', 'ملازمہ': 'cleaner',
  'ٹیچر': 'tutor', 'استاد': 'tutor', 'ٹیوٹر': 'tutor',
  'بیوٹیشن': 'beautician', 'میک اپ': 'beautician', 'مہندی': 'beautician',
  'بڑھئی': 'carpenter', 'فرنیچر': 'carpenter',
};

const SERVICE_LABELS = {
  ac_technician: 'AC Technician',
  plumber: 'Plumber',
  electrician: 'Electrician',
  cleaner: 'Cleaner',
  beautician: 'Beautician',
  tutor: 'Tutor',
  carpenter: 'Carpenter',
};

const LOCATION_PATTERN = /\b([A-Z]-\d{1,2}|[EFGHI]-\d{1,2}|DHA(?:\s*Phase\s*\d+)?|Bahria Town|Satellite Town|Gulberg|Johar Town)\b/i;

const TIME_MAP = {
  'subah': { start: '09:00', end: '12:00', label: 'Morning' },
  'morning': { start: '09:00', end: '12:00', label: 'Morning' },
  'dopahar': { start: '12:00', end: '15:00', label: 'Afternoon' },
  'afternoon': { start: '12:00', end: '15:00', label: 'Afternoon' },
  'sham': { start: '15:00', end: '19:00', label: 'Evening' },
  'shaam': { start: '15:00', end: '19:00', label: 'Evening' },
  'evening': { start: '15:00', end: '19:00', label: 'Evening' },
  'raat': { start: '19:00', end: '22:00', label: 'Night' },
  'night': { start: '19:00', end: '22:00', label: 'Night' },
  'صبح': { start: '09:00', end: '12:00', label: 'Morning' },
  'شام': { start: '15:00', end: '19:00', label: 'Evening' },
  'دوپہر': { start: '12:00', end: '15:00', label: 'Afternoon' },
  'رات': { start: '19:00', end: '22:00', label: 'Night' },
  'آج شام': { start: '15:00', end: '19:00', label: 'Evening' },
};

const DATE_MAP = {
  'kal': 1, 'tomorrow': 1,
  'aaj': 0, 'today': 0,
  'parson': 2,
  'day after tomorrow': 2,
  'آج': 0, 'کل': 1,
};

function detectLanguage(text) {
  if (/[\u0600-\u06FF]/.test(text)) return 'Urdu';
  if (/mujhe|chahiye|subah|mein|kal|aaj|wala|wali|parson/i.test(text)) return 'Roman Urdu';
  return 'English';
}

function resolveDate(text) {
  let daysOffset = 1; // default tomorrow
  const lower = text.toLowerCase();
  const sortedDates = Object.entries(DATE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [key, offset] of sortedDates) {
    if (lower.includes(key)) { daysOffset = offset; break; }
  }
  const d = getPakistanToday();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return {
    resolvedDate: d.toISOString().slice(0, 10),
    dateLabel: daysOffset === 0 ? 'Today' : daysOffset === 1 ? 'Tomorrow' : `In ${daysOffset} days`,
    dateFull: `${days[d.getUTCDay()]}, ${months[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

function getPakistanToday() {
  const pakistanOffsetMs = 5 * 60 * 60 * 1000;
  const pkNow = new Date(Date.now() + pakistanOffsetMs);
  return new Date(Date.UTC(pkNow.getUTCFullYear(), pkNow.getUTCMonth(), pkNow.getUTCDate()));
}

function resolveTime(text) {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(TIME_MAP)) {
    if (lower.includes(key)) return { timeWindow: val, timeWindowLabel: `${formatTime(val.start)} – ${formatTime(val.end)}`, timeLabel: val.label };
  }
  // Check Urdu text
  for (const [key, val] of Object.entries(TIME_MAP)) {
    if (text.includes(key)) return { timeWindow: val, timeWindowLabel: `${formatTime(val.start)} – ${formatTime(val.end)}`, timeLabel: val.label };
  }
  return null;
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function extractService(text) {
  const lower = text.toLowerCase();
  // Check longest match first
  const sorted = Object.entries(SERVICE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of sorted) {
    if (lower.includes(key) || text.includes(key)) {
      return { normalizedServiceType: val, serviceType: SERVICE_LABELS[val] || val };
    }
  }
  return null;
}

function extractLocation(text) {
  const match = text.match(LOCATION_PATTERN);
  return match ? match[1].replace(/\s+/g, ' ').trim().toUpperCase() : null;
}

/**
 * @param {{ text: string, cityHint?: string }} input
 * @returns {object} structured intent
 */
async function run(input) {
  const { text, cityHint = 'Islamabad' } = input;

  const mockImpl = async () => {
    return parseWithRules({ text, cityHint });
  };

  const llmImpl = async () => parseWithLlmThenRules({ text, cityHint });

  return runWithAdapter('intent', mockImpl, llmImpl);
}

function parseWithRules({ text, cityHint = 'Islamabad' }) {
  const lang = detectLanguage(text);
  const service = extractService(text);
  const locationText = extractLocation(text);
  const dateInfo = resolveDate(text);
  const timeInfo = resolveTime(text);

  const confidence = (service ? 0.30 : 0) +
    (locationText ? 0.25 : 0) +
    (dateInfo ? 0.20 : 0) +
    (timeInfo ? 0.15 : 0) +
    0.10; // base

  return {
    serviceType: service?.serviceType || null,
    normalizedServiceType: service?.normalizedServiceType || null,
    locationText: locationText || null,
    city: cityHint,
    dateText: dateInfo.dateLabel,
    resolvedDate: dateInfo.resolvedDate,
    dateFull: dateInfo.dateFull,
    timeText: timeInfo?.timeLabel || null,
    timeWindow: timeInfo?.timeWindow || null,
    timeWindowLabel: timeInfo?.timeWindowLabel || null,
    detectedLanguage: lang,
    confidence: Math.round(confidence * 100) / 100,
    parser: 'rules',
  };
}

async function parseWithLlmThenRules({ text, cityHint = 'Islamabad' }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error('not_configured');

  const ruleResult = parseWithRules({ text, cityHint });
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  
  const responseSchema = {
    type: "OBJECT",
    properties: {
      serviceType: { type: "STRING", description: "Friendly name of the service" },
      normalizedServiceType: { 
        type: "STRING", 
        description: "Must be one of: ac_technician, plumber, electrician, tutor, beautician, cleaner, carpenter, unknown" 
      },
      locationText: { type: "STRING", description: "The specific area, sector, or phase mentioned" },
      city: { type: "STRING" },
      dateText: { type: "STRING", description: "Today, Tomorrow, or In X days" },
      resolvedDate: { type: "STRING", description: "Resolved date in YYYY-MM-DD format when present" },
      timeText: { type: "STRING", description: "Morning, Afternoon, Evening, Night" },
      timeWindow: {
        type: "OBJECT",
        properties: {
          start: { type: "STRING", description: "HH:MM format, e.g. 09:00" },
          end: { type: "STRING", description: "HH:MM format, e.g. 12:00" }
        }
      },
      detectedLanguage: { type: "STRING", description: "Urdu, Roman Urdu, English, or Mixed" },
      confidence: { type: "NUMBER", description: "Confidence score between 0.0 and 1.0" }
    }
  };

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 6000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
        contents: [{
          role: 'user',
          parts: [{ text: buildIntentPrompt({ text, cityHint }) }],
        }],
      }),
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('llm_intent_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`llm_intent_failed_${response.status}`);
    err.detail = errText;
    throw err;
  }

  const body = await response.json();
  const raw = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  const llm = parseJsonObject(raw);
  if (!llm) {
    throw new Error('llm_intent_invalid_json');
  }

  return normalizeLlmIntent({ llm, ruleResult, cityHint });
}

function buildIntentPrompt({ text, cityHint }) {
  return [
    'Extract the service booking request details from the user text.',
    'Dates should be relative to Asia/Karachi. Return dateText plus resolvedDate as YYYY-MM-DD when a date is present.',
    `City hint: ${cityHint || 'Islamabad'}`,
    `User text: ${text}`
  ].join('\n');
}

function parseJsonObject(raw) {
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

function normalizeLlmIntent({ llm, ruleResult, cityHint }) {
  const normalizedServiceType = normalizeServiceType(llm.normalizedServiceType) ||
    ruleResult.normalizedServiceType;
  const serviceType = SERVICE_LABELS[normalizedServiceType] ||
    llm.serviceType ||
    ruleResult.serviceType ||
    null;
  const dateInfo = dateInfoFromResolvedDate(llm.resolvedDate, llm.dateText) ||
    dateInfoFromLabel(llm.dateText) || {
    resolvedDate: ruleResult.resolvedDate,
    dateLabel: ruleResult.dateText,
    dateFull: ruleResult.dateFull,
  };
  const timeInfo = normalizeTimeInfo(llm.timeText, llm.timeWindow) || {
    timeLabel: ruleResult.timeText,
    timeWindow: ruleResult.timeWindow,
    timeWindowLabel: ruleResult.timeWindowLabel,
  };

  return {
    serviceType,
    normalizedServiceType,
    locationText: normalizeLocationText(llm.locationText) || ruleResult.locationText,
    city: llm.city || ruleResult.city || cityHint,
    dateText: dateInfo.dateLabel,
    resolvedDate: dateInfo.resolvedDate,
    dateFull: dateInfo.dateFull,
    timeText: timeInfo.timeLabel,
    timeWindow: timeInfo.timeWindow,
    timeWindowLabel: timeInfo.timeWindowLabel,
    detectedLanguage: llm.detectedLanguage || ruleResult.detectedLanguage,
    confidence: normalizeConfidence(llm.confidence, ruleResult.confidence),
    parser: 'llm+rules',
    ruleFallback: {
      service: !normalizeServiceType(llm.normalizedServiceType) && !!ruleResult.normalizedServiceType,
      location: !normalizeLocationText(llm.locationText) && !!ruleResult.locationText,
      date: !dateInfoFromResolvedDate(llm.resolvedDate, llm.dateText) && !dateInfoFromLabel(llm.dateText),
      time: !normalizeTimeInfo(llm.timeText, llm.timeWindow) && !!ruleResult.timeWindow,
    },
  };
}

function normalizeServiceType(value) {
  if (!value || value === 'unknown') return null;
  return SERVICE_LABELS[value] ? value : null;
}

function normalizeLocationText(value) {
  if (!value || typeof value !== 'string') return null;
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

function dateInfoFromLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const lower = label.toLowerCase();
  if (lower.includes('today')) return resolveDate('today');
  if (lower.includes('tomorrow')) return resolveDate('tomorrow');
  if (lower.includes('2') || lower.includes('day after')) return resolveDate('day after tomorrow');
  return null;
}

function dateInfoFromResolvedDate(resolvedDate, label) {
  if (!isIsoDate(resolvedDate)) return null;
  const [year, month, day] = resolvedDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return {
    resolvedDate,
    dateLabel: label || labelRelativeToPakistanToday(d),
    dateFull: formatDateFull(d),
  };
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day;
}

function labelRelativeToPakistanToday(date) {
  const today = getPakistanToday();
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1) return `In ${diffDays} days`;
  return formatDateFull(date);
}

function formatDateFull(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

function normalizeTimeInfo(label, window) {
  if (window?.start && window?.end) {
    const timeLabel = label || labelForWindow(window);
    return {
      timeLabel,
      timeWindow: { start: window.start, end: window.end, label: timeLabel },
      timeWindowLabel: `${formatTime(window.start)} – ${formatTime(window.end)}`,
    };
  }
  if (label && typeof label === 'string') {
    return resolveTime(label);
  }
  return null;
}

function labelForWindow(window) {
  const match = Object.values(TIME_MAP).find((candidate) =>
    candidate.start === window.start && candidate.end === window.end
  );
  return match?.label || null;
}

function normalizeConfidence(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const scaled = numeric > 1 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, Math.round(scaled * 100) / 100));
}

module.exports = { run, parseWithRules, parseWithLlmThenRules };
