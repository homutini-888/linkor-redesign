/* ============================================================
   Документы: статусы, подписи и разметка списков.
   Общий код сайта и панели управления.
   ============================================================ */
(function () {
  'use strict';

  const STATUS = { active: 'Действует', pending: 'Не вступило в силу', archive: 'Архив' };

  function today() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /* «2026-04-08» или «2026-04-08T12:00» → «08.04.2026» / «08.04.2026 в 12:00» */
  function fmt(iso) {
    const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d:\d\d))?/.exec(iso || '');
    if (!m) return '';
    return `${m[3]}.${m[2]}.${m[1]}` + (m[4] ? ` в ${m[4]}` : '');
  }

  /* Статус с учётом дат: документ «вступает в силу» и «уходит в архив» сам,
     когда наступает дата, — без правки в панели. */
  function stateOf(doc, now) {
    now = now || today();
    if (doc.status === 'archive' || (doc.to && doc.to < now)) return 'archive';
    if (doc.from && doc.from > now) return 'pending';
    if (doc.status === 'pending' && !doc.from) return 'pending';
    return 'active';
  }

  function meta(doc, state) {
    const parts = [];
    if (doc.note) parts.push(doc.note);
    const disclosed = doc.disclosed ? 'дата раскрытия ' + fmt(doc.disclosed) : '';
    let period = '';
    if (state === 'archive') {
      if (doc.from && doc.to) period = `период актуальности — с ${fmt(doc.from)} по ${fmt(doc.to)}`;
      else if (doc.to) period = `период актуальности — по ${fmt(doc.to)}`;
    } else if (state === 'pending') {
      if (doc.from) period = 'вступает в силу ' + fmt(doc.from);
    } else if (doc.from) {
      period = `период актуальности — с ${fmt(doc.from)} по настоящее время`;
    } else if (doc.disclosed) {
      period = 'период актуальности — по настоящее время';
    }
    const dates = [disclosed, period].filter(Boolean).join(', ');
    if (dates) parts.push(dates);
    return parts.join(' · ');
  }

  /* Ссылка на файл: только относительный путь или http(s) — из чужого JSON
     не должен прийти javascript: или data: */
  function safeHref(url) {
    const v = String(url || '').trim();
    if (/^https?:\/\//i.test(v)) return v;
    if (/^[a-z0-9][\w\-./%]*$/i.test(v) && !v.includes('..')) return v;
    return '';
  }

  function extOf(doc) {
    if (/^https?:/i.test(doc.file || '')) return 'URL';
    const m = /\.([a-z0-9]{2,5})$/i.exec(doc.file || '');
    return m ? m[1].toUpperCase() : 'FILE';
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function docNode(doc, state) {
    const href = safeHref(doc.file);
    const a = el(href ? 'a' : 'div', 'doc');
    if (href) {
      a.href = href;
      if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
      else if (doc.name) a.setAttribute('download', doc.name);
    }
    const ext = extOf(doc);
    a.append(el('span', 'ext' + (ext === 'PDF' ? ' pdf' : ext === 'URL' ? ' url' : ''), ext));
    const body = el('span', 'doc-body');
    body.append(el('span', 'doc-title', doc.title || 'Без названия'));
    const m = meta(doc, state);
    if (m) body.append(el('span', 'doc-meta', m));
    a.append(body);
    if (state === 'pending') a.append(el('span', 'tag warn', STATUS.pending));
    return a;
  }

  function sub(id, title, nodes) {
    const d = el('details', 'sub');
    if (id) d.id = id;
    const s = el('summary', null, title);
    s.append(el('span', 'count', String(nodes.length)));
    const body = el('div', 'sub-body');
    body.append(...nodes);
    d.append(s, body);
    return d;
  }

  /* Разметка раздела: действующие и не вступившие (по группам, если они есть),
     затем «Архив» со всеми документами, утратившими силу. */
  function renderSection(section, now) {
    now = now || today();
    const frag = document.createDocumentFragment();
    const docs = section.docs || [];
    const current = docs.filter(d => stateOf(d, now) !== 'archive');
    const archived = docs.filter(d => stateOf(d, now) === 'archive');
    const groups = section.groups || [];

    if (groups.length) {
      groups.forEach(g => {
        const items = current.filter(d => d.group === g.id);
        if (items.length) frag.append(sub(g.id, g.title, items.map(d => docNode(d, stateOf(d, now)))));
      });
      const loose = current.filter(d => !groups.some(g => g.id === d.group));
      loose.forEach(d => frag.append(docNode(d, stateOf(d, now))));
    } else {
      current.forEach(d => frag.append(docNode(d, stateOf(d, now))));
    }

    if (archived.length) {
      const title = groups.length ? 'Архив: формы, утратившие силу' : 'Архив';
      frag.append(sub(section.id + '-archive', title, archived.map(d => docNode(d, 'archive'))));
    }
    return { node: frag, count: current.length };
  }

  /* «Основные документы» на главной: отмеченные в панели и действующие */
  function renderPinned(sections, now) {
    now = now || today();
    const frag = document.createDocumentFragment();
    (sections || []).forEach(s => (s.docs || []).forEach(d => {
      if (d.pin && stateOf(d, now) === 'active') frag.append(docNode(d, 'active'));
    }));
    return frag;
  }

  window.LinkorDocs = { STATUS, today, fmt, stateOf, meta, safeHref, extOf, renderSection, renderPinned };
})();
