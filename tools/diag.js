#!/usr/bin/env node
"use strict";
const fs=require("fs"),path=require("fs")&&require("path");
const SY=require(path.join(__dirname,"..","src","engine.js"));
const dir=path.join(__dirname,"..","src","data");
const data={events:[],endings:[]};
fs.readdirSync(dir).filter(f=>f.endsWith(".json")).sort().forEach(f=>{
  const o=JSON.parse(fs.readFileSync(path.join(dir,f),"utf8"));
  data.events=data.events.concat(o.events||[]); data.endings=data.endings.concat(o.endings||[]);
});
const N=Number(process.argv[2]||300);
let fragContrib={}, driftFrag=0, collMonth={}, collWhy={};
for(let i=0;i<N;i++){
  const S=SY.initialState(1000+i);
  let prevFrag=S.st.frag, prevCash=S.res.cash, last=null;
  let guard=0;
  while(S.month<36 && !S.over && guard++<300){
    const ev=SY.pickEvent(S,data);
    if(!ev){ const a=SY.advance(S); driftFrag+=(S.st.frag-prevFrag)-0; prevFrag=S.st.frag; continue; }
    S.used[ev.id]=1; S.seen.push(ev.id);
    // greedy
    let best=-1e9,oi=0;
    ev.options.forEach((o,idx)=>{
      if(o.cost&&(o.cost.cap||0)<0&&S.res.cap+(o.cost.cap||0)<0)return;
      const p=SY.chance(S,o);
      const val=eff=>{let v=0;for(const k in eff){const neg=(k==="press"||k==="frag"||k.indexOf("t_")===0);const w=(k in SY.STATS?1:k==="cash"?3:k==="cap"?0.6:k.indexOf("r_")===0?0.4:k.indexOf("p_")===0?0.9:neg?-0.9:0.8);v+=eff[k]*w*(neg?-1:1);}return v;};
      let v=0;
      if(p!==null&&o.out){["ok","mid","bad"].forEach((t,ix)=>{const w=[0.45,0.35,0.20][ix];v+=(o.out[t]?val(o.out[t].eff||{}):0)*w;});}
      else v=val(o.eff||{});
      if(o.cost)v+=val(o.cost)*0.9;
      if(v>best){best=v;oi=idx;}
    });
    const opt=ev.options[oi];
    const before=S.st.frag;
    SY.resolve(S,ev,opt);
    const key=ev.id+" › "+opt.t+" ["+S.log[S.log.length-1].tier+"]";
    fragContrib[key]=(fragContrib[key]||0)+(S.st.frag-before);
    prevFrag=S.st.frag;
    const c=SY.collapse(S);
    if(c){ collMonth[c.id+"@"+S.month]=(collMonth[c.id+"@"+S.month]||0)+1; collWhy[c.id]=collWhy[c.id]||{frag:S.st.frag,press:S.st.press,eco:S.st.eco,cash:S.res.cash,leg:S.st.leg,sec:S.st.sec}; break; }
    SY.advance(S);
    driftFrag+=S.st.frag-prevFrag; prevFrag=S.st.frag;
  }
}
const top=Object.entries(fragContrib).sort((a,b)=>b[1]-a[1]).slice(0,14);
console.log("أكثر القرارات رفعاً للاحتقان (مجموع "+N+" جولة):");
top.forEach(([k,v])=>console.log("  +"+v.toFixed(1)+"  "+k));
console.log("\nمساهمة الانجراف الشهري في الاحتقان لكل جولة:",(driftFrag/N).toFixed(1));
console.log("\nانهيارات حسب الشهر:");
Object.keys(collMonth).sort((a,b)=>a.split("@")[1]-b.split("@")[1]).forEach(k=>console.log("  "+k+": "+collMonth[k]));
console.log("\نموذج حالة الانهيار:");
Object.entries(collWhy).forEach(([k,v])=>console.log(" ",k,JSON.stringify(v)));
