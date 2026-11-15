"use strict";
// اختبارات النص العربي والعرض؛ لا تحل محل فحص المتصفح الحقيقي.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const elements = {};
const document = {
  getElementById(id) { return elements[id] || (elements[id] = { innerHTML: '', textContent: '', onclick: null }); },
  addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }
};
const data = {events:[],endings:[],news:[]};
fs.readdirSync(path.join(root,'src/data')).filter(f=>f.endsWith('.json')).forEach(f=>{
 const d=JSON.parse(fs.readFileSync(path.join(root,'src/data',f),'utf8'));
 for(const k of Object.keys(data)) data[k].push(...(d[k]||[]));
});
const sandbox = { console, document, localStorage:{getItem(){return null},setItem(){},removeItem(){}}, window:{addEventListener(){},matchMedia(){return {matches:false}}}, SY_DATA:data, alert(){}, confirm(){return true}, setTimeout };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'src/engine.js'),'utf8'),sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'src/ui.js'),'utf8'),sandbox);
const html=elements.app.innerHTML;
assert(html.includes('hero-subtitle'),'عنوان فرعي عربي مستقل');
assert(!html.includes('حدثاً تاريخياً'),'عدم وصف السيناريوهات كلها بأنها تاريخية');
assert(!html.includes('Enter'),'تعريب اسم مفتاح المتابعة');
assert(html.includes('افتراضات'),'بيان أن نتائج اللعبة افتراضات وليست وقائع');
assert(html.includes('<svg') && html.includes('لا يمثّل الحدود'),'الرسم توضيحي وموسوم');
assert(html.includes('name="diff"') && html.includes('name="adv"') && html.includes('name="doc"'),'خيارات الإعداد محفوظة');
assert(html.includes('IBM Plex') === false,'لا إعلانات تقنية في شاشة اللاعب');
const ui=fs.readFileSync(path.join(root,'src/ui.js'),'utf8');
assert(ui.indexOf('<div class="opts">') < ui.indexOf('<details class="news">'),'النشرة المطوية بعد خيارات القرار');
const css=fs.readFileSync(path.join(root,'src/css/style.css'),'utf8');
assert(css.includes('prefers-reduced-motion'));
assert(css.includes(':focus-visible'));
assert(css.includes('__FONT_REGULAR__'));
assert(!/url\(https?:/.test(css),'الخط لا يعتمد على الشبكة');
console.log('نجحت اختبارات النص العربي والتصميم');
