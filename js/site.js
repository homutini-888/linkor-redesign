/* ============================================================
   Сайт: вся страница из контента, оглавление, поиск, якоря.
   Контент: window.__CONTENT__ (подставляет index.php из data/content.json),
   иначе — исходный, встроенный в страницу при сборке.
   ============================================================ */
(function () {
  'use strict';

  const D = window.LinkorDocs;
  const el = D.el;
  const $ = id => document.getElementById(id);

  function loadContent() {
    let defaults = null;
    try { defaults = JSON.parse($('content-default').textContent); } catch (e) { /* пусто */ }
    const saved = window.__CONTENT__;
    return D.migrate(saved && Array.isArray(saved.sections) ? saved : defaults, defaults) || { site: {}, sections: [] };
  }

  const content = loadContent();
  const site = content.site || {};
  const now = D.today();

  function link(text, href, cls) {
    const a = el('a', cls, text);
    const h = String(href || '');
    if (/^(#|mailto:|tel:)/i.test(h) || D.safeHref(h)) a.href = h;
    if (/^https?:/i.test(h)) { a.target = '_blank'; a.rel = 'noopener'; }
    return a;
  }
  const tel = phone => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
  const fill = (id, text) => { const n = $(id); if (n) n.textContent = text || ''; };
  const show = (sectionId, on) => { const s = $(sectionId); if (s) s.hidden = on === false; };

  /* ---------- Шапка ---------- */
  const c = site.contacts || {};
  (site.nav || []).forEach(item => {
    $('nav').append(link(item.text, item.href));
    $('menuPanel').append(link(item.text, item.href));
  });
  if (c.phone) {
    $('hdrPhone').textContent = c.phone;
    $('hdrPhone').href = tel(c.phone);
    $('menuPanel').append(link(c.phone, tel(c.phone), 'menu-phone'));
  }
  if (c.email) $('hdrMail').href = 'mailto:' + c.email;
  else $('hdrMail').hidden = true;

  /* ---------- Первый экран ---------- */
  const hero = site.hero || {};
  fill('heroEyebrow', hero.eyebrow);
  fill('heroTitle', hero.title);
  $('heroLead').append(...D.paragraphs(hero.lead, 'lead'));
  (hero.buttons || []).forEach(b => $('heroButtons').append(link(b.text, b.href, 'btn ' + (b.primary ? 'btn-primary' : 'btn-ghost'))));
  (hero.facts || []).forEach(f => {
    const box = el('div', 'fact');
    if (f.label) box.append(el('div', 'fact-label', f.label));
    if (f.value) box.append(el('div', 'fact-value', f.value));
    if (f.note) box.append(el('div', 'fact-note', f.note));
    $('heroFacts').append(box);
  });
  $('heroFacts').hidden = !(hero.facts || []).length;

  /* ---------- О компании ---------- */
  const about = site.about || {};
  show('about', about.show);
  fill('aboutTitle', about.title);
  (about.principles || []).filter(Boolean).forEach(p => $('aboutPrinciples').append(el('li', null, p)));
  $('aboutText').append(...D.paragraphs(about.text));

  /* ---------- Счета депо ---------- */
  const acc = site.accounts || {};
  show('accounts', acc.show);
  fill('accountsTitle', acc.title);
  fill('accountsIntro', acc.intro);
  (acc.cards || []).forEach(card => {
    const a = el('article', 'card');
    if (card.kicker) a.append(el('span', 'card-kicker', card.kicker));
    a.append(el('h3', null, card.title || ''));
    if (card.text) a.append(el('p', null, card.text));
    if (card.linkText) a.append(link(card.linkText, card.href, 'more'));
    $('accountsCards').append(a);
  });

  /* ---------- Раскрытие информации ---------- */
  const disc = site.disclosure || {};
  fill('disclosureTitle', disc.title);
  fill('disclosureIntro', disc.intro);

  const box = $('sections');
  const toc = $('toc');
  // скрытые в панели разделы не выводятся, но и не удаляются из данных
  (content.sections || []).filter(s => !s.hidden).forEach(section => {
    const d = el('details', 'acc');
    d.id = section.id;
    d.dataset.title = section.toc || section.title;
    const sum = el('summary');
    sum.append(el('h3', null, section.title));
    const r = D.renderSection(section, now);
    if (r.count) sum.append(el('span', 'count', String(r.count)));
    const plus = el('span', 'plus');
    plus.setAttribute('aria-hidden', 'true');
    sum.append(plus);
    const body = el('div', 'acc-body');
    body.append(D.renderBlocks(section.blocks));
    if ((section.docs || []).length || (section.groups || []).some(g => g.text && !g.hidden)) {
      const docs = el('div', 'docs');
      docs.append(r.node);
      body.append(docs);
    }
    d.append(sum, body);
    box.append(d);

    const li = el('li');
    li.append(link(section.toc || section.title, '#' + section.id));
    toc.append(li);
  });

  /* ---------- Контакты ---------- */
  fill('contactsTitle', c.title);
  const item = (label, value, href, sub) => {
    if (!value) return;
    const wrap = el('div');
    wrap.append(el('div', 'contact-label', label));
    const v = el('div', 'contact-value');
    v.append(href ? link(value, href) : document.createTextNode(value));
    wrap.append(v);
    if (sub) wrap.append(el('div', 'contact-sub', sub));
    $('contactGrid').append(wrap);
  };
  item('Адрес', c.address, '', c.metro);
  item('Телефон', c.phone, tel(c.phone));
  item('Режим работы', c.hours);
  item('E-mail', c.email, 'mailto:' + c.email);
  const visit = $('visit');
  if (c.visitTitle || c.visitText) {
    if (c.visitTitle) visit.append(el('h3', null, c.visitTitle));
    visit.append(...D.paragraphs(c.visitText));
    if (c.visitButton && c.email) {
      visit.append(link(c.visitButton, 'mailto:' + c.email + '?subject=' + encodeURIComponent('Запись на приём'), 'btn btn-primary'));
    }
  } else {
    visit.hidden = true;
  }

  /* ---------- Подвал ---------- */
  const f = site.footer || {};
  const col = (title, nodes) => {
    const d = el('div');
    if (title) d.append(el('strong', null, title));
    d.append(...nodes);
    $('footer').append(d);
  };
  col(f.title, D.paragraphs(f.text));
  col(f.requisitesTitle, (f.requisites || []).filter(Boolean).map(r => el('p', null, r)));
  col(f.linksTitle, (f.links || []).map(l => { const p = el('p'); p.append(link(l.text, l.href)); return p; }));
  if (f.bottom) $('footer').append(el('div', 'footer-bottom', f.bottom));

  /* ---------- Поведение: якоря, меню, поиск ---------- */
  const sections = Array.prototype.slice.call(document.querySelectorAll('#sections > .acc'));

  function openTarget(id) {
    const target = id && document.getElementById(id);
    if (!target) return;
    for (let n = target; n; n = n.parentElement) if (n.tagName === 'DETAILS') n.open = true;
    target.scrollIntoView();
    const current = toc.querySelector('.is-current');
    if (current) current.classList.remove('is-current');
    const top = target.closest('#sections > .acc');
    const a = top && toc.querySelector('a[href="#' + CSS.escape(top.id) + '"]');
    if (a) a.classList.add('is-current');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const menu = document.querySelector('.menu');
    if (menu && a.closest('.menu-panel')) menu.open = false;
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target || !target.closest('#sections')) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + id);
    openTarget(id);
  });
  if (location.hash) openTarget(decodeURIComponent(location.hash.slice(1)));
  window.addEventListener('hashchange', () => openTarget(decodeURIComponent(location.hash.slice(1))));

  const q = $('q');
  const empty = $('empty');
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
      const visible = titleHit || docHit || bodyHit;
      s.hidden = !visible;
      s.open = visible && !titleHit ? true : (titleHit ? s.open : false);
      if (visible) any = true;
    });
    empty.style.display = any ? 'none' : 'block';
  });
})();
