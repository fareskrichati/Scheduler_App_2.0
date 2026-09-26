const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
const context = vm.createContext({});
for (const [start, end] of [['buildLocationMapLinks', 'renderDaySummary'], ['escapeHtml', null]]) {
  const text = source.slice(source.indexOf(`function ${start}(`));
  vm.runInContext(end ? text.slice(0, text.indexOf(`function ${end}(`)) : text.slice(0, text.indexOf('\n}') + 2), context);
}
test('Map links preserve full addresses and safely encode special characters', () => {
  const address = `123 O'Farrell St & 2nd, Montréal #4 <West> "A"`;
  const html = context.buildLocationMapLinks(`  ${address}  `);
  const urls = [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&').replaceAll('&#39;', "'")));
  assert.equal(urls.length, 2);
  assert.equal(urls[0].hostname, 'www.google.com');
  assert.equal(urls[0].searchParams.get('api'), '1');
  assert.equal(urls[0].searchParams.get('query'), address);
  assert.equal(urls[1].hostname, 'maps.apple.com');
  assert.equal(urls[1].searchParams.get('q'), address);
  assert.ok(!html.includes('<West>'));
  assert.equal((html.match(/rel="noopener noreferrer"/g) || []).length, 2);
});
test('Empty locations do not show map links', () => {
  for (const location of ['', '  ', undefined, null]) assert.equal(context.buildLocationMapLinks(location), '');
});
