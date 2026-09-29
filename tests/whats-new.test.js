const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

function whatsNewFunctions() {
  const start = source.indexOf('function getWhatsNewStorageKey()');
  const end = source.indexOf('function createSupabaseClient()', start);
  return source.slice(start, end);
}

function makeContext() {
  const values = new Map();
  const dialog = { open: false, showModal() { this.open = true; } };
  const context = vm.createContext({
    WHATS_NEW_STORAGE_PREFIX: 'uniplan-whats-new',
    WHATS_NEW_VERSION: '1.5.1',
    authState: { isAuthenticated: true, userId: 'student-1', profile: { email: 'student@example.com' } },
    elements: { whatsNewDialog: dialog },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  vm.runInContext(whatsNewFunctions(), context);
  return { context, dialog, values };
}

test('what’s new opens once per user and update version', () => {
  const { context, dialog } = makeContext();
  assert.equal(context.showWhatsNew(), true);
  assert.equal(dialog.open, true);
  dialog.open = false;
  context.markWhatsNewSeen();
  assert.equal(context.showWhatsNew(), false);
  assert.equal(dialog.open, false);
});

test('Settings can reopen what’s new after it has been seen', () => {
  const { context, dialog } = makeContext();
  context.markWhatsNewSeen();
  assert.equal(context.showWhatsNew(true), true);
  assert.equal(dialog.open, true);
});

test('what’s new stays scoped to each signed-in account', () => {
  const { context, values } = makeContext();
  context.markWhatsNewSeen();
  assert.equal(values.get('uniplan-whats-new:student-1'), '1.5.1');
  context.authState.userId = 'student-2';
  assert.equal(context.hasSeenWhatsNew(), false);
});

test('desktop and mobile include the update dialog and reopen button', () => {
  for (const page of ['index.html', 'mobile.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /id="whats-new-dialog"/);
    assert.match(html, /id="settings-whats-new"/);
    assert.match(html, /Update 1\.5\.1/);
    assert.match(html, /Today’s date on laptop/);
    assert.match(html, /Canvas imports match class colors/);
    assert.match(html, /class="update-comparison"/);
    assert.match(html, /Before and now/);
    assert.match(html, /<summary>View Update 1\.5<\/summary>/);
    assert.match(html, /<summary>View Update 1\.0<\/summary>/);
    assert.match(html, /Cleaner mobile header/);
    assert.match(html, /Compact month view/);
    assert.match(html, /Consistent mobile controls/);
    assert.match(html, /Better themes/);
    assert.match(html, /Customize UniPlan/);
    assert.match(html, /Share your class schedule/);
    assert.match(html, /Open locations in Maps/);
    assert.match(html, /A more useful calendar/);
  }
});
