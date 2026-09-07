const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
function extract(name, next) { return source.slice(source.indexOf(`async function ${name}(`), source.indexOf(`async function ${next}(`)); }
for (const session of [null, { access_token: 'test' }]) {
  test(`Canvas setup survives signup with ${session ? 'an immediate session' : 'email confirmation'}`, async () => {
    const saved = new Map(); let request; let writes = 0;
    const context = {
      elements: { setupStatus: {}, loginForm: {}, profileSetupForm: {}, loginStatus: {} },
      supabaseClient: { auth: { signUp: async (args) => { request = args; return { data: { user: { id: 'test-user', email: 'test@example.com' }, session } }; } } },
      pendingFirstLogin: { email: 'test@example.com', password: 'test-password' },
      state: { data: { settings: {} } }, authState: {},
      localStorage: { setItem: (key, value) => saved.set(key, value) },
      syncSettingsFromAuthProfile() {}, saveDataToSupabase: async () => { writes++; },
      saveLoginSession() {}, renderSettings() {}, updateAuthView() {},
    };
    vm.createContext(context);
    vm.runInContext(extract('signUpWithSupabase', 'applySupabaseUser'), context);
    const setup = { school: 'School', url: 'https://school.instructure.com', feed: 'https://school.instructure.com/feeds/calendars/test.ics' };
    await context.signUpWithSupabase('Test', '555', setup);
    assert.equal(context.state.data.settings.canvasFeedUrl, setup.feed);
    assert.equal(JSON.parse(saved.get('uniplan-canvas-setup:test-user')).feed, setup.feed);
    assert.equal(request.options.data.canvasShortcut.school, 'School');
    assert.equal(JSON.stringify(request.options.data).includes(setup.feed), false);
    assert.equal(writes, session ? 1 : 0);
  });
}
test('First login restores a pending private feed after email confirmation', async () => {
  const setup = { school: 'School', url: 'https://school.instructure.com', feed: 'https://school.instructure.com/feeds/calendars/test.ics' };
  let writes = 0;
  const context = { authState: {}, state: { data: { settings: { canvasFeedUrl: '', canvasShortcut: { school: '', url: '' } } } },
    loadDataFromSupabase: async () => null, syncSettingsFromAuthProfile() {},
    normalizeCanvasShortcutUrl: value => value || '', isCanvasFeedUrl: value => value === setup.feed,
    localStorage: { getItem: key => key === 'uniplan-canvas-setup:test-user' ? JSON.stringify(setup) : null },
    saveDataToSupabase: async () => { writes++; }, saveDataLocally() {}, subscribeToPlannerChanges() {},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function applySupabaseUser('), source.indexOf('function subscribeToPlannerChanges(')), context);
  await context.applySupabaseUser({ id: 'test-user', email: 'test@example.com', user_metadata: {} });
  assert.equal(context.state.data.settings.canvasFeedUrl, setup.feed);
  assert.equal(context.state.data.settings.canvasShortcut.school, setup.school);
  assert.equal(writes, 1);
});
