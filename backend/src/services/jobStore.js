const { randomUUID } = require('crypto');

const jobs = new Map();
const MAX_JOBS = 50;

function createJob(input) {
  pruneJobs();
  const jobId = `JOB-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const job = {
    jobId,
    status: 'queued',
    input,
    events: [],
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function markRunning(jobId) {
  updateJob(jobId, { status: 'running' });
}

function appendEvent(jobId, event) {
  const job = getJob(jobId);
  if (!job) return null;
  const nextEvent = {
    index: job.events.length,
    at: new Date().toISOString(),
    ...event,
  };
  job.events.push(nextEvent);
  job.updatedAt = nextEvent.at;
  return nextEvent;
}

function completeJob(jobId, result) {
  updateJob(jobId, {
    status: 'complete',
    result,
    error: null,
  });
}

function failJob(jobId, error) {
  updateJob(jobId, {
    status: 'failed',
    error: {
      message: error.message || 'Orchestration failed.',
      code: error.code || 'orchestration_failed',
    },
  });
}

function updateJob(jobId, patch) {
  const job = getJob(jobId);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
}

function serializeJob(job) {
  if (!job) return null;
  return {
    jobId: job.jobId,
    status: job.status,
    events: job.events,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function pruneJobs() {
  if (jobs.size < MAX_JOBS) return;
  const oldest = [...jobs.values()]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, jobs.size - MAX_JOBS + 1);
  for (const job of oldest) {
    jobs.delete(job.jobId);
  }
}

module.exports = {
  appendEvent,
  completeJob,
  createJob,
  failJob,
  getJob,
  markRunning,
  serializeJob,
};
