/* إحصاءات الموقع؛ إرسال الاختيارات والنهايات يتطلب موافقة مستقلة، ولا يُرسل الحفظ. */
(function () {
  'use strict';
  if (location.protocol !== 'https:' || location.hostname !== 'majed-allababedi.github.io' ||
      !/^\/syria-decision-simulator\/(?:index\.html)?$/.test(location.pathname) ||
      navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var referrer = '';
  try { if (document.referrer) referrer = new URL(document.referrer).origin; } catch (e) { /* مرجع غير صالح: لا يُرسل. */ }
  window.goatcounter = { path: '/syria-decision-simulator/', referrer: referrer, no_onload: true };
  var allowed = false, queue = [];
  function flush() {
    if (!allowed || !window.goatcounter || typeof window.goatcounter.count !== 'function') return;
    while (queue.length && allowed) {
      var path = queue.shift();
      try { window.goatcounter.count({ path: path, title: path, event: true, no_session: true, referrer: '' }); } catch (e) { /* الإحصاءات لا توقف اللعب. */ }
    }
  }
  function record(path) {
    if (!allowed) return;
    if (queue.length < 50) queue.push(path);
    flush();
  }
  window.answerStats = {
    consent: function (value) { allowed = value === true; if (!allowed) queue = []; else flush(); },
    enabled: function () { return allowed; },
    choice: function (id, statsId) { if (typeof statsId === 'string' && statsId) record('answer-' + id + '-' + statsId); },
    end: function (id) { record('ending-' + id); },
    flush: flush
  };
  var script = document.createElement('script');
  script.onload = function () {
    try {
      var original = window.goatcounter.get_data;
      if (typeof original === 'function') window.goatcounter.get_data = function (vars) {
        var data = original(vars); data.q = ''; if (vars && vars.event) data.r = ''; return data;
      };
      window.goatcounter.count();
      flush();
    } catch (e) { queue = []; }
  };
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.setAttribute('data-goatcounter', 'https://majed.goatcounter.com/count');
  document.head.appendChild(script);
})();
