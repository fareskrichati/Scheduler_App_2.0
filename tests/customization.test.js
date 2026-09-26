const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/customization.js'),'utf8')+'\nthis.customization = PlannerCustomization;',context);
const c = context.customization;
test('Missing or malformed customization safely uses defaults',()=>{
  assert.equal(JSON.stringify(c.normalize(null)),JSON.stringify(c.defaults()));
  const normalized=c.normalize({mode:'invalid',accentColor:'url(example)',cards:['exams','exams','invalid','toString'],hiddenCards:['classes','bad'],weekStart:'monday'});
  assert.equal(normalized.mode,'light');assert.equal(normalized.accentColor,'#7eaed6');
  assert.equal(normalized.cards.join(','),'exams,todo,homework,classes');
  assert.equal(normalized.hiddenCards.join(','),'classes');assert.equal(normalized.weekStart,'monday');
});
test('Presets combine appearance options without carrying custom colors or hidden cards',()=>{
  const midnight=c.preset('midnight');assert.equal(midnight.theme,'ocean');
  assert.equal(midnight.customization.mode,'dark');assert.equal(midnight.customization.background,'solid');assert.equal(midnight.customization.decorations,false);
  const christmas=c.preset('christmas');assert.equal(christmas.customization.decorations,true);assert.equal(christmas.customization.font,'rounded');
  for(const key of ['classic','christmas','halloween','valentine','spring','autumn','ocean','lavender','sunset','midnight']) {
    const p=c.preset(key);assert.equal(p.customization.customColors,false);assert.equal(p.customization.cards.length,4);assert.equal(p.customization.hiddenCards.length,0);
    assert.equal(JSON.stringify(c.normalize(JSON.parse(JSON.stringify(p.customization)))),JSON.stringify(p.customization));
  }
});
test('Default preferences are fresh objects, so editing cards cannot corrupt reset',()=>{
  const modified=c.defaults();modified.cards.reverse();modified.hiddenCards.push('todo');
  assert.equal(c.defaults().cards.join(','),'todo,homework,exams,classes');assert.equal(c.defaults().hiddenCards.length,0);
});
test('Monday start aligns month and week grids, including a Sunday month start',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
  const run=vm.createContext({Date, state:{calendarView:'month',visibleMonth:'2026-02-01',selectedDate:'2026-02-01'},
    getSettings:()=>({customization:{weekStart:'monday',defaultView:'week'}}), renderWeekdays(){},
    document:{body:{classList:{contains:()=>false}}},window:{matchMedia:()=>({matches:false})},
    elements:{calendarViewButtons:[],calendarGrid:{dataset:{}},calendarWeekdays:{},calendarMonthLabel:{}},
    isoDate:date=>date.toISOString().slice(0,10),formatShortDate:value=>value});
  const code=source.slice(source.indexOf('function renderCalendar() {'), source.indexOf('  for (let index = 0; index < cellCount;',source.indexOf('function renderCalendar() {')))+' return {firstDay,cellCount}; }';
  vm.runInContext(code,run);
  assert.equal(run.renderCalendar().firstDay.toISOString().slice(0,10),'2026-01-26');
  run.state.calendarView='week';assert.equal(run.renderCalendar().firstDay.toISOString().slice(0,10),'2026-01-26');
});
