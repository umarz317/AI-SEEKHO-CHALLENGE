// server.js — Express server entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/orchestrate');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

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
    name: 'AI-SEEKHO Service Orchestrator',
    version: '1.0.0',
    mode: process.env.APP_MODE || 'demo',
    endpoints: [
      'POST /api/orchestrate',
      'GET  /api/bookings',
      'GET  /api/bookings/:id',
      'GET  /api/traces',
      'GET  /api/traces/:id',
      'GET  /api/reminders',
      'GET  /api/notifications',
      'GET  /api/health',
    ],
  });
});

// Start
app.listen(PORT, () => {
  console.log(`\n🚀 AI-SEEKHO Backend running on http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.APP_MODE || 'demo'}`);
  console.log(`   Try: curl -X POST http://localhost:${PORT}/api/orchestrate -H "Content-Type: application/json" -d '{"text":"Mujhe kal subah G-13 mein AC technician chahiye","cityHint":"Islamabad"}'\n`);
});
