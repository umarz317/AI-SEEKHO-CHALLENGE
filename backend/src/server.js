// server.js — Express server entry point
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
const express = require('express');
const cors = require('cors');
const routes = require('./routes/orchestrate');
const { createServer } = require('http');
const { initRealtime } = require('./services/realtime');
const { startReminderScheduler } = require('./services/reminderScheduler');

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

initRealtime(httpServer);
startReminderScheduler();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api', routes);

// Root
app.get('/', (req, res) => {
  res.json({
    name: 'KariGo Service Orchestrator',
    version: '1.0.0',
    endpoints: [
      'POST /api/orchestrate',
      'GET  /api/bookings',
      'GET  /api/bookings/:id',
      'GET  /api/traces',
      'GET  /api/traces/:id',
      'GET  /api/reminders',
      'GET  /api/notifications',
      'POST /api/push-tokens',
      'POST /api/webhooks/twilio/whatsapp',
      'POST /api/webhooks/twilio/status',
      'GET  /api/health',
    ],
  });
});

// Start
httpServer.listen(PORT, () => {
  console.log(`\n🚀 KariGo Backend running on http://localhost:${PORT}`);
  console.log(`   Try: curl -X POST http://localhost:${PORT}/api/orchestrate -H "Content-Type: application/json" -d '{"text":"Mujhe kal subah G-13 mein AC technician chahiye","cityHint":"Islamabad"}'\n`);
});
