const fs = require('fs');
const path = require('path');
const { orchestrate } = require('../src/services/orchestrator');

const ARTIFACTS_DIR = path.join(__dirname, '../../antigravity/artifacts');

async function generate() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  console.log('Generating demo artifacts...');
  const result = await orchestrate({
    text: 'Mujhe kal subah G-13 mein AC technician chahiye',
    cityHint: 'Islamabad',
  });

  // 1. extracted-request.json
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'extracted-request.json'),
    JSON.stringify(result.requestUnderstanding, null, 2)
  );

  // 2. provider-ranking.json
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'provider-ranking.json'),
    JSON.stringify({
      recommendation: result.recommendation,
      alternatives: result.alternatives
    }, null, 2)
  );

  // 3. booking-receipt.json
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'booking-receipt.json'),
    JSON.stringify(result.booking, null, 2)
  );

  // 4. agent-trace.md
  const traceLines = ['# Agent Orchestration Trace', ''];
  traceLines.push(`**Trace ID:** ${result.traceId}`);
  traceLines.push(`**Status:** ${result.status}`);
  traceLines.push('');
  
  result.trace.forEach(step => {
    traceLines.push(`### Step: ${step.agent}`);
    traceLines.push(`- **Tool:** \`${step.tool}\``);
    traceLines.push(`- **Source:** ${step.source}`);
    traceLines.push(`- **Status:** ${step.status}`);
    traceLines.push(`- **Output:** ${step.output}`);
    traceLines.push('');
  });

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'agent-trace.md'),
    traceLines.join('\n')
  );

  console.log('Done! Artifacts generated in antigravity/artifacts/');
}

generate().catch(console.error);
