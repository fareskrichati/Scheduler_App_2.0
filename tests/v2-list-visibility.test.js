const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../v2/js/app.js'), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\nfunction ', start + 1));
}
for (const [kind, name] of [['event', 'renderEventList'], ['class', 'renderClassList'], ['exam', 'renderExamList']]) {
  test(`${kind} list retains past, current and future records for editing`, () => {
    const items = ['2000-01-01', '2026-10-04', '2099-01-01'].map((date, id) => ({ id, date, time: '10:00', start: '10:00', end: '11:00', status: 'pending' }));
    let rendered;
    const context = vm.createContext({
      state: { data: { courses: [], exams: items } }, elements: {}, examClassFilter: 'all',
      groupScheduleEntries: () => items, renderClassFilter: () => 'all',
      compareByDateTime: (a,b) => a.date.localeCompare(b.date), getStoredItemColor: () => '#fff',
      isTimedItemPast: () => true, isScheduleGroupPast: () => true,
      renderCollection: value => { rendered = value.items; },
      editClassItem() {}, editEventItem() {}, editExam() {}, deleteClassItem() {}, deleteEventItem() {}, deleteExam() {}, toggleExamStatus() {},
    });
    vm.runInContext(extract(name), context);
    context[name]();
    assert.deepEqual(Array.from(rendered, item => item.id), [0,1,2]);
  });
}
