const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('v2/js/v2-runtime.js', 'utf8');
function next(homework, exams) {
 const context = vm.createContext({state:{data:{homework,exams}}, isoDate:()=> '2026-10-08', Date});
 vm.runInContext(source.slice(source.indexOf('function v2NextDueCoursework(')), context);
 return context.v2NextDueCoursework(new Date('2026-10-08T12:00:00'));
}
test('Coming up chooses the nearest homework or quiz across collections', () => {
 const homework = [{title:'Homework',date:'2026-10-08',time:'14:00'}];
 assert.equal(next(homework,[{title:'Quiz',date:'2026-10-08',time:'13:00'}]).title,'Quiz');
 assert.equal(next(homework,[{title:'Exam',date:'2026-10-09',time:'09:00'}]).title,'Homework');
});
test('Coming up excludes completed and past deadlines, retaining undated-time work today', () => {
 assert.equal(next([{title:'Done',date:'2026-10-09',status:'done'},{title:'Past',date:'2026-10-07'},{title:'Earlier',date:'2026-10-08',time:'11:00'},{title:'Today',date:'2026-10-08'}],[]).title,'Today');
 assert.equal(next([],[]),undefined);
 assert.equal(next([{title:'Any time',date:'2026-10-08'},{title:'Timed',date:'2026-10-08',time:'18:00'}],[]).title,'Timed');
});
