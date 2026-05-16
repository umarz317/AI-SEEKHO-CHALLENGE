// agents/traceAgent.js — Agent 7: Trace Logger
// Builds a detailed trace of the entire orchestration

const store = require('../storage/localStore');

/**
 * Builds a trace from all agent step results.
 * @param {{ steps: Array<{ agent: string, tool: string, source: string, status: string, output: string, icon: string, color: string }> }} input
 * @returns {object} complete trace
 */
function run(input) {
  const { steps } = input;

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const seq = store.nextSequence('traces');
  const traceId = `TRC-${dateStr}-${seq}`;

  const trace = {
    traceId,
    totalSteps: steps.length,
    allSuccessful: steps.every(s => s.status === 'success'),
    events: steps.map((s, i) => ({
      step: i + 1,
      agent: s.agent,
      tool: s.tool,
      source: s.source,
      status: s.status,
      icon: s.icon,
      color: s.color,
      output: s.output,
    })),
    traceSummary: steps.map(s => s.summary || s.output),
    createdAt: new Date().toISOString(),
  };

  return store.insert('traces', trace);
}

function getTrace(traceId) {
  return store.findById('traces', 'traceId', traceId);
}

function getAllTraces() {
  return store.list('traces');
}

module.exports = { run, getTrace, getAllTraces };
