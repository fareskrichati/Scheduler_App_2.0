const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('netlify/functions/event-photo-import.js', 'utf8');
const config = { window: {} };
vm.runInNewContext(fs.readFileSync('js/config.js', 'utf8'), config);
const publicConfig = config.window.DAILY_PLANNER_SUPABASE;

test('event recognition is text-first and returns the source transcription', () => {
  assert.match(source, /First transcribe the visible text/);
  assert.match(source, /required: \["sourceText", "events"\]/);
  assert.match(source, /sourceText: \{ type: "string" \}/);
});

function run(authorization, response, extraEnv = {}) {
  const calls = [];
  const context = {
    exports: {},
    process: { env: { OPENAI_API_KEY: 'test-only', SUPABASE_URL: publicConfig.url, ...extraEnv } },
    fetch: async (url, options) => { calls.push({ url, options }); return response; },
  };
  vm.runInNewContext(source, context);
  return context.exports.handler({ httpMethod: 'POST', headers: { authorization }, body: '{"images":[]}' })
    .then(result => ({ result, calls }));
}

test('fallback uses the exact login key and verifies the user before reading images', async () => {
  const { result, calls } = await run('Bearer test-session', { ok: true });
  assert.equal(calls[0].options.headers.apikey, publicConfig.anonKey);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-session');
  assert.equal(calls[0].url, `${publicConfig.url}/auth/v1/user`);
  assert.equal(result.statusCode, 400); // Auth passed; empty images rejected.
});

test('configured publishable key overrides fallback', async () => {
  const { calls } = await run('Bearer test-session', { ok: true }, { SUPABASE_PUBLISHABLE_KEY: 'configured-public-key' });
  assert.equal(calls[0].options.headers.apikey, 'configured-public-key');
});

test('missing sign-in cannot reach recognition', async () => {
  const { result, calls } = await run(undefined);
  assert.equal(result.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('invalid API key is a server configuration error', async () => {
  const { result, calls } = await run('Bearer test-session', { ok: false, status: 401, json: async () => ({ message: 'Invalid API key' }) });
  assert.equal(result.statusCode, 503);
  assert.match(JSON.parse(result.body).error, /Signing in again will not fix/);
  assert.equal(calls.length, 1);
});

test('invalid user session still requires sign-in', async () => {
  const { result } = await run('Bearer expired', { ok: false, status: 401, json: async () => ({ msg: 'JWT expired' }) });
  assert.equal(result.statusCode, 401);
});

test('upstream outage does not ask users to sign in again', async () => {
  const { result } = await run('Bearer test-session', { ok: false, status: 503, json: async () => { throw new Error('not JSON'); } });
  assert.equal(result.statusCode, 503);
  assert.match(JSON.parse(result.body).error, /temporarily unavailable/);
});
