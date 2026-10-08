const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const shared = fs.readFileSync('v2/js/widget-appearance.js','utf8');
const script = fs.readFileSync('v2/scriptable/DailyPlannerWidget.js','utf8');
const context = vm.createContext({});
vm.runInContext(shared, context);
test('standalone widget contains the browser appearance resolver', () => assert.ok(script.includes(shared)));
test('every app theme matches its source palette and supports dark mode', () => {
 const css = fs.readFileSync('v2/css/styles.css','utf8');
 for (const theme of ['classic','christmas','halloween','valentine','spring','autumn','ocean','lavender','sunset']) {
  const p = context.widgetAppearance({theme});
  assert.ok(css.includes('--bg: '+p.bg));
  assert.equal(context.widgetAppearance({theme,customization:{mode:'dark'}}).ink,'#f0f3f9');
 }
 assert.equal(context.widgetAppearance({customization:{mode:'system'}},true).dark,true);
 assert.equal(context.widgetAppearance({customization:{mode:'light'}},true).dark,false);
});
test('custom backgrounds and cards keep independently readable text and reject malformed colors', () => {
 const p = context.widgetAppearance({customization:{customColors:true,backgroundColor:'#000000',calendarColor:'#ffffff',accentColor:'bad'}});
 assert.equal(p.ink,'#ffffff'); assert.equal(p.cardInk,'#151515'); assert.equal(p.accent,'#7eaed6');
 assert.equal(context.widgetAppearance({theme:'missing'}).bg,'#f7f1e6');
});
test('Scriptable builds all sizes and preserves completion actions with cached themes', () => {
 class Stack {
  constructor(){this.children=[];}
  addStack(){const s=new Stack();this.children.push(s);return s;}
  addText(value){const s={value};this.children.push(s);return s;}
  setPadding(){} addSpacer(){} centerAlignContent(){} layoutVertically(){}
 }
 const env=vm.createContext({ListWidget:Stack,LinearGradient:class{},Color:class{constructor(hex){this.hex=hex;}},Font:new Proxy({},{get:()=>()=>({})}),Device:{isUsingDarkAppearance:()=>true},config:{widgetFamily:'small'},URLScheme:{forRunningScript:()=> 'scriptable://test'},Date});
 vm.runInContext(script.replace('await main();',''),env);
 for(const family of ['small','medium','large']){
  env.config.widgetFamily=family;
  const w=env.buildPlannerWidget({settings:{theme:'lavender',customization:{mode:'system'}},homework:[{id:'1',title:'Assignment',date:new Date().toISOString().slice(0,10),status:'pending'}]},'homework',true);
  assert.equal(w.backgroundGradient.colors[0].hex,'#121722');
  assert.ok(JSON.stringify(w).includes('action=complete'));
  assert.ok(JSON.stringify(w).includes('Offline copy'));
 }
});
