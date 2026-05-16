// src/api.js — API service layer for mobile app
// Connects to the backend orchestrator

import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 for localhost; iOS sim uses localhost
// For real device testing, use your machine's local IP
const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3001',
  ios: 'http://localhost:3001',
  default: 'http://localhost:3001',
});

/**
 * POST /api/orchestrate — run the full 7-agent pipeline
 * @param {{ text: string, cityHint?: string }} params
 * @returns {Promise<object>} full orchestration response
 */
export async function orchestrate({ text, cityHint = 'Islamabad' }) {
  const res = await fetch(`${BASE_URL}/api/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'demo-user-001',
      text,
      cityHint,
      timezone: 'Asia/Karachi',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Orchestration failed (${res.status})`);
  }

  return res.json();
}

/**
 * GET /api/health — check backend status
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * GET /api/bookings/:id
 */
export async function getBooking(bookingId) {
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}`);
  if (!res.ok) throw new Error('Booking not found');
  return res.json();
}

/**
 * GET /api/traces/:id
 */
export async function getTrace(traceId) {
  const res = await fetch(`${BASE_URL}/api/traces/${traceId}`);
  if (!res.ok) throw new Error('Trace not found');
  return res.json();
}

export { BASE_URL };
