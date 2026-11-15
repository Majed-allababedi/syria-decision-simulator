#!/usr/bin/env node
/* tools/smoke.js — اختبار تشغيل الواجهة بلا متصفح: DOM وهمي يحلّل innerHTML ويشغّل اللعبة حتى النهاية */
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");



const byId={}, classes={}, inputs={};
const ctxProxy=new Proxy({},{get:(t,k)=>{
  if(k==="canvas")return {};
  if(k==="measureText")return()=>({width:10});
  if(k==="createLinearGradient")return()=>({addColorStop(){}});
  if(k==="setLineDash"||k==="getImageData")return()=>({data:[]});
  return ()=>{};
},set:()=>true});

function mkEl(tag,attrs){
  const a=attrs||{};
  const el={tagName:tag,style:{},dataset:{},children:[],textContent:"",value:"",checked:false,offsetTop:0,
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    appendChild(c){this.children.push(c);return c},removeChild(){},remove(){},
    click(){ if(el.onclick) el.onclick({}); },
    addEventListener(){}, querySelector(){return mkEl("div")}, querySelectorAll(){return []},
    getContext(){return ctxProxy}, getBoundingClientRect(){return {width:600,height:200,top:0}},
    setAttribute(k,v){a[k]=v;}, getAttribute(k){return k in a?String(a[k]):null;},
    focus(){},scrollIntoView(){},closest(){return null}};
  el.onclick=null;
  let _html="";
  Object.defineProperty(el,"innerHTML",{
    get(){return _html},
    set(v){ _html=String(v); if(el===appEl) parseInto(el,_html); }
  });
  return el;
}
function parseInto(root,html){
  classes.length=0; for(const k in classes) delete classes[k];
  for(const k in byId) delete byId[k];
  byId["app"]=appEl;
  let m;
  const idRe=/<(\w+)[^>]*\sid="([\w-]+)"[^>]*>/g;
  while((m=idRe.exec(html))){ const el=mkEl(m[1],{}); byId[m[2]]=el; }
  inputs.adv=[]; inputs.doc=[]; inputs.diff=[];
  let im; const inRe=/<input\b([^>]*)>/g;
  while((im=inRe.exec(html))){
    const at=im[1];
    const nm=/name="(\w+)"/.exec(at), vl=/value="([^"]*)"/.exec(at);
    if(!nm||!vl) continue;
    const el=mkEl("input",{name:nm[1],value:vl[1],type:"radio"});
    el.name=nm[1]; el.value=vl[1];
    (inputs[nm[1]]=inputs[nm[1]]||[]).push(el);
  }
  ["adv","doc","diff"].forEach(g=>(inputs[g]||[]).forEach((el,i)=>{ el.checked=(g==="adv")?i<2:i===0; }));
  const clsRe=/<(\w+)\b([^>]*)>/g;
  while((m=clsRe.exec(html))){
    const attrs=m[2];
    const cm=/class="([^"]*)"/.exec(attrs); if(!cm) continue;
    const dm=/data-i="(\d+)"/.exec(attrs), dt=/data-tab="([\w-]+)"/.exec(attrs);
    cm[1].split(/\s+/).forEach(cn=>{
      (classes[cn]=classes[cn]||[]);
      const el=mkEl(m[1],{ "class":cm[1], ...(dm?{"data-i":dm[1]}:{}), ...(dt?{"data-tab":dt[1]}:{}) });
      classes[cn].push(el);
    });
  }
}
const appEl=mkEl("div"); byId["app"]=appEl;
const body=mkEl("body");
const document={
  getElementById(id){ return byId[id] || null; },
  createElement:t=>mkEl(t), createDocumentFragment:()=>mkEl("div"),
  querySelector(sel){
    const m=/name=(\w+)\]?:checked/.exec(sel);
    if(m) return (inputs[m[1]]||[]).find(e=>e.checked)||null;
    const k=sel.replace(".",""); return (classes[k]||[])[0]||mkEl("div");
  },
  querySelectorAll(sel){
    const m=/name=(\w+)\]?:checked/.exec(sel);
    if(m) return (inputs[m[1]]||[]).filter(e=>e.checked);
    const k=sel.replace(".",""); return classes[k]||[];
  },
  addEventListener(t,f){ (document._h=document._h||{})[t]=(document._h[t]||[]).concat(f); },
  body, documentElement:mkEl("html"), title:""
};
const store={};
let storageFails=false;
const localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{if(storageFails) throw Error('quota'); store[k]=String(v)},removeItem:k=>{delete store[k]}};
const keys=[];
let downloaded = null; const alerts=[];
const sandbox={console,Math,JSON,Date,Object,Array,String,Number,Boolean,RegExp,Error,parseInt,parseFloat,isNaN,
  setTimeout:(f)=>{try{f()}catch(e){}}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  document, localStorage,
  window:{localStorage,addEventListener(t,f){(document._h=document._h||{})[t]=(document._h[t]||[]).concat(f)},scrollTo(){},matchMedia:()=>({matches:false,addListener(){}}),devicePixelRatio:1,document},
  Blob: class { constructor(parts){downloaded=parts.join('');} }, URL:{createObjectURL:()=> 'blob:test'},
  confirm:()=>true, alert:(m)=>{alerts.push(m)}, navigator:{userAgent:"node"}};
