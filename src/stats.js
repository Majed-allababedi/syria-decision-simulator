"use strict";
(function () {
  var select = document.getElementById('question'), results = document.getElementById('results'), ends = document.getElementById('ends'), generation = 0;
  function element(tag, text) { var e = document.createElement(tag); e.textContent = text; return e; }
  function number(data) {
    if (!data || typeof data.count !== 'string' || !/^(?:0|[1-9]\d*|[1-9]\d{0,2}(?:,\d{3})+)$/.test(data.count)) throw Error('count');
    var n = Number(data.count.replace(/,/g, ''));
    if (!Number.isSafeInteger(n)) throw Error('count');
    return n;
  }
  async function counter(path) {
    var r = await fetch('https://majed.goatcounter.com/counter/' + encodeURIComponent(path) + '.json', { credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!r.ok && r.status !== 404) throw Error('http');
    var data = await r.json(), n = number(data);
    if (r.status === 404 && (n !== 0 || data.count_unique !== '0' || data.count !== '0')) throw Error('404');
    return n;
  }
  async function display(target, entries, token) {
    target.textContent = 'جارٍ تحميل الأعداد…';
    try {
      var counts = await Promise.all(entries.map(function (e) { return counter(e.path); }));
      if (token && token !== generation) return;
      var total = counts.reduce(function (a, b) { return a + b; }, 0);
      target.textContent = '';
      target.appendChild(element('p', 'المجموع المسجّل: ' + total.toLocaleString('ar') + ' — ليست أعداد أشخاص فريدين.'));
      entries.forEach(function (entry, i) {
        var row = element('div', entry.title + ' — ' + counts[i].toLocaleString('ar') + ' (' + (total ? (100 * counts[i] / total).toFixed(1) + '%' : 'لا نسبة بعد') + ')');
        row.className = 'stat-row';
        var bar = element('meter', ''); bar.min = 0; bar.max = total || 1; bar.value = counts[i]; bar.setAttribute('aria-label', entry.title);
        row.appendChild(bar); target.appendChild(row);
      });
    } catch (e) {
      if (!token || token === generation) target.textContent = 'الإحصاءات غير متاحة الآن. تحقق من اتصال الإنترنت وحاول لاحقاً.';
    }
  }
  DATA.events.forEach(function (e, i) { var o = element('option', e.title); o.value = i; select.appendChild(o); });
  function question() {
    var e = DATA.events[+select.value];
    display(results, e.options.map(function (o) { return { title: o.title, path: 'answer-' + e.id + '-' + o.statsId }; }), ++generation);
  }
  select.onchange = question; question();
  display(ends, DATA.endings.map(function (e) { return { title: e.title, path: 'ending-' + e.id }; }));
})();
