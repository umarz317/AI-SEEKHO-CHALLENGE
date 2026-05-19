const { Server } = require('socket.io');

let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    socket.on('booking:join', (bookingId) => {
      if (bookingId) socket.join(`booking:${bookingId}`);
    });

    socket.on('booking:leave', (bookingId) => {
      if (bookingId) socket.leave(`booking:${bookingId}`);
    });

    socket.on('conversation:join', (bookingId) => {
      if (bookingId) socket.join(`conversation:${bookingId}`);
    });

    socket.on('conversation:leave', (bookingId) => {
      if (bookingId) socket.leave(`conversation:${bookingId}`);
    });
  });

  return io;
}

function emitBookingUpdated(booking) {
  if (!io || !booking?.bookingId) return;
  io.to(`booking:${booking.bookingId}`).emit('booking:updated', booking);
  io.emit('bookings:updated', {
    bookingId: booking.bookingId,
    status: booking.status,
    lifecycleStatus: booking.lifecycleStatus,
    booking,
  });
}

function emitConversationMessage(message) {
  if (!io || !message?.bookingId) return;
  io.to(`conversation:${message.bookingId}`).emit('conversation:message', message);
}

function emitConversationAction(action) {
  if (!io || !action?.bookingId) return;
  io.to(`conversation:${action.bookingId}`).emit('conversation:action', action);
}

module.exports = {
  emitConversationAction,
  emitConversationMessage,
  emitBookingUpdated,
  initRealtime,
};