sandbox.window.document=document;
const assert=require('assert');
vm.createContext(sandbox);
for (const f of ['engine.js','ui.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..','src',f),'utf8'),sandbox,{filename:f});
const events=Array.from({length:37},(_,month)=>({id:'e'+month,month,ttl:1,title:'حدث '+month,brief:'',options:[{t:'قرار',eff:{},prob:{base:50},out:{ok:{txt:'نجاح',eff:{}},mid:{txt:'جزئي',eff:{}},bad:{txt:'فشل',eff:{}}}}]}));
sandbox.data={events,byId:Object.fromEntries(events.map(e=>[e.id,e])),endings:[{title:'نهاية',desc:'نهاية'}],news:[]};
vm.runInContext('var realCollapse=SY.collapse; SY.collapse=function(){return null}; UI.boot(data)',sandbox);
function click(id){assert(byId[id] && byId[id].onclick,'missing '+id);byId[id].onclick({});}
function option(){assert(classes.opt && classes.opt[0]);classes.opt[0].onclick({});}
let failures=0;
function test(name,fn){try{fn();console.log('✓ '+name)}catch(e){failures++;console.error('✗ '+name+': '+e.message)}}
click('go');
test('resume retains pending event',()=>{const before=appEl.innerHTML.match(/حدث \d+/)[0]; vm.runInContext('UI.boot(data)',sandbox); click('resume'); assert(appEl.innerHTML.includes(before));});
test('resume retains result',()=>{option();const before=appEl.innerHTML;assert(before.includes('النتيجة'));vm.runInContext('UI.boot(data)',sandbox);click('resume');assert(appEl.innerHTML.includes('النتيجة'));});
test('repeat choice cannot resolve twice',()=>{const before=store.syria_sim_v3_save; vm.runInContext("document._h.keydown.slice(-1)[0]({key:'1'})",sandbox); assert.strictEqual(store.syria_sim_v3_save,before);});
test('final month plays, report downloads, and ending resumes',()=>{
  for(let i=0;i<36;i++){click('nextBtn'); assert(appEl.innerHTML.includes('حدث '+(i+1))); option();}
  click('nextBtn'); assert(appEl.innerHTML.includes('النهاية — ديسمبر 2027'));
  click('dl'); assert(downloaded.includes('القرارات (37)'));
  vm.runInContext('UI.boot(data)',sandbox);click('resume');assert(appEl.innerHTML.includes('النهاية — ديسمبر 2027'));
});
test('empty month advances once',()=>{
  delete store.syria_sim_v3_save; sandbox.data.events=events.filter(e=>e.month!==1); sandbox.data.byId=Object.fromEntries(sandbox.data.events.map(e=>[e.id,e]));
  vm.runInContext('UI.boot(data)',sandbox); click('go'); option(); click('nextBtn');
  assert(appEl.innerHTML.includes('حدث 2')); assert.strictEqual(JSON.parse(store.syria_sim_v3_save).state.month,2);
});
test('corrupt and unsupported saves remain untouched',()=>{
  for(const value of ['{bad',JSON.stringify({version:99})]){
    store.syria_sim_v3_save=value; vm.runInContext('UI.boot(data)',sandbox); assert(appEl.innerHTML.includes('غير صالح'));
    click('go'); assert.strictEqual(store.syria_sim_v3_save,value); assert(alerts.length);
  }
});
test('legacy save stays untouched with warning',()=>{
  delete store.syria_sim_v3_save; store.syria_sim_v2_save='legacy'; vm.runInContext('UI.boot(data)',sandbox);
  assert(appEl.innerHTML.includes('الاستئناف الدقيق غير متاح')); click('go'); assert.strictEqual(store.syria_sim_v2_save,'legacy');
});
test('storage failure reports error and retains previous save',()=>{
  const before=store.syria_sim_v3_save, count=alerts.length; storageFails=true; click('saveBtn'); storageFails=false;
  assert.strictEqual(store.syria_sim_v3_save,before); assert(alerts.length>count); assert.notStrictEqual(byId.saveBtn.textContent,'✓ حُفظ');
});
test('فهرس الأحداث يبنى من بيانات الملف النهائي',()=>{
  delete store.syria_sim_v3_save; delete sandbox.data.byId;
  vm.runInContext('UI.boot(data)',sandbox); click('go'); option();
  const before=store.syria_sim_v3_save;
  vm.runInContext('UI.boot(data)',sandbox); assert(byId.resume, 'لم يقبل حفظ الملف النهائي'); click('resume');
  assert.strictEqual(store.syria_sim_v3_save,before);
});
test('طي المؤشرات لا يعيد اختيار الحدث',()=>{
  const before=store.syria_sim_v3_save;
  click('sideToggle'); assert.strictEqual(byId.statePanel.hidden,true);
  assert.strictEqual(byId.sideToggle.getAttribute('aria-expanded'),'false');
  click('sideToggle'); assert.strictEqual(byId.statePanel.hidden,false);
  assert.strictEqual(store.syria_sim_v3_save,before);
});
test('nested corrupt saves are rejected and never overwritten',()=>{
  const valid=JSON.parse(store.syria_sim_v3_save);
  const mutations=[
    x=>x.result.roll.p='<img src=x onerror=alert(1)>',
    x=>x.state.delay.push({at:1,flags:'invalid'}),
    x=>x.result.eff.leg='bad',
    x=>x.state.promises.push({metric:'leg',due:2,target:'<img>'}),
    x=>x.state.log[0].tier='" onmouseover="x',
    x=>x.state.line.push({m:'bad'})
  ];
  for(const mutate of mutations){
    const bad=JSON.parse(JSON.stringify(valid)); mutate(bad); const text=JSON.stringify(bad);
    store.syria_sim_v3_save=text; vm.runInContext('UI.boot(data)',sandbox);
    assert(!byId.resume); assert(appEl.innerHTML.includes('غير صالح')); click('go');
    assert.strictEqual(store.syria_sim_v3_save,text);
  }
});
test('final decision uses real collapse without advancing',()=>{
  delete store.syria_sim_v3_save; vm.runInContext('UI.boot(data)',sandbox); click('go');
  const saved=JSON.parse(store.syria_sim_v3_save); saved.state.month=36; saved.state.st.leg=12.1;
  sandbox.data.events.find(e=>e.id===saved.eventId).options=[{t:'قرار',eff:{leg:-10}}];
  store.syria_sim_v3_save=JSON.stringify(saved); vm.runInContext('SY.collapse=realCollapse; UI.boot(data)',sandbox);
  click('resume'); option(); click('nextBtn');
  const end=JSON.parse(store.syria_sim_v3_save); assert.strictEqual(end.state.over.id,'X_legitimacy');
  assert.strictEqual(end.state.month,36); assert(appEl.innerHTML.includes('نهاية مبكرة'));
  vm.runInContext('SY.collapse=function(){return null}',sandbox);
});
if(failures) process.exitCode=1;
