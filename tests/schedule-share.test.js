const test = require('node:test');
const assert = require('node:assert/strict');
const { scheduleRows } = require('../js/schedule-share.js');
test('Sharing preserves exact dates, changed times, and online classes without private notes', () => {
  const course = { type: 'class', title: 'Physics', start: '09:00', end: '10:00', location: 'Room 4', notes: 'Private' };
  const schedule = [
    { ...course, date: '2026-10-12' },
    { ...course, date: '2026-10-05' },
    { ...course, date: '2026-10-05' },
    { ...course, date: '2026-10-19', start: '11:00', end: '12:00' },
    { ...course, type: 'event', date: '2026-10-06' },
  ];
  const original = JSON.stringify(schedule);
  const rows = scheduleRows(schedule, [{ title: 'Online art', notes: 'Private' }]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0].dates, ['2026-10-05', '2026-10-12']);
  assert.equal(rows[1].start, '11:00');
  assert.equal(rows[2].online, true);
  assert.equal(JSON.stringify(rows).includes('Private'), false);
  assert.equal(JSON.stringify(schedule), original);
});
test('Empty schedules are recognized', () => assert.deepEqual(scheduleRows([], []), []));
test('Shared weekdays are unique and ordered Monday through Sunday', () => {
  const { weekdayLabel } = require('../js/schedule-share.js');
  assert.equal(weekdayLabel(['2026-08-26', '2026-08-24', '2026-08-31', '2026-09-02']), 'Monday, Wednesday');
  assert.equal(weekdayLabel(['2026-09-27', '2026-09-26', '2026-09-21']), 'Monday, Saturday, Sunday');
});
test('Large schedules produce exactly one image with all classes and no date lists', async () => {
  const { makeImages } = require('../js/schedule-share.js');
  const texts = [];
  let appliedScale;
  const context = {
    measureText: text => ({ width: text.length * 15 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, roundRect() {}, fill() {}, save() {}, translate() {},
    scale: x => { appliedScale = x; }, restore() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText: text => texts.push(text),
  };
  const originalDocument = global.document;
  global.document = { createElement: () => ({ getContext: () => context, toBlob: callback => callback(new Blob(['image'])) }) };
  try {
    const rows = Array.from({ length: 30 }, (_, i) => ({ title: `Course ${i}`, start: '09:00', end: '10:00', dates: ['2026-08-24', '2026-08-26'] }));
    const files = await makeImages(rows);
    assert.equal(files.length, 1);
    assert.equal(files[0].name, 'uniplan-schedule.png');
    assert.ok(appliedScale < 1);
    for (const row of rows) assert.ok(texts.includes(row.title));
    assert.equal(texts.filter(text => text === 'Monday, Wednesday').length, 30);
    assert.ok(!texts.some(text => text.includes('2026') || text.includes('Page')));
  } finally { global.document = originalDocument; }
});
