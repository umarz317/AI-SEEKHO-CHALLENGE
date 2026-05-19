import { io } from 'socket.io-client';
import { BASE_URL } from './api';

let socket = null;

export function getRealtimeSocket() {
  if (!socket) {
    socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
    });
  }
  return socket;
}

export function subscribeToBooking(bookingId, onUpdate) {
  if (!bookingId) return () => {};

  const activeSocket = getRealtimeSocket();
  const handleUpdate = (booking) => {
    if (booking?.bookingId === bookingId) onUpdate(booking);
  };

  activeSocket.emit('booking:join', bookingId);
  activeSocket.on('booking:updated', handleUpdate);

  return () => {
    activeSocket.emit('booking:leave', bookingId);
    activeSocket.off('booking:updated', handleUpdate);
  };
}

export function subscribeToBookings(onUpdate) {
  const activeSocket = getRealtimeSocket();
  activeSocket.on('bookings:updated', onUpdate);
  return () => activeSocket.off('bookings:updated', onUpdate);
}

export function subscribeToConversation(bookingId, handlers = {}) {
  if (!bookingId) return () => {};

  const activeSocket = getRealtimeSocket();
  const handleMessage = (message) => {
    if (message?.bookingId === bookingId) handlers.onMessage?.(message);
  };
  const handleAction = (action) => {
    if (action?.bookingId === bookingId) handlers.onAction?.(action);
  };

  activeSocket.emit('conversation:join', bookingId);
  activeSocket.on('conversation:message', handleMessage);
  activeSocket.on('conversation:action', handleAction);

  return () => {
    activeSocket.emit('conversation:leave', bookingId);
    activeSocket.off('conversation:message', handleMessage);
    activeSocket.off('conversation:action', handleAction);
  };
}
