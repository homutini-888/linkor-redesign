/* ============================================================
   Сайт: документы из контента, оглавление, поиск, якоря.
   Контент: window.__CONTENT__ (подставляет index.php из data/content.json),
   иначе — исходный, встроенный в страницу при сборке.
   ============================================================ */
(function () {
  'use strict';

  const D = window.LinkorDocs;

  function loadContent() {
    if (window.__CONTENT__ && Array.isArray(window.__CONTENT__.sections)) return window.__CONTENT__;
    try {
      return JSON.parse(document.getElementById('content-default').textContent);
    } catch (e) {
      return { sections: [] };
    }
  }

  const content = loadContent();
  const now = D.today();

  // документы по разделам
  (content.sections || []).forEach(section => {
    const box = document.querySelector('[data-docs="' + section.id + '"]');
    if (!box) return;
    const r = D.renderSection(section, now);
    box.replaceChildren(r.node);
    const count = document.querySelector('[data-count="' + section.id + '"]');
    if (count) count.textContent = r.count || '';
  });

  const pinned = document.querySelector('[data-pinned]');
  if (pinned) {
    pinned.replaceChildren(D.renderPinned(content.sections, now));
    pinned.closest('section').hidden = !pinned.children.length;
  }

  // сведения на первом экране
  const facts = content.facts || {};
  document.querySelectorAll('[data-fact]').forEach(n => {
    const key = n.dataset.fact;
    if (key === 'ownFundsDate') n.textContent = facts.ownFundsDate ? 'по состоянию на ' + D.fmt(facts.ownFundsDate) : '';
    else if (facts[key]) n.textContent = facts[key];
  });

  // оглавление
  const sections = Array.prototype.slice.call(document.querySelectorAll('#sections > .acc'));
  const toc = document.getElementById('toc');
  sections.forEach(s => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + s.id;
    a.textContent = s.dataset.title;
    li.appendChild(a);
    toc.appendChild(li);
  });

  // открыть раздел (и вложенную группу), на который ведёт ссылка
  function openTarget(id) {
    const target = id && document.getElementById(id);
    if (!target) return;
    for (let n = target; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
    target.scrollIntoView();
    const current = toc.querySelector('.is-current');
    if (current) current.classList.remove('is-current');
    const top = target.closest('#sections > .acc');
    const link = top && toc.querySelector('a[href="#' + top.id + '"]');
    if (link) link.classList.add('is-current');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target || !target.closest('#sections')) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + id);
    openTarget(id);
  });
  document.querySelectorAll('.menu-panel a').forEach(a => {
    a.addEventListener('click', () => { document.querySelector('.menu').open = false; });
  });
  if (location.hash) openTarget(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', () => openTarget(decodeURIComponent(location.hash.slice(1))));

  // поиск: фильтрует разделы и документы, раскрывает найденное
  const q = document.getElementById('q');
  const empty = document.getElementById('empty');
  let saved = null;
  const norm = s => s.toLowerCase().replace(/ё/g, 'е');

  q.addEventListener('input', () => {
    const term = norm(q.value.trim());
    const all = document.querySelectorAll('#sections details');
    if (!term) {
      document.querySelectorAll('#sections [hidden]').forEach(n => { n.hidden = false; });
      if (saved) all.forEach((d, i) => { d.open = saved[i]; });
      saved = null;
      empty.style.display = 'none';
      return;
    }
    if (!saved) saved = Array.prototype.map.call(all, d => d.open);
    let any = false;
    sections.forEach(s => {
      const titleHit = norm(s.querySelector('summary').textContent).indexOf(term) > -1;
      const docs = s.querySelectorAll('.doc');
      let docHit = false;
      docs.forEach(d => {
        const hit = titleHit || norm(d.textContent).indexOf(term) > -1;
        d.hidden = !hit;
        if (hit) docHit = true;
      });
      s.querySelectorAll('.sub').forEach(g => {
        const vis = g.querySelector('.doc:not([hidden])');
        g.hidden = !vis && !titleHit;
        g.open = !!vis && !titleHit;
      });
      const bodyHit = !docs.length && norm(s.textContent).indexOf(term) > -1;
      const show = titleHit || docHit || bodyHit;
      s.hidden = !show;
      s.open = show && !titleHit ? true : (titleHit ? s.open : false);
      if (show) any = true;
    });
    empty.style.display = any ? 'none' : 'block';
  });
})();
