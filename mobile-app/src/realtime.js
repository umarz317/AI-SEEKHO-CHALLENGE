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
