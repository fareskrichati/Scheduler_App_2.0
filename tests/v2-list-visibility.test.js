const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const UniPlanTerms = require('../v2/js/academic-terms');
const source = fs.readFileSync(require('node:path').join(__dirname, '../v2/js/app.js'), 'utf8');
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  return source.slice(start, source.indexOf('\nfunction ', start + 1));
}
function element() {
  return {
    children: [], dataset: {},
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  };
}

function classListElements() {
  return { classList: element(), currentClassTerm: element(), upcomingClassTerms: element() };
}

for (const [kind, name] of [['event', 'renderEventList'], ['class', 'renderClassList'], ['exam', 'renderExamList']]) {
  test(`${kind} list retains past, current and future records for editing`, () => {
    const items = ['2000-01-01', '2026-10-04', '2099-01-01'].map((date, id) => ({ id, date, time: '10:00', start: '10:00', end: '11:00', status: 'pending' }));
    let rendered;
    const context = vm.createContext({
      state: { data: { courses: [], exams: items } }, elements: classListElements(), document: { createElement: element }, examClassFilter: 'all',
      UniPlanTerms, todayString: () => '2026-10-04',
      groupScheduleEntries: (_, include = () => true) => items.filter(include), renderClassFilter: () => 'all',
      compareByDateTime: (a,b) => a.date.localeCompare(b.date), getStoredItemColor: () => '#fff',
      isTimedItemPast: () => true, isScheduleGroupPast: () => true,
      renderCollection: value => { rendered = value.items; },
      editClassItem() {}, editEventItem() {}, editExam() {}, deleteClassItem() {}, deleteEventItem() {}, deleteExam() {}, toggleExamStatus() {}, openStudyPlanForExam() {},
    });
    vm.runInContext(extract(name), context);
    context[name]();
    assert.deepEqual(Array.from(rendered, item => item.id), [0,1,2]);
  });
}


test('the Classes tab follows term dates while the calendar retains both terms and finals', () => {
  const fall = { id: 'fall', termName: 'Fall 2026', start: '2026-08-24', end: '2026-12-11', finalsEnd: '2026-12-18' };
  const spring = { id: 'spring', termName: 'Spring 2027', start: '2027-01-21', end: '2027-05-05' };
  const schedule = [
    { id: 'fall-class', type: 'class', date: '2026-12-10', title: 'Physics' },
    { id: 'spring-class', type: 'class', date: '2027-01-21', title: 'Statics' },
  ];
  const data = {
    settings: { academicCalendars: [fall, spring] }, schedule, courses: [],
    exams: [{ id: 'fall-final', date: '2026-12-18', title: 'Final Exam' }],
    homework: [], reminders: [],
  };
  const elements = classListElements();
  let today;
  const context = vm.createContext({
    state: { data }, elements, UniPlanTerms, document: { createElement: element },
    todayString: () => today,
    groupScheduleEntries: (_, include) => schedule.filter(include),
    renderCollection: ({ target, items }) => { target.ids = Array.from(items, ({ id }) => id); },
    editClassItem() {}, deleteClassItem() {}, getStoredItemColor() {}, formatTime() {},
  });
  for (const name of ['renderClassList', 'getItemsForDate']) vm.runInContext(extract(name), context);
  for (const [date, expected] of [
    ['2026-11-15', ['fall-class']],
    ['2026-12-18', ['fall-class']],
    ['2026-12-19', []],
    ['2027-01-20', []],
    ['2027-01-21', ['spring-class']],
    ['2027-05-06', []],
  ]) {
    today = date;
    context.renderClassList();
    assert.deepEqual(elements.classList.ids, expected, date);
    const upcoming = elements.upcomingClassTerms.children;
    assert.deepEqual(upcoming.map((section) => section.children[1].ids), date < spring.start ? [['spring-class']] : [], date);
    if (upcoming.length) {
      const [section] = upcoming;
      assert.equal(section.children[0].textContent, 'Spring 2027 · Upcoming');
      assert.equal(section.open, date !== '2026-11-15');
      section.open = true;
    }
    assert.equal(context.getItemsForDate('2026-12-10')[0].sourceId, 'fall-class');
    assert.equal(context.getItemsForDate('2026-12-18')[0].sourceId, 'fall-final');
    assert.equal(context.getItemsForDate('2027-01-21')[0].sourceId, 'spring-class');
  }
});


for (const [termSystem, label] of [['quarter', 'Quarter'], ['trimester', 'Trimester']]) {
  test(`upcoming ${termSystem} classes have their own collapsed section`, () => {
    const elements = classListElements();
    const term = { id: 'next', termSystem, start: '2027-01-04', end: '2027-03-12' };
    const course = { title: 'Physics', termId: term.id };
    const data = { settings: { academicCalendars: [term] }, courses: [course] };
    const context = vm.createContext({
      state: { data }, elements, UniPlanTerms, document: { createElement: element },
      todayString: () => '2026-11-15', formatShortDate: () => 'Jan 4',
      groupScheduleEntries: () => [], renderCollection: ({ target, items }) => { target.items = items; },
      editClassItem() {}, deleteClassItem() {},
    });
    vm.runInContext(extract('renderClassList'), context);
    context.renderClassList();
    assert.equal(elements.classList.items.length, 0);
    const [section] = elements.upcomingClassTerms.children;
    assert.equal(section.open, false);
    assert.equal(section.children[0].textContent, `${label} starting Jan 4 · Upcoming`);
    assert.equal(section.children[1].items[0].title, course.title);
  });
}
