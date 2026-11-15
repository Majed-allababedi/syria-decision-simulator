"use strict";
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const file=path.join(__dirname,'../src/analytics.js');
const source=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
function run(url,dnt){
 const scripts=[];const location=new URL(url);const window={};
 const document={referrer:'https://example.org/private?secret=1',createElement:()=>({setAttribute(k,v){this[k]=v}}),head:{appendChild(s){scripts.push(s)}}};
 vm.runInNewContext(source,{location,window,document,navigator:{doNotTrack:dnt},URL});
 return {scripts,window};
}
const live=run('https://majed-allababedi.github.io/syria-decision-simulator/?secret=1');
assert.equal(live.scripts.length,1,'الموقع المنشور يحمّل عدادًا واحدًا');
assert.equal(live.scripts[0]['data-goatcounter'],'https://majed.goatcounter.com/count');
assert.equal(live.scripts[0].src,'https://gc.zgo.at/count.js');
assert.equal(live.window.goatcounter.path,'/syria-decision-simulator/');
assert.equal(live.window.goatcounter.referrer,'https://example.org');
assert.equal(run('file:///E:/syria-decision-simulator/index.html').scripts.length,0);
assert.equal(run('http://localhost:8000/').scripts.length,0);
assert.equal(run('https://majed-allababedi.github.io/other/').scripts.length,0);
assert.equal(run('https://majed-allababedi.github.io/syria-decision-simulator/','1').scripts.length,0);
console.log('نجحت اختبارات الإحصاءات: النطاق والخصوصية والنسخة المحلية');
