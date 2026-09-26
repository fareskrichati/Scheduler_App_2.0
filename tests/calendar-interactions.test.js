const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert.notEqual(start, -1, `${name} should exist`);
  assert.notEqual(end, -1, `${nextName} should follow ${name}`);
  return source.slice(start, end);
}

test('a held calendar day force-prefills every Quick Add date', () => {
  const elements = {
    classDate: { value: '2026-01-01' },
    eventDate: { value: '2026-01-01' },
    homeworkDate: { value: '2026-01-01' },
    reminderDate: { value: '2026-01-01' },
    examDate: { value: '2026-01-01' },
  };
  const context = vm.createContext({
    elements,
    state: { selectedDate: '2026-09-23' },
    syncRepeatSelectionWithDate() {},
  });
  vm.runInContext(functionSource('prefillForms', 'renderColorMatchOptions'), context);
  context.prefillForms(true);
  Object.values(elements).forEach(field => assert.equal(field.value, '2026-09-23'));
});

test('normal form prefilling still preserves a date already being edited', () => {
  const elements = {
    classDate: { value: '2026-10-12' },
    eventDate: { value: '' },
    homeworkDate: { value: '' },
    reminderDate: { value: '' },
    examDate: { value: '' },
  };
  const context = vm.createContext({
    elements,
    state: { selectedDate: '2026-09-23' },
    syncRepeatSelectionWithDate() {},
  });
  vm.runInContext(functionSource('prefillForms', 'renderColorMatchOptions'), context);
  context.prefillForms();
  assert.equal(elements.classDate.value, '2026-10-12');
  assert.equal(elements.eventDate.value, '2026-09-23');
});

test('calendar pages expose the draggable three-view control', () => {
  for (const page of ['index.html', 'mobile.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /calendar-view-switch[^>]+data-active-index="1"/);
    assert.equal((html.match(/data-calendar-view=/g) || []).length, 3);
  }
  assert.match(source, /setupCalendarViewDrag\(\)/);
  assert.match(source, /prefillForms\(true\)/);
});
