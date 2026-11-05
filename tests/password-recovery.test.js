const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../v2/js/app.js'), 'utf8');
function setup(mode = 'email') {
  const fields = Object.fromEntries(['status', 'submit', 'email', 'password', 'confirm'].map(id => [`#recovery-${id}`, { value: id === 'email' ? 'student@example.com' : 'new-password' }]));
  fields['#password-recovery-form'] = { reset() {} };
  const calls = [];
  const ctx = { passwordRecoveryMode: mode, recoverySessionReady: true, document: { querySelector: id => fields[id] },
    supabaseClient: { auth: { resetPasswordForEmail: async (...args) => { calls.push(args); return {}; }, updateUser: async args => { calls.push(args); return {}; }, signOut: async () => {} } },
    window: { location: { pathname: '/v2/index.html', origin: 'https://planner.example' } }, URL,
    isValidEmail: email => email.includes('@'), elements: { loginPassword: {}, loginStatus: {} }, history: { replaceState() {} }, setAuthMode() {} };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('async function handlePasswordRecovery('), source.indexOf('async function handleLoginSubmit(')), ctx);
  return {ctx, fields, calls, submit: () => ctx.handlePasswordRecovery({ preventDefault() {} })};
}
test('requests a reset email with a return URL and neutral confirmation', async () => {
  const t = setup(); await t.submit();
  assert.equal(t.calls[0][0], 'student@example.com');
  assert.equal(t.calls[0][1].redirectTo, 'https://planner.example/v2/index.html?password-reset=1');
  assert.match(t.fields['#recovery-status'].textContent, /If an account exists/);
  assert.equal(t.fields['#recovery-submit'].disabled, false);
});
test('rejects mismatched passwords without updating the account', async () => {
  const t = setup('reset'); t.fields['#recovery-confirm'].value = 'different'; await t.submit();
  assert.equal(t.calls.length, 0); assert.match(t.fields['#recovery-status'].textContent, /do not match/);
});
test('rejects expired reset sessions', async () => {
  const t = setup('reset'); t.ctx.recoverySessionReady = false; await t.submit();
  assert.equal(t.calls.length, 0); assert.match(t.fields['#recovery-status'].textContent, /invalid or expired/);
});
test('updates a matching password and returns to login', async () => {
  const t = setup('reset'); await t.submit();
  assert.equal(t.calls[0].password, 'new-password'); assert.equal(t.ctx.passwordRecoveryMode, '');
  assert.match(t.ctx.elements.loginStatus.textContent, /Password updated/);
});
test('shows service errors and permits retry', async () => {
  const t = setup(); t.ctx.supabaseClient.auth.resetPasswordForEmail = async () => { throw new Error('Try again later'); }; await t.submit();
  assert.equal(t.fields['#recovery-status'].textContent, 'Try again later'); assert.equal(t.fields['#recovery-submit'].disabled, false);
});
