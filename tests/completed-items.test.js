const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/app.js'), 'utf8');
function contextFor(data) {
  const context = { state: { data }, Date, DONE_DISAPPEAR_DELAY_MS: 30000,
    compareByDateTime: (a, b) => a.date.localeCompare(b.date), getStoredItemColor: () => '#ffffff' };
  vm.createContext(context);
  for (const [start, end] of [['function setItemStatus(', 'function scheduleCompletionSweep('], ['function getNextVisibleOccurrences(', 'function renderExamList('], ['function groupReminderEntries(', 'function groupScheduleEntries(']]) {
    vm.runInContext(source.slice(source.indexOf(start), source.indexOf(end)), context);
  }
  return context;
}
test('Cleanup retains completed homework, exams, and reminders beyond the old timeout', () => {
  const item = { id: 'done', status: 'done', completedAt: String(Date.now() - 86400000), date: '2026-01-01' };
  const data = { homework: [{ ...item }], exams: [{ ...item }], reminders: [{ ...item }], schedule: [] };
  const context = contextFor(data);
  context.pruneExpiredCompletedItems();
  for (const key of ['homework', 'exams', 'reminders']) assert.equal(data[key].length, 1);
  context.setItemStatus(data.homework[0], 'pending');
  assert.equal(data.homework[0].status, 'pending');
  assert.equal(data.homework[0].completedAt, '');
});
test('Recurring lists retain completed occurrences alongside the next pending occurrence', () => {
  const items = [
    { id: 'done', seriesId: 'series', date: '2026-01-01', status: 'done' },
    { id: 'next', seriesId: 'series', date: '2026-09-08', status: 'pending' },
    { id: 'future', seriesId: 'series', date: '2026-09-15', status: 'pending' },
  ];
  const context = contextFor({ reminders: items });
  assert.equal(context.getNextVisibleOccurrences(items, '2026-09-07').map(item => item.id).join(','), 'done,next');
  assert.equal(context.groupReminderEntries().map(item => item.id).join(','), 'done,next');
  items[1].status = 'done'; items[2].status = 'done';
  assert.equal(context.getNextVisibleOccurrences(items).length, 3);
});
