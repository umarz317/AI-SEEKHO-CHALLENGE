// storage/localStore.js — tiny JSON persistence for demo state

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'runtime');
const DB_FILE = path.join(DATA_DIR, 'demo-state.json');

const DEFAULT_STATE = {
  bookings: [],
  reminders: [],
  notifications: [],
  inboundMessages: [],
  pushTokens: [],
  traces: [],
};

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    writeState(DEFAULT_STATE);
  }
}

function readState() {
  ensureStore();
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return { ...DEFAULT_STATE, ...parsed };
  } catch (err) {
    const corruptFile = `${DB_FILE}.corrupt-${Date.now()}`;
    fs.renameSync(DB_FILE, corruptFile);
    writeState(DEFAULT_STATE);
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2));
  fs.renameSync(tmpFile, DB_FILE);
}

function list(collection) {
  const state = readState();
  return state[collection] || [];
}

function insert(collection, record) {
  const state = readState();
  const records = state[collection] || [];
  state[collection] = [...records, record];
  writeState(state);
  return record;
}

function updateById(collection, idField, id, updater) {
  const state = readState();
  const records = state[collection] || [];
  let updated = null;
  state[collection] = records.map((record) => {
    if (record[idField] !== id) return record;
    updated = typeof updater === 'function'
      ? updater(record)
      : { ...record, ...updater };
    return updated;
  });
  if (!updated) return null;
  writeState(state);
  return updated;
}

function findById(collection, idField, id) {
  return list(collection).find((record) => record[idField] === id) || null;
}

function nextSequence(collection) {
  return String(list(collection).length + 1).padStart(3, '0');
}

module.exports = {
  DB_FILE,
  findById,
  insert,
  list,
  nextSequence,
  updateById,
};
