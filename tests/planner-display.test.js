const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
function load(context, name, next) {
  vm.runInContext(source.slice(source.indexOf(`function ${name}(`), source.indexOf(`function ${next}(`)), context);
}
test('Overdue to-dos remain in the list and header count until completed', () => {
  const pending = (id, extra = {}) => ({ id, date: '2020-01-01', status: 'pending', ...extra });
  const context = vm.createContext({
    state: { selectedDate: '2026-09-25', data: {
      homework: [pending('homework'), pending('recurring', {seriesId:'series'}), pending('future', {seriesId:'series', date:'2099-01-01'})],
      exams: [pending('exam')], reminders: [pending('reminder')]
    } },
    elements: { headerTodoCount: {}, headerHomeworkCount: {}, headerExamCount: {}, todayClassesCount: {} },
    getStoredItemColor: () => '#123456', countGroupedItemsOnDate: () => 0,
    compareByDateTime: (a,b) => a.date.localeCompare(b.date)
  });
  load(context, 'getNextVisibleOccurrences', 'renderExamList');
  load(context, 'getTodoItems', 'renderTodoList');
  load(context, 'renderHeaderStats', 'renderCalendar');
  assert.equal(context.getTodoItems().map(x => x.id).join(','), 'homework,recurring,exam,reminder');
  context.renderHeaderStats();
  assert.equal(context.elements.headerTodoCount.textContent, '4');
  assert.equal(context.elements.headerHomeworkCount.textContent, '2');
  assert.equal(context.elements.headerExamCount.textContent, '1');
  context.state.data.exams[0].status = 'done';
  context.renderHeaderStats();
  assert.equal(context.elements.headerTodoCount.textContent, '3');
  assert.equal(context.elements.headerExamCount.textContent, '0');
  assert.equal(context.getTodoItems().find(x => x.id === 'exam').status, 'done');
});

test('Coursework imports skip an existing name and date but retain a changed date', () => {
  const context = vm.createContext({ state: { data: {
    homework: [{ title: 'Chapter 4: Review!', date: '2026-10-01' }],
    exams: [{ title: 'Midterm Exam', date: '2026-10-02' }],
  } } });
  load(context, 'dedupeDetectedHomework', 'renderDetectedHomework');
  const items = [
    { title: 'chapter 4 review', date: '2026-10-01' },
    { title: 'Chapter 4 Review', date: '2026-10-08' },
    { title: 'MIDTERM EXAM', date: '2026-10-02' },
    { title: 'New paper', date: '2026-10-03' },
    { title: 'New paper!', date: '2026-10-03' },
  ];
  const unique = context.dedupeDetectedHomework(items);
  assert.equal(unique.length, 4);
  assert.deepEqual(
    Array.from(context.removeAlreadyAddedCoursework(unique), item => `${item.title}|${item.date}`),
    ['Chapter 4 Review|2026-10-08', 'New paper|2026-10-03'],
  );
});

test('App customization is presented as a dropdown on desktop and mobile', () => {
  for (const page of ['index.html', 'mobile.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /<details id="app-customization"[^>]*>/);
    assert.match(html, /<summary>App customization<\/summary>/);
  }
});
