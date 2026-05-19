// src/api.js — API service layer for mobile app
// Connects to the backend orchestrator

import { Platform } from 'react-native';
import { getAuth, getIdToken } from '@react-native-firebase/auth';

// Android emulator uses 10.0.2.2 for localhost; iOS sim uses localhost
// For real device testing, use your machine's local IP
const BASE_URL = Platform.select({
  android: 'http://10.0.2.2:3001',
  ios: 'http://localhost:3001',
  default: 'http://localhost:3001',
});

async function getAuthHeaders() {
  const user = getAuth().currentUser;
  if (!user) return {};
  try {
    const token = await getIdToken(user);
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function getCurrentUserPhone() {
  return getAuth().currentUser?.phoneNumber || null;
}

/**
 * POST /api/orchestrate — run the full 7-agent pipeline
 * @param {{ text: string, cityHint?: string }} params
 * @returns {Promise<object>} full orchestration response
 */
export async function orchestrate({ text, cityHint = 'Islamabad' }) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(`${BASE_URL}/api/orchestrate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      cityHint,
      timezone: 'Asia/Karachi',
      customerPhone: getCurrentUserPhone(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Orchestration failed (${res.status})`);
  }

  return res.json();
}

/**
 * POST /api/orchestrate/jobs — start an orchestration job with progress events
 */
export async function startOrchestrationJob({ text, cityHint = 'Islamabad' }) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(`${BASE_URL}/api/orchestrate/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      cityHint,
      timezone: 'Asia/Karachi',
      customerPhone: getCurrentUserPhone(),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Job start failed (${res.status})`);
  }

  return res.json();
}

/**
 * GET /api/orchestrate/jobs/:id — read progress events and final result
 */
export async function getOrchestrationJob(jobId) {
  const res = await fetch(`${BASE_URL}/api/orchestrate/jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Job read failed (${res.status})`);
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
 * GET /api/health — full backend status payload
 */
export async function getHealth() {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Health failed (${res.status})`);
  }
  return res.json();
}

/**
 * GET /api/bookings — list all bookings
 */
export async function listBookings() {
  const res = await fetch(`${BASE_URL}/api/bookings`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Bookings failed (${res.status})`);
  }
  return res.json();
}

/**
 * GET /api/notifications — list all notifications
 */
export async function listNotifications() {
  const res = await fetch(`${BASE_URL}/api/notifications`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Notifications failed (${res.status})`);
  }
  return res.json();
}

/**
 * POST /api/push-tokens — register this device for user reminders
 */
export async function registerPushToken(token) {
  if (!token) return null;
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(`${BASE_URL}/api/push-tokens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      token,
      platform: Platform.OS,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Push token registration failed (${res.status})`);
  }

  return res.json();
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
 * POST /api/bookings/:id/confirm — user confirms; backend notifies provider via WhatsApp
 */
export async function confirmBooking(bookingId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/confirm`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Confirm failed (${res.status})`);
  }
  return res.json();
}

/**
 * GET /api/bookings/:id/conversation
 */
export async function getConversation(bookingId) {
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/conversation`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Conversation failed (${res.status})`);
  }
  return res.json();
}

/**
 * POST /api/bookings/:id/messages
 */
export async function sendConversationMessage(bookingId, body) {
  const headers = { 'Content-Type': 'application/json', ...(await getAuthHeaders()) };
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Message failed (${res.status})`);
  }
  return res.json();
}

export async function approveConversationAction(bookingId, actionId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/actions/${actionId}/approve`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Action approval failed (${res.status})`);
  }
  return res.json();
}

export async function rejectConversationAction(bookingId, actionId) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/api/bookings/${bookingId}/actions/${actionId}/reject`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Action rejection failed (${res.status})`);
  }
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
