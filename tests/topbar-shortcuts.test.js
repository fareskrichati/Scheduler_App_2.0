const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mobile topbar shortcuts share one size rule', () => {
  const css = fs.readFileSync(path.join(__dirname, '../css/mobile.css'), 'utf8');
  const sharedRule = css.match(/\.topbar-shortcuts \.canvas-shortcut-button,\s*\.topbar-shortcuts \.mobile-quick-add-button,\s*\.topbar-shortcuts \.settings-button\s*\{([^}]+)\}/);
  assert.ok(sharedRule, 'all three shortcuts should use a shared rule');
  assert.match(sharedRule[1], /width:\s*40px/);
  assert.match(sharedRule[1], /height:\s*40px/);
  assert.match(sharedRule[1], /flex:\s*0 0 40px/);
});
