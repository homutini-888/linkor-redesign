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

  function sub(id, title, nodes, text) {
    const d = el('details', 'sub');
    if (id) d.id = id;
    const s = el('summary', null, title);
    s.append(el('span', 'count', String(nodes.length)));
    const body = el('div', 'sub-body');
    if (text) body.append(...paragraphs(text, 'note sub-note'));
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
        if (items.length || g.text) frag.append(sub(g.id, g.title, items.map(d => docNode(d, stateOf(d, now))), g.text));
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

  /* ---------- Текст из панели ----------
     Абзацы разделяются пустой строкой, внутри абзаца — перенос строки.
     **жирный** и [текст](адрес) — единственная разметка; HTML не принимается. */
  function inline(text) {
    const frag = document.createDocumentFragment();
    const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
    let last = 0, m;
    const plain = s => s.split('\n').forEach((line, i) => {
      if (i) frag.append(el('br'));
      frag.append(document.createTextNode(line));
    });
    while ((m = re.exec(text))) {
      plain(text.slice(last, m.index));
      if (m[1]) frag.append(el('strong', null, m[1]));
      else {
        const href = safeHref(m[3]) || (/^(mailto:|tel:|#)/i.test(m[3]) ? m[3] : '');
        const a = el(href ? 'a' : 'span', null, m[2]);
        if (href) {
          a.href = href;
          if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
        }
        frag.append(a);
      }
      last = re.lastIndex;
    }
    plain(text.slice(last));
    return frag;
  }

  function paragraphs(text, cls) {
    return String(text || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).map(p => {
      const n = el('p', cls);
      n.append(inline(p));
      return n;
    });
  }

  /* Информационные блоки раздела: текст, реквизиты, список статусов, примечание */
  function renderBlocks(blocks) {
    const frag = document.createDocumentFragment();
    (blocks || []).forEach(b => {
      if (b.type === 'text') frag.append(...paragraphs(b.text));
      else if (b.type === 'note') frag.append(...paragraphs(b.text, 'note'));
      else if (b.type === 'fields') {
        const dl = el('dl', 'kv');
        (b.rows || []).forEach(r => {
          const dd = el('dd');
          dd.append(inline(r.value || ''));
          dl.append(el('dt', null, r.label || ''), dd);
        });
        if (dl.children.length) frag.append(dl);
      } else if (b.type === 'statuses') {
        const box = el('div', 'status');
        (b.rows || []).forEach(r => {
          const row = el('div');
          const v = el('span');
          v.append(inline(r.value || ''));
          row.append(el('span', null, r.label || ''), v);
          box.append(row);
        });
        if (box.children.length) frag.append(box);
      }
    });
    return frag;
  }

  /* id раздела или подраздела из названия: латиница, для якорей в адресе */
  const TR = 'а:a б:b в:v г:g д:d е:e ё:e ж:zh з:z и:i й:y к:k л:l м:m н:n о:o п:p р:r с:s т:t у:u ф:f х:h ц:ts ч:ch ш:sh щ:sch ъ: ы:y ь: э:e ю:yu я:ya'
    .split(' ').reduce((o, p) => { const [k, v] = p.split(':'); o[k] = v; return o; }, {});
  function slug(text, taken) {
    let base = String(text || '').toLowerCase().split('').map(c => (c in TR ? TR[c] : c)).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'razdel';
    let id = base, n = 2;
    while (taken && taken.has(id)) id = base + '-' + n++;
    return id;
  }

  /* Данные, сохранённые до появления редактора страницы (version 1: только
     документы), дополняем текстами и разделами из исходного контента сборки. */
  function migrate(content, defaults) {
    if (!content || !Array.isArray(content.sections)) return defaults;
    if (content.version >= 2 || !defaults) return content;
    const clone = o => JSON.parse(JSON.stringify(o));
    const saved = new Map(content.sections.map(s => [s.id, s]));
    const sections = defaults.sections.map(def => {
      const s = saved.get(def.id);
      if (!s) return clone(def);
      saved.delete(def.id);
      return Object.assign(clone(def), s, { blocks: s.blocks || clone(def.blocks || []), toc: s.toc || def.toc || '' });
    });
    saved.forEach(s => sections.push(Object.assign({ toc: '', blocks: [], groups: [] }, s)));
    const site = clone(defaults.site);
    const f = content.facts || {};
    const fact = (site.hero.facts || []).find(x => x.key === 'ownFunds');
    if (fact && f.ownFunds) {
      fact.value = f.ownFunds;
      if (f.ownFundsDate) fact.note = 'по состоянию на ' + fmt(f.ownFundsDate);
    }
    return { version: 2, site, sections };
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

  window.LinkorDocs = {
    STATUS, today, fmt, stateOf, meta, safeHref, extOf, el,
    renderSection, renderPinned, renderBlocks, inline, paragraphs, slug, migrate
  };
})();
