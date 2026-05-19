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

module.exports = {
  emitBookingUpdated,
  initRealtime,
};
