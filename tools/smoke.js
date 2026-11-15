#!/usr/bin/env node
/* tools/smoke.js — اختبار تشغيل الواجهة بلا متصفح: DOM وهمي يحلّل innerHTML ويشغّل اللعبة حتى النهاية */
"use strict";
const fs=require("fs"),path=require("path"),vm=require("vm");
const parts=["engine.js","ui.js"].map(f=>fs.readFileSync(path.join(__dirname,"..","src",f),"utf8"));
const data={events:[],endings:[],news:[]};
for(const f of fs.readdirSync(path.join(__dirname,"..","src","data")).filter(f=>f.endsWith(".json"))){
  const o=JSON.parse(fs.readFileSync(path.join(__dirname,"..","src","data",f),"utf8"));
  for(const k of ["events","endings","news"]) data[k].push(...(o[k]||[]));
}
data.byId=Object.fromEntries(data.events.map(e=>[e.id,e]));

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
  getElementById(id){ return byId[id]||null; },
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
const localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const keys=[];
let report=null;
const sandbox={console,Math,JSON,Date,Object,Array,String,Number,Boolean,RegExp,Error,parseInt,parseFloat,isNaN,
  setTimeout:(f)=>{try{f()}catch(e){}}, clearTimeout(){}, setInterval:()=>0, clearInterval(){},
  document, localStorage,
  window:{localStorage,addEventListener(t,f){(document._h=document._h||{})[t]=(document._h[t]||[]).concat(f)},scrollTo(){},matchMedia:()=>({matches:false,addListener(){}}),devicePixelRatio:1,document},
  Blob:class {constructor(parts){report=parts.join("")}},URL:{createObjectURL:()=>"blob:test"},
  confirm:()=>true, alert:(m)=>{console.log("   [تنبيه الواجهة] "+m)}, navigator:{userAgent:"node"}};
sandbox.window.document=document;
vm.createContext(sandbox);
parts.forEach((p,i)=>vm.runInContext(p,sandbox,{filename:"source"+i}));
console.log("✓ ملفات المصدر تُحمَّل بلا أخطاء تشغيل (لم يُختبر index.html)");
document.addEventListener=()=>{};
sandbox.SY_DATA=data;
vm.runInContext("UI.boot(SY_DATA)",sandbox,{filename:"boot"});
console.log("✓ شاشة البداية تُرسم ("+(appEl.innerHTML||"").length+" محرفاً)");

// بدء جولة (زر #go) ثم لعب 40 شهراً باختيار أول خيار متاح
function click(id){ const el=byId[id]; if(!el||!el.onclick) return false; el.onclick({}); return true; }
click("go");
if(!(classes["opt"]||[]).length){ console.log("✗ لم تصل إلى شاشة اللعب؛ الأصناف:", Object.keys(classes).join(",")); process.exit(1); }
console.log("✓ شاشة اللعب: حدث أولاً =", /<h2>([^<]{0,70})/.exec(appEl.innerHTML)[1], "| خيارات:", (classes["opt"]||[]).length);
const initial=JSON.parse(store.syria_sim_v3_save);
vm.runInContext("UI.boot(SY_DATA)",sandbox); if(!click("resume")) throw Error("resume missing");
if(JSON.parse(store.syria_sim_v3_save).eventId!==initial.eventId) throw Error("resume changed event");
let turns=0, ended=false;
for(let i=0;i<40;i++){
  const html=appEl.innerHTML||"";
  const opts=classes["opt"]||[];
  if(opts.length){ const o=opts[Math.floor(Math.random()*opts.length)]; if(o.onclick){o.onclick({}); turns++;} }
  else if(byId.dl){ ended=true; break; }
  if(!click("nextBtn")) {
    if(byId.dl){ ended=true; break; }
  }
}
if(!ended || !click("dl") || !report || !report.includes("تقرير القيادة")) throw Error("ending/report missing");
vm.runInContext("UI.boot(SY_DATA)",sandbox); if(!click("resume") || !byId.dl) throw Error("ending resume missing");
console.log("✓ استئناف الحدث والنهاية والتقرير بعد "+turns+" قراراً");

