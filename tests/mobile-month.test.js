const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('v2/js/app.js','utf8');
function fixture(mobile=true,month='2026-10-01'){
 function element(){return {children:[],dataset:{},events:{},classList:{toggle(){}},appendChild(child){this.children.push(child)},setAttribute(){},addEventListener(name,fn){this.events[name]=fn},click(){this.events.click?.({stopPropagation(){}})},querySelector(){return element()},set innerHTML(value){this.children=[]},get innerHTML(){return ''}};}
 const grid=element(),state={visibleMonth:month,selectedDate:month,calendarView:'month'},busy=month;
 const items=Array.from({length:6},(_,i)=>({sourceId:'item-'+i,kind:i===0?'homework':'event',title:'Appointment '+i,displayTime:'10:00 AM',color:'#7eaed6'}));
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const ctx={state,window:{matchMedia:()=>({matches:mobile})},document:{createElement:element},getSettings:()=>({customization:{defaultView:'month',weekStart:'monday'}}),renderWeekdays(){},renderHeaderStats(){},renderSelectedDayViews(){},prefillForms(){},getItemsForDate:date=>date===busy?items:[],filterCalendarItems:x=>x,isoDate:iso,todayString:()=>busy,formatLongDate:x=>x,formatShortDate:x=>x,startOfMonth:x=>x.slice(0,7)+'-01',escapeHtml:x=>x,applyItemColor(){},elements:{calendarGrid:grid,calendarViewButtons:[],calendarViewSwitch:element(),calendarWeekdays:element(),calendarMonthLabel:element()}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function renderCalendar('),source.indexOf('function openCalendarItemDetails(')),ctx);ctx.renderCalendar();
 return {ctx,grid,state,items,day:()=>grid.children.find(n=>n.dataset.calendarDate===busy)};
}
test('mobile months use only the weeks needed, including leap years and six-week months',()=>{for(const [month,count] of [['2027-02-01',28],['2028-02-01',35],['2026-08-01',42]])assert.equal(fixture(true,month).grid.children.length,count);assert.equal(fixture(false,'2027-02-01').grid.children.length,42)});
test('busy mobile days show every entry without a more button',()=>{const f=fixture();const markers=f.day().children[1];assert.equal(markers.children.length,6);assert.ok(markers.children.every(n=>n.className!=='calendar-month-more'));assert.equal(f.items.length,6)});
test('tapping a mobile day still opens full details for all items',()=>{const f=fixture();f.day().click();assert.equal(f.state.calendarView,'day');assert.equal(f.grid.children.length,1);assert.equal(f.grid.children[0].children[1].children.length,6)});
test('desktop months retain all entries without compact overflow',()=>{const f=fixture(false);assert.equal(f.day().children[1].children.length,6);assert.ok(f.day().children[1].children.every(n=>n.className!=='calendar-month-more'))});
test('all item targets remain available for pet navigation',()=>{const f=fixture();const markers=f.day().children[1].children;for(const item of f.items)assert.ok(markers.some(marker=>marker.dataset.plannerSourceId===item.sourceId));assert.equal(f.items[2].sourceId,'item-2')});
