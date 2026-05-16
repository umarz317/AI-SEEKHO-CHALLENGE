const assert = require('node:assert/strict');
const test = require('node:test');
const { runWithAdapter, googleStubs, getMode } = require('../src/tools/mode');

test('mock mode returns mock data without attempting google', async () => {
  process.env.TEST_MODE = 'mock';
  const mockImpl = async () => ({ value: 'mock_data' });
  const googleImpl = async () => { throw new Error('Should not be called'); };
  
  const result = await runWithAdapter('test', mockImpl, googleImpl);
  assert.equal(result.value, 'mock_data');
  assert.equal(result.source, 'mock_test');
  assert.equal(result.adapterMode, 'mock');
});

test('google mode fails when not configured', async () => {
  process.env.TEST_MODE = 'google';
  const mockImpl = async () => ({ value: 'mock_data' });
  const googleImpl = async () => { throw new Error('not_configured'); };

  await assert.rejects(
    () => runWithAdapter('test', mockImpl, googleImpl),
    /not_configured/
  );
});

test('hybrid mode falls back when not configured', async () => {
  process.env.TEST_MODE = 'hybrid';
  const mockImpl = async () => ({ value: 'mock_data' });
  const googleImpl = async () => { throw new Error('not_configured'); };
  
  const result = await runWithAdapter('test', mockImpl, googleImpl);
  assert.equal(result.value, 'mock_data');
  assert.equal(result.source, 'mock_test_fallback_from_hybrid');
  assert.equal(result.adapterMode, 'hybrid');
  assert.equal(result.fallbackReason, 'not_configured');
});

test('hybrid mode falls back when google adapter fails', async () => {
  process.env.TEST_MODE = 'hybrid';
  const mockImpl = async () => ({ value: 'mock_data' });
  const googleImpl = async () => { throw new Error('llm_intent_failed_500'); };

  const result = await runWithAdapter('test', mockImpl, googleImpl);
  assert.equal(result.value, 'mock_data');
  assert.equal(result.source, 'mock_test_fallback_from_hybrid');
  assert.equal(result.adapterMode, 'hybrid');
  assert.equal(result.fallbackReason, 'llm_intent_failed_500');
});

test('google mode uses real adapter when configured', async () => {
  process.env.TEST_MODE = 'google';
  const mockImpl = async () => ({ value: 'mock_data' });
  const googleImpl = async () => ({ value: 'real_data' });
  
  const result = await runWithAdapter('test', mockImpl, googleImpl);
  assert.equal(result.value, 'real_data');
  assert.equal(result.source, 'google_test');
  assert.equal(result.adapterMode, 'google');
});
