/* إحصاءات مجمّعة للموقع المنشور فقط؛ لا تُرسل حالة اللعبة أو قراراتها. */
(function () {
  'use strict';
  if (location.protocol !== 'https:' || location.hostname !== 'majed-allababedi.github.io' ||
      !/^\/syria-decision-simulator\/(?:index\.html)?$/.test(location.pathname) ||
      navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var referrer = '';
  try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch (e) { /* مرجع غير صالح: لا يُرسل. */ }
  window.goatcounter = { path: '/syria-decision-simulator/', referrer: referrer };
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.setAttribute('data-goatcounter', 'https://majed.goatcounter.com/count');
  document.head.appendChild(script);
})();
