import { db, uid, askPersistence } from './store.js';
import { BUILTINS } from './seed.js';

const APP_VERSION = '1.0.0';

/* ───────────── utilidades ───────────── */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const parseNum = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f1 = (n) => nf1.format(n);
const eur = (n) => `${nf2.format(n)} €`;
const eurShort = (n) => `${Number.isInteger(n) ? n : nf2.format(n)} €`;
const dShort = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const dLong = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const dDay = new Intl.DateTimeFormat('es-ES', { day: 'numeric' });
const dMon = new Intl.DateTimeFormat('es-ES', { month: 'short' });
const dWeekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const tHour = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

function duration(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

function toLocalInput(ts) {
  const d = new Date(ts);
  return new Date(ts - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/* ───────────── estado ───────────── */

const D = () => db.data;
const N = () => db.data.names;
const ui = {
  mealId: null, filter: 'todo', query: '', stats: null,
  likesRid: null, likesSeg: 'top', likesQuery: '',
  histRid: 'all', menuQuery: '', showHidden: false,
  justFinished: null,
};

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  if (!db.save()) toast('No se ha podido guardar. Revisa el espacio del iPhone.');
}
function saveSoon(ms = 400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, ms);
}

const rest = (id) => D().restaurants.find((r) => r.id === id);
const mealById = (id) => D().meals.find((m) => m.id === id);
const dishOf = (r, id) => r?.dishes.find((d) => d.id === id);
const whoName = (w) => (w === 's' ? 'Compartido' : N()[w]);
const activeMeal = () => (D().activeMealId ? mealById(D().activeMealId) : null);

function defaultRid() {
  const d = D();
  if (d.lastRid && rest(d.lastRid)) return d.lastRid;
  const visits = new Map();
  d.meals.forEach((m) => visits.set(m.rid, (visits.get(m.rid) || 0) + 1));
  const best = [...visits.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && rest(best[0]) ? best[0] : d.restaurants[0]?.id;
}

/* ───────────── datos derivados ───────────── */

function counts(m) {
  const c = {};
  for (const e of m.log) {
    const x = (c[e.d] ||= { a: 0, b: 0, s: 0, n: 0 });
    x[e.w]++;
    x.n++;
  }
  return c;
}

const piecesOf = (d) => (d?.sushi ? d.pieces || 1 : 0);

function totals(m, r = rest(m.rid)) {
  let plates = 0, pieces = 0, pa = 0, pb = 0;
  for (const e of m.log) {
    const p = piecesOf(dishOf(r, e.d));
    plates++;
    pieces += p;
    if (e.w === 'a') pa += p;
    else if (e.w === 'b') pb += p;
    else { pa += p / 2; pb += p / 2; }
  }
  return { plates, pieces, pa, pb };
}

function orderedIds(m) {
  const seen = new Set();
  m.log.forEach((e) => seen.add(e.d));
  Object.keys(m.ratings).forEach((id) => seen.add(id));
  return [...seen];
}

function supplements(m, r = rest(m.rid)) {
  let total = 0;
  for (const [id, x] of Object.entries(counts(m))) {
    const d = dishOf(r, id);
    if (d?.supl) total += d.supl.eur * Math.max(0, x.n - (d.supl.from - 1));
  }
  return total;
}

function bill(m, r = rest(m.rid)) {
  const price = r?.prices?.find((p) => p.id === m.priceId) || null;
  const base = price ? price.eur * 2 : 0;
  const supl = supplements(m, r);
  const drinks = m.drinks || 0;
  return { price, base, supl, drinks, total: base + supl + drinks };
}

function suggestPrice(r, ts) {
  const prices = r?.prices || [];
  if (!prices.length) return null;
  if (prices.length === 1) return prices[0].id;
  const dt = new Date(ts);
  const day = dt.getDay();
  const lunch = dt.getHours() < 17;
  const weekend = day === 0 || day === 6;
  const want = lunch ? (weekend ? 'weekend' : 'lunch-weekday') : (day === 5 || weekend ? 'weekend' : 'dinner-weekday');
  return prices.find((p) => p.when === want)?.id ?? null;
}

const mealScore = (m) => avg([m.rating?.a, m.rating?.b].filter(Boolean));

function dishStats(rid) {
  const map = new Map();
  const get = (id) => {
    let s = map.get(id);
    if (!s) map.set(id, (s = { times: 0, meals: 0, ra: [], rb: [], last: null, hist: [] }));
    return s;
  };
  const meals = D().meals.filter((m) => m.rid === rid).sort((a, b) => a.startedAt - b.startedAt);
  for (const m of meals) {
    const c = counts(m);
    for (const id of new Set([...Object.keys(c), ...Object.keys(m.ratings)])) {
      const s = get(id);
      const n = c[id]?.n || 0;
      const rt = m.ratings[id] || {};
      if (n) { s.times += n; s.meals++; s.last = m.startedAt; }
      if (rt.a) s.ra.push(rt.a);
      if (rt.b) s.rb.push(rt.b);
      s.hist.push({ mid: m.id, at: m.startedAt, n, a: rt.a || 0, b: rt.b || 0 });
    }
  }
  for (const s of map.values()) {
    s.avgA = avg(s.ra);
    s.avgB = avg(s.rb);
    s.avg = avg([s.avgA, s.avgB].filter((x) => x != null));
    s.debate = s.avgA != null && s.avgB != null && Math.abs(s.avgA - s.avgB) >= 2;
    s.hist.reverse();
  }
  return map;
}

function restStats(rid) {
  const meals = D().meals.filter((m) => m.rid === rid && m.log.length);
  let pieces = 0, best = 0;
  meals.forEach((m) => {
    const t = totals(m);
    pieces += t.pieces;
    best = Math.max(best, t.pieces);
  });
  const scores = meals.map(mealScore).filter((x) => x != null);
  return {
    visits: meals.length, pieces, best,
    avgPieces: meals.length ? pieces / meals.length : 0,
    score: avg(scores),
    last: meals.length ? Math.max(...meals.map((m) => m.startedAt)) : null,
  };
}

function globalStats() {
  const meals = D().meals.filter((m) => m.log.length);
  let pieces = 0, pa = 0, pb = 0, best = null;
  for (const m of meals) {
    const t = totals(m);
    pieces += t.pieces;
    pa += t.pa;
    pb += t.pb;
    if (!best || t.pieces > best.t.pieces) best = { m, t };
  }
  return { meals: meals.length, pieces, pa, pb, best, avg: meals.length ? pieces / meals.length : 0 };
}

function topLikes(limit) {
  const out = [];
  for (const r of D().restaurants) {
    for (const [id, s] of dishStats(r.id)) {
      const d = dishOf(r, id);
      if (d && s.avg != null && s.avg >= 4) out.push({ r, d, s });
    }
  }
  return out.sort((a, b) => b.s.avg - a.s.avg || b.s.times - a.s.times).slice(0, limit);
}

/* ───────────── piezas de interfaz ───────────── */

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  share: '<path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 13v7h14v-7"/>',
  load: '<path d="M12 15V4M7.5 10.5L12 15l4.5-4.5M5 13v7h14v-7"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M5 16V5a1 1 0 011-1h9"/>',
};
const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
const iconBtn = (n, label, attrs) => `<button class="ab-btn" aria-label="${esc(label)}" ${attrs}>${icon(n)}</button>`;
const iconLink = (n, label, href) => `<a class="ab-btn" aria-label="${esc(label)}" href="${href}">${icon(n)}</a>`;

function appbar({ title, jp = '', sub = '', back = '', brand = false, actions = '' }) {
  return `<header class="appbar"><div class="appbar-in">
    ${back ? `<a class="ab-btn ab-back" href="${back}" aria-label="Volver">${icon('back')}</a>` : brand ? '<span class="hinomaru" aria-hidden="true"></span>' : ''}
    <div class="ab-title">
      ${jp ? `<span class="ab-jp" lang="ja">${jp}</span>` : ''}
      <h1>${esc(title)}</h1>
      ${sub ? `<span class="ab-sub">${esc(sub)}</span>` : ''}
    </div>
    <div class="ab-actions">${actions}</div>
  </div></header>`;
}

const EXTRA_LABEL = { aparte: 'Extra', noche: 'Libre solo noches' };
const EXTRA_TEXT = { aparte: 'Fuera del buffet: se paga aparte', noche: 'Libre en cenas y fines de semana; a mediodía, aparte' };

const RATE_WORDS = ['', 'Nunca más', 'Regular', 'Bien', 'Muy rico', 'Favorito'];

function rateHTML(v, attrs) {
  return `<span class="rate" data-v="${v}">${[1, 2, 3, 4, 5]
    .map((i) => `<button class="pip ${i <= v ? 'on' : ''}" data-act="rate" data-v="${i}" ${attrs} aria-label="${i} de 5"></button>`)
    .join('')}<span class="rate-word">${RATE_WORDS[v] || ''}</span></span>`;
}

function rateLine(kind, m, w, did = '') {
  const v = kind === 'dish' ? m.ratings[did]?.[w] || 0 : m.rating?.[w] || 0;
  const attrs = `data-kind="${kind}" data-mid="${m.id}" data-did="${did}" data-w="${w}"`;
  return `<div class="rate-line"><span class="rl-who"><i class="dot ${w}"></i>${esc(N()[w])}</span>${rateHTML(v, attrs)}</div>`;
}

function pipsRO(v) {
  const n = Math.round(v);
  return `<span class="pips-ro" aria-label="${f1(v)} de 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
}

function splitHTML(c) {
  if (!c?.n) return '';
  return `<span class="split">${['a', 's', 'b']
    .filter((w) => c[w])
    .map((w) => `<span><i class="dot ${w}"></i>${c[w]}</span>`)
    .join('')}</span>`;
}

function duoHTML(t) {
  const tot = t.pa + t.pb;
  return `<div class="duo">
    <div class="duo-labels"><span><i class="dot a"></i>${esc(N().a)} <b>${f1(t.pa)}</b></span><span><b>${f1(t.pb)}</b> ${esc(N().b)}<i class="dot b"></i></span></div>
    <div class="duo-bar">${tot ? `<i class="a" style="flex:${t.pa}"></i><i class="b" style="flex:${t.pb}"></i>` : '<i class="none"></i>'}</div>
  </div>`;
}

function emptyState(jp, title, text = '', extra = '') {
  return `<div class="empty"><span class="empty-jp" lang="ja">${jp}</span><h2>${title}</h2>${text ? `<p>${text}</p>` : ''}${extra}</div>`;
}

function secTitle(jp, text, extra = '') {
  return `<h3 class="sec"><span class="sec-jp" lang="ja">${jp}</span>${text}${extra}</h3>`;
}

function dishMeta(d, s) {
  const meta = [];
  if (d.pieces) meta.push(`${d.pieces} ${d.pieces === 1 ? 'pz' : 'pzs'}`);
  if (d.supl) meta.push(`<i class="tag supl">+${eurShort(d.supl.eur)}${d.supl.from > 1 ? ' 2ª vez' : ''}</i>`);
  if (d.rec) meta.push('<i class="tag rec" lang="ja">おすすめ</i>');
  if (d.extra) meta.push(`<i class="tag extra">${EXTRA_LABEL[d.extra]}</i>`);
  if (s?.avg != null) meta.push(`<span class="mini-score">${pipsRO(s.avg)}${f1(s.avg)}</span>`);
  if (d.note) meta.push('<span class="has-note">nota</span>');
  return meta.length ? `<span class="dish-meta">${meta.join('')}</span>` : '';
}

/* ───────────── vistas ───────────── */

function viewMissing(msg) {
  return {
    tab: null,
    html: `${appbar({ back: '#/', title: 'Sushi Counter' })}<div class="page">${emptyState('迷子', 'No encontrado', esc(msg), '<a class="btn" href="#/">Ir al inicio</a>')}</div>`,
  };
}

/* Inicio */

function viewHome() {
  const d = D();
  const active = activeMeal();
  const st = globalStats();
  const recent = d.meals.filter((m) => m.id !== d.activeMealId).sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  const likes = topLikes(5);
  const many = d.restaurants.length > 1;

  const startCard = d.restaurants.length
    ? `<section class="card start">
        <p class="start-jp" lang="ja">いただきます</p>
        <h2>¿Sushi hoy?</h2>
        <label class="field"><span>Restaurante</span>
          <select id="start-rid">${d.restaurants.map((r) => `<option value="${r.id}" ${r.id === defaultRid() ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        </label>
        <button class="btn primary big" data-act="start">Empezar a contar</button>
        <button class="btn-link" data-act="past-meal">Apuntar una comida pasada</button>
      </section>`
    : `<section class="card start">${emptyState('店', 'Añade un restaurante', 'Para empezar a contar necesitas al menos un restaurante con su carta.', '<a class="btn primary" href="#/restaurantes">Ir a restaurantes</a>')}</section>`;

  const activeCard = active
    ? (() => {
        const r = rest(active.rid);
        const t = totals(active, r);
        return `<a class="card live" href="#/comida/${active.id}">
          <span class="live-tag"><i></i>En curso · ${esc(r?.name || '')}</span>
          <span class="live-num"><b>${f1(t.pieces)}</b><span lang="ja">貫</span></span>
          <span class="live-sub">${t.plates} ${t.plates === 1 ? 'plato' : 'platos'} · ronda ${active.round} · ${duration(Date.now() - active.startedAt)}</span>
          <span class="btn primary">Seguir contando</span>
        </a>`;
      })()
    : '';

  const stats = st.meals
    ? `<section class="block">
        ${secTitle('統計', 'Vuestros números')}
        <div class="stats">
          <div class="stat"><b>${st.meals}</b><span>${st.meals === 1 ? 'comida' : 'comidas'}</span></div>
          <div class="stat"><b>${f1(st.pieces)}</b><span>piezas en total</span></div>
          <div class="stat"><b>${f1(st.avg)}</b><span>piezas por comida</span></div>
          <div class="stat"><b>${st.best ? f1(st.best.t.pieces) : '—'}</b><span>récord${st.best ? ` · ${dShort.format(st.best.m.startedAt)}` : ''}</span></div>
        </div>
        ${duoHTML(st)}
      </section>`
    : `<section class="block how">
        ${secTitle('使い方', 'Cómo funciona')}
        <ol class="steps">
          <li><b>Empezad la comida</b> al sentaros.</li>
          <li><b>Tocad cada plato</b> cuando lo pidáis. Elegid si es tuyo, suyo o compartido.</li>
          <li><b>Al terminar, puntuad</b> de 1 a 5 lo que habéis comido.</li>
          <li>En <b>Gustos</b> veréis qué repetir y qué no volver a pedir.</li>
        </ol>
      </section>`;

  const likesBlock = likes.length
    ? `<section class="block">
        ${secTitle('好き', 'Lo que más os gusta', '<a class="sec-link" href="#/gustos">Ver todo</a>')}
        <div class="list">${likes.map(({ r, d, s }) => likeRowHTML(r, d, s, many)).join('')}</div>
      </section>`
    : '';

  const recentBlock = recent.length
    ? `<section class="block">
        ${secTitle('最近', 'Últimas comidas', '<a class="sec-link" href="#/historial">Historial</a>')}
        <div class="list">${recent.map(mealCardHTML).join('')}</div>
      </section>`
    : '';

  return {
    tab: 'home',
    html: `${appbar({ title: 'Sushi Counter', jp: 'すし帳', brand: true, actions: iconLink('settings', 'Ajustes', '#/ajustes') })}
      <div class="page">${activeCard || startCard}${stats}${likesBlock}${recentBlock}</div>`,
  };
}

/* Contador */

function heroHTML(m, r) {
  const t = totals(m, r);
  const end = m.endedAt || Date.now();
  return `<div class="hero-num"><span class="num" id="pieces">${f1(t.pieces)}</span><span class="kan" lang="ja" aria-hidden="true">貫</span></div>
    <p class="hero-label">piezas de sushi · <b>${t.plates}</b> ${t.plates === 1 ? 'plato' : 'platos'} · <span id="elapsed">${duration(end - m.startedAt)}</span></p>
    ${duoHTML(t)}`;
}

function roundHTML(m, r) {
  const inRound = m.log.filter((e) => e.r === m.round);
  const max = r.maxPerRound ? r.maxPerRound * 2 : 0;
  const slots = Math.max(max, inRound.length);
  const dots = max
    ? `<span class="round-dots" aria-label="${inRound.length} de ${max} platos en esta ronda">${Array.from({ length: slots }, (_, i) => `<i class="${inRound[i] ? inRound[i].w : ''} ${i >= max ? 'over' : ''}"></i>`).join('')}</span>`
    : `<span class="round-count">${inRound.length} ${inRound.length === 1 ? 'plato' : 'platos'}</span>`;
  return `<div class="round-info"><span class="round-n"><small lang="ja">${m.round}巡目</small>Ronda ${m.round}</span>${dots}</div>
    <button class="btn small" data-act="new-round" data-id="${m.id}">Nueva ronda</button>`;
}

function whoHTML(m) {
  const w = m.who || 's';
  return [['a', N().a], ['s', 'Compartido'], ['b', N().b]]
    .map(([k, label]) => `<button role="radio" aria-checked="${w === k}" data-act="who" data-w="${k}" data-id="${m.id}"><i class="dot ${k}"></i><span>${esc(label)}</span></button>`)
    .join('');
}

function chipsHTML(m, r) {
  const ordered = Object.keys(counts(m)).length;
  const cats = r.categories.filter((c) => r.dishes.some((d) => d.cat === c.id && !d.archived));
  const items = [['todo', 'Toda la carta'], ['pedido', `Pedido · ${ordered}`], ['gusta', 'Nos gusta'], ['rec', 'おすすめ'], ...cats.map((c) => [`c:${c.id}`, c.name])];
  return items.map(([k, label]) => `<button class="chip ${ui.filter === k ? 'on' : ''}" data-act="filter" data-f="${esc(k)}">${esc(label)}</button>`).join('');
}

function searchScore(d, q) {
  const code = norm(d.code);
  const name = norm(d.name);
  if (code && code === q) return 0;
  if (code && code.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (name.includes(q)) return 3;
  if (norm(d.desc).includes(q)) return 4;
  return -1;
}

function listHTML(m, r) {
  const c = counts(m);
  const stats = dishStats(r.id);
  ui.stats = stats;
  const q = norm(ui.query.trim());
  const f = ui.filter;
  let dishes = r.dishes.filter((d) => !d.archived || c[d.id]);

  if (f === 'pedido') {
    const order = orderedIds(m);
    dishes = dishes.filter((d) => c[d.id] || m.ratings[d.id]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  } else if (f === 'gusta') {
    dishes = dishes.filter((d) => (stats.get(d.id)?.avg ?? 0) >= 4).sort((a, b) => stats.get(b.id).avg - stats.get(a.id).avg);
  } else if (f === 'rec') {
    dishes = dishes.filter((d) => d.rec);
  } else if (f.startsWith('c:')) {
    dishes = dishes.filter((d) => d.cat === f.slice(2));
  }

  if (q) {
    dishes = dishes
      .map((d) => ({ d, k: searchScore(d, q) }))
      .filter((x) => x.k >= 0)
      .sort((a, b) => a.k - b.k)
      .map((x) => x.d);
  }

  const row = (d) => dishRowHTML(m, r, d, c[d.id], stats.get(d.id), f === 'pedido');

  if (!dishes.length) {
    const addBtn = `<button class="btn" data-act="new-dish" data-rid="${r.id}" data-mid="${m.id}" data-q="${esc(ui.query.trim())}">Añadir ${q ? `«${esc(ui.query.trim())}»` : 'un plato'} a la carta</button>`;
    if (q) return emptyState('無', 'No está en la carta', 'Si lo habéis pedido igualmente, añadidlo y se apuntará.', addBtn);
    if (f === 'pedido') return emptyState('空', 'Aún no habéis pedido nada', 'Tocad un plato de la carta para sumarlo.');
    if (f === 'gusta') return emptyState('好', 'Todavía sin favoritos', 'Los platos que puntuéis con 4 o 5 aparecerán aquí.');
    return emptyState('空', 'Nada por aquí', '', addBtn);
  }

  if (f === 'todo' && !q) {
    return r.categories
      .map((cat) => {
        const ds = dishes.filter((d) => d.cat === cat.id);
        if (!ds.length) return '';
        return `<h3 class="cat-h" id="cat-${cat.id}">${cat.jp ? `<span class="cat-jp" lang="ja">${esc(cat.jp)}</span>` : ''}${esc(cat.name)}</h3>${ds.map(row).join('')}`;
      })
      .join('') + `<div class="list-foot"><button class="btn" data-act="new-dish" data-rid="${r.id}" data-mid="${m.id}">Añadir un plato que no está en la carta</button></div>`;
  }
  return dishes.map(row).join('');
}

function dishRowHTML(m, r, d, c, s, withRating) {
  const n = c?.n || 0;
  return `<div class="dish ${n ? 'on' : ''}" data-dish="${d.id}">
    <button class="dish-main" data-act="add" data-id="${d.id}" aria-label="Sumar ${esc(d.name)}">
      <span class="code">${esc(d.code || '·')}</span>
      <span class="dish-text"><span class="dish-name">${esc(d.name)}</span>${dishMeta(d, s)}${splitHTML(c)}</span>
    </button>
    <div class="dish-side">
      ${n ? `<button class="minus" data-act="remove" data-id="${d.id}" aria-label="Quitar uno de ${esc(d.name)}">${icon('minus')}</button><button class="count" data-act="add" data-id="${d.id}" aria-label="Sumar otro ${esc(d.name)}">${n}</button>` : `<button class="plus" data-act="add" data-id="${d.id}" aria-label="Sumar ${esc(d.name)}">${icon('plus')}</button>`}
      <button class="info" data-act="dish" data-rid="${r.id}" data-id="${d.id}" data-mid="${m.id}" aria-label="Ficha de ${esc(d.name)}">${icon('info')}</button>
    </div>
    ${withRating ? `<div class="dish-rate">${rateLine('dish', m, 'a', d.id)}${rateLine('dish', m, 'b', d.id)}</div>` : ''}
  </div>`;
}

function viewCounter(id) {
  const m = mealById(id);
  if (!m) return viewMissing('Esta comida ya no existe.');
  const r = rest(m.rid);
  if (!r) return viewMissing('El restaurante de esta comida se ha borrado.');
  if (ui.mealId !== m.id) {
    ui.mealId = m.id;
    ui.filter = 'todo';
    ui.query = '';
  }
  const isActive = D().activeMealId === m.id;
  return {
    tab: null,
    hideTabbar: true,
    html: `${appbar({ back: '#/', title: r.name, sub: isActive ? `Desde las ${tHour.format(m.startedAt)}` : capital(dShort.format(m.startedAt)), actions: iconBtn('more', 'Opciones de la comida', `data-act="meal-menu" data-id="${m.id}"`) })}
      <div class="counter">
        <section class="hero" id="hero">${heroHTML(m, r)}</section>
        <section class="round" id="round">${roundHTML(m, r)}</section>
        <div class="toolbar">
          <div class="seg who" id="who" role="radiogroup" aria-label="¿Para quién es?">${whoHTML(m)}</div>
          <label class="search">${icon('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Número o nombre del plato" value="${esc(ui.query)}" data-input="q"></label>
          <div class="chips" id="chips">${chipsHTML(m, r)}</div>
        </div>
        <div class="dishes" id="list">${listHTML(m, r)}</div>
      </div>
      <div class="actionbar">
        <a class="btn" href="#/comida/${m.id}/resumen">Resumen</a>
        ${isActive ? `<button class="btn primary" data-act="finish" data-id="${m.id}">Terminar comida</button>` : `<a class="btn primary" href="#/comida/${m.id}/resumen">Hecho</a>`}
      </div>`,
    mount() {
      if (isActive) {
        timer = setInterval(() => {
          const el = $('#elapsed');
          if (el) el.textContent = duration(Date.now() - m.startedAt);
        }, 20000);
      }
    },
  };
}

function updateCounter(m, did, bump = false) {
  if (!$('#hero')) return;
  const r = rest(m.rid);
  $('#hero').innerHTML = heroHTML(m, r);
  $('#round').innerHTML = roundHTML(m, r);
  const chip = $('[data-f="pedido"]');
  if (chip) chip.textContent = `Pedido · ${Object.keys(counts(m)).length}`;
  const d = dishOf(r, did);
  if (d) {
    const c = counts(m)[did];
    const s = (ui.stats || dishStats(r.id)).get(did);
    $$(`.dish[data-dish="${CSS.escape(did)}"]`).forEach((el) => {
      el.outerHTML = dishRowHTML(m, r, d, c, s, ui.filter === 'pedido');
    });
  }
  if (bump) {
    $(`.dish[data-dish="${CSS.escape(did)}"] .count`)?.classList.add('bump');
    $('#pieces')?.classList.add('bump');
  }
}

/* Resumen de una comida */

function viewSummary(id) {
  const m = mealById(id);
  if (!m) return viewMissing('Esta comida ya no existe.');
  const r = rest(m.rid);
  if (!r) return viewMissing('El restaurante de esta comida se ha borrado.');
  const t = totals(m, r);
  const c = counts(m);
  const isActive = D().activeMealId === m.id;
  const order = orderedIds(m);
  const b = bill(m, r);

  const dishesHTML = order.length
    ? order
        .map((did) => {
          const d = dishOf(r, did);
          if (!d) return '';
          return `<div class="sum-dish">
            <button class="sd-head" data-act="dish" data-rid="${r.id}" data-id="${d.id}">
              <span class="code">${esc(d.code || '·')}</span><span class="dish-name">${esc(d.name)}</span><span class="sd-n">×${c[did]?.n || 0}</span>
            </button>
            ${splitHTML(c[did])}
            ${rateLine('dish', m, 'a', did)}${rateLine('dish', m, 'b', did)}
          </div>`;
        })
        .join('')
    : `<p class="muted">Todavía no hay nada apuntado. <a href="#/comida/${m.id}">Abrir el contador</a></p>`;

  const priceChips = r.prices?.length
    ? `<div class="chips wrap">${r.prices.map((p) => `<button class="chip ${m.priceId === p.id ? 'on' : ''}" data-act="price" data-id="${m.id}" data-p="${p.id}">${esc(p.label)} · ${eurShort(p.eur)}</button>`).join('')}</div>`
    : `<p class="muted small">Añade las tarifas del restaurante para calcular la cuenta.</p>`;

  return {
    tab: isActive ? null : 'hist',
    html: `${appbar({ back: isActive ? `#/comida/${m.id}` : '#/historial', title: 'Resumen', jp: '記録', actions: iconBtn('more', 'Opciones de la comida', `data-act="meal-menu" data-id="${m.id}"`) })}
      <div class="page">
        ${ui.justFinished === m.id ? `<div class="banner"><span class="banner-jp" lang="ja">ごちそうさまでした</span><p>¡Buen provecho! Puntuad lo que habéis comido para recordarlo la próxima vez.</p></div>` : ''}
        <section class="card sum-hero">
          <p class="eyebrow">${capital(dLong.format(m.startedAt))}</p>
          <h2>${esc(r.name)}</h2>
          <div class="hero-num"><span class="num">${f1(t.pieces)}</span><span class="kan" lang="ja" aria-hidden="true">貫</span></div>
          <p class="hero-label">piezas de sushi · <b>${t.plates}</b> ${t.plates === 1 ? 'plato' : 'platos'} · ${m.endedAt ? duration(m.endedAt - m.startedAt) : 'en curso'}</p>
          ${duoHTML(t)}
        </section>
        <section class="card">
          ${secTitle('評価', '¿Qué tal la comida?')}
          ${rateLine('meal', m, 'a')}${rateLine('meal', m, 'b')}
          <label class="field"><span>Notas</span><textarea id="meal-note" rows="3" data-input="meal-note" data-id="${m.id}" placeholder="La mesa, el servicio, qué pedir la próxima vez…">${esc(m.note)}</textarea></label>
        </section>
        <section class="card">
          ${secTitle('一品', 'Plato a plato')}
          <div class="sum-dishes">${dishesHTML}</div>
        </section>
        <section class="card">
          ${secTitle('勘定', 'La cuenta (aprox.)')}
          ${priceChips}
          <dl class="bill">
            <div><dt>Menú × 2${b.price ? ` (${eurShort(b.price.eur)})` : ''}</dt><dd>${eur(b.base)}</dd></div>
            <div><dt>Suplementos</dt><dd>${eur(b.supl)}</dd></div>
            <div><dt><label for="drinks">Bebidas y postres</label></dt><dd><input id="drinks" class="money" inputmode="decimal" autocomplete="off" data-input="drinks" data-id="${m.id}" value="${m.drinks ? nf2.format(m.drinks) : ''}" placeholder="0,00"></dd></div>
            <div class="total"><dt>Total</dt><dd id="bill-total">${eur(b.total)}</dd></div>
            <div class="pp"><dt>Por persona</dt><dd id="bill-pp">${eur(b.total / 2)}</dd></div>
          </dl>
        </section>
        <div class="row-actions">
          <a class="btn" href="#/comida/${m.id}">${isActive ? 'Volver al contador' : 'Editar pedido'}</a>
          <button class="btn danger" data-act="delete-meal" data-id="${m.id}">Borrar comida</button>
        </div>
      </div>`,
  };
}

/* Historial */

function mealCardHTML(m) {
  const r = rest(m.rid);
  const t = totals(m, r);
  const score = mealScore(m);
  const live = D().activeMealId === m.id;
  return `<a class="meal-card" href="#/comida/${m.id}${live ? '' : '/resumen'}">
    <span class="mc-date"><b>${dDay.format(m.startedAt)}</b><span>${dMon.format(m.startedAt).replace('.', '')}</span><small>${dWeekday.format(m.startedAt).replace('.', '')}</small></span>
    <span class="mc-main">
      <b>${esc(r?.name || 'Restaurante borrado')}</b>
      <span class="muted">${t.plates} ${t.plates === 1 ? 'plato' : 'platos'}${m.endedAt ? ` · ${duration(m.endedAt - m.startedAt)}` : ''}</span>
      ${live ? '<span class="pill live-pill">En curso</span>' : score != null ? `<span class="mini-score">${pipsRO(score)}${f1(score)}</span>` : '<span class="muted small">Sin puntuar</span>'}
    </span>
    <span class="mc-num"><b>${f1(t.pieces)}</b><span>piezas</span></span>
  </a>`;
}

function viewHistory() {
  const d = D();
  if (ui.histRid !== 'all' && !rest(ui.histRid)) ui.histRid = 'all';
  let meals = [...d.meals].sort((a, b) => b.startedAt - a.startedAt);
  if (ui.histRid !== 'all') meals = meals.filter((m) => m.rid === ui.histRid);
  const groups = [];
  for (const m of meals) {
    const dt = new Date(m.startedAt);
    const key = `${dt.getFullYear()}-${dt.getMonth()}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, label: capital(dMonth.format(dt)), meals: [] }));
    g.meals.push(m);
  }
  const chips = d.restaurants.length > 1
    ? `<div class="chips">${[['all', 'Todos'], ...d.restaurants.map((r) => [r.id, r.name])].map(([k, l]) => `<button class="chip ${ui.histRid === k ? 'on' : ''}" data-act="hist-filter" data-r="${k}">${esc(l)}</button>`).join('')}</div>`
    : '';
  return {
    tab: 'hist',
    html: `${appbar({ title: 'Historial', jp: '記録', actions: iconBtn('plus', 'Apuntar una comida pasada', 'data-act="past-meal"') })}
      <div class="page">
        ${chips}
        ${groups.length
          ? groups.map((g) => `<section class="block"><h3 class="month">${g.label}</h3><div class="list">${g.meals.map(mealCardHTML).join('')}</div></section>`).join('')
          : emptyState('記', 'Aún no hay comidas', 'Cuando empecéis a contar, cada comida quedará guardada aquí.', '<a class="btn primary" href="#/">Empezar una</a>')}
      </div>`,
  };
}

/* Gustos */

function likeRowHTML(r, d, s, showRest = false) {
  const meta = [];
  if (s?.times) meta.push(`×${s.times}`);
  if (s?.last) meta.push(`última vez ${dShort.format(s.last)}`);
  if (showRest) meta.push(esc(r.name));
  if (!s?.times && d.rec) meta.push('<i class="tag rec" lang="ja">おすすめ</i>');
  return `<button class="like" data-act="dish" data-rid="${r.id}" data-id="${d.id}">
    <span class="code">${esc(d.code || '·')}</span>
    <span class="like-main">
      <span class="dish-name">${esc(d.name)}${s?.debate ? ' <i class="tag debate">opiniones divididas</i>' : ''}</span>
      ${meta.length ? `<span class="dish-meta">${meta.join('<span class="sep">·</span>')}</span>` : ''}
    </span>
    ${s?.avg != null
      ? `<span class="like-score"><b>${f1(s.avg)}</b>${pipsRO(s.avg)}<span class="pp">${s.avgA != null ? `<span><i class="dot a"></i>${f1(s.avgA)}</span>` : ''}${s.avgB != null ? `<span><i class="dot b"></i>${f1(s.avgB)}</span>` : ''}</span></span>`
      : `<span class="like-score none">${s?.times ? 'sin nota' : ''}</span>`}
  </button>`;
}

function likesData(r) {
  const stats = dishStats(r.id);
  const all = r.dishes.filter((d) => !d.archived || stats.has(d.id)).map((d, i) => ({ d, s: stats.get(d.id), i }));
  const rated = all.filter((x) => x.s?.avg != null);
  return {
    top: rated.filter((x) => x.s.avg >= 4).sort((a, b) => b.s.avg - a.s.avg || b.s.times - a.s.times),
    evitar: rated.filter((x) => x.s.avg <= 2.5).sort((a, b) => a.s.avg - b.s.avg),
    probar: all.filter((x) => !x.s?.times && x.s?.avg == null).sort((a, b) => b.d.rec - a.d.rec || a.i - b.i),
    todo: [...all].sort((a, b) => (b.s?.avg ?? -1) - (a.s?.avg ?? -1) || (b.s?.times ?? 0) - (a.s?.times ?? 0) || a.i - b.i),
  };
}

function likesListHTML(r) {
  const data = likesData(r);
  const q = norm(ui.likesQuery.trim());
  let items = data[ui.likesSeg] || [];
  if (q) items = items.filter((x) => searchScore(x.d, q) >= 0);
  if (!items.length) {
    const msgs = {
      top: ['好', 'Aún no hay favoritos', 'Puntuad los platos con 4 o 5 al terminar una comida y aparecerán aquí.'],
      evitar: ['嫌', 'Nada que evitar', 'Los platos con nota media de 2,5 o menos saldrán aquí para no repetirlos.'],
      probar: ['全', '¡Lo habéis probado todo!', 'No queda nada de la carta sin pedir.'],
      todo: ['空', 'La carta está vacía', 'Añade platos desde Restaurantes.'],
    };
    const [jp, t, x] = q ? ['無', 'Sin resultados', 'Prueba con otro número o nombre.'] : msgs[ui.likesSeg];
    return emptyState(jp, t, x);
  }
  return `<div class="list">${items.map((x) => likeRowHTML(r, x.d, x.s)).join('')}</div>`;
}

function viewLikes(ridParam) {
  const d = D();
  const rid = ridParam && rest(ridParam) ? ridParam : ui.likesRid && rest(ui.likesRid) ? ui.likesRid : defaultRid();
  const r = rest(rid);
  if (!r) {
    return { tab: 'likes', html: `${appbar({ title: 'Gustos', jp: '好み' })}<div class="page">${emptyState('店', 'No hay restaurantes', '', '<a class="btn primary" href="#/restaurantes">Añadir uno</a>')}</div>` };
  }
  ui.likesRid = rid;
  const data = likesData(r);
  const segs = [['top', 'Top'], ['evitar', 'Evitar'], ['probar', 'Por probar'], ['todo', 'Todo']];
  const chips = d.restaurants.length > 1
    ? `<div class="chips">${d.restaurants.map((x) => `<a class="chip ${x.id === rid ? 'on' : ''}" href="#/gustos/${x.id}">${esc(x.name)}</a>`).join('')}</div>`
    : '';
  return {
    tab: 'likes',
    html: `${appbar({ title: 'Gustos', jp: '好み', sub: d.restaurants.length > 1 ? '' : r.name })}
      <div class="page">
        ${chips}
        <div class="seg segs" role="tablist">${segs.map(([k, l]) => `<button role="tab" aria-selected="${ui.likesSeg === k}" data-act="likes-seg" data-s="${k}"><span>${l}</span><small>${data[k].length}</small></button>`).join('')}</div>
        <label class="search">${icon('search')}<input id="likes-q" type="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar en ${esc(r.name)}" value="${esc(ui.likesQuery)}" data-input="likes-q"></label>
        <p class="legend">Nota media de los dos · <i class="dot a"></i>${esc(N().a)} <i class="dot b"></i>${esc(N().b)}</p>
        <div id="likes-list">${likesListHTML(r)}</div>
      </div>`,
  };
}

/* Restaurantes */

function viewRestaurants() {
  const d = D();
  return {
    tab: 'rest',
    html: `${appbar({ title: 'Restaurantes', jp: '店', actions: iconBtn('plus', 'Nuevo restaurante', 'data-act="new-rest"') })}
      <div class="page">
        ${d.restaurants.length
          ? `<div class="list">${d.restaurants
              .map((r) => {
                const st = restStats(r.id);
                const n = r.dishes.filter((x) => !x.archived).length;
                return `<a class="rest-card" href="#/r/${r.id}">
                  <span class="rc-mark" aria-hidden="true" lang="ja">${esc((r.name.trim()[0] || '寿').toUpperCase())}</span>
                  <span class="rc-main">
                    <b>${esc(r.name)}</b>
                    ${r.place ? `<span class="muted">${esc(r.place)}</span>` : ''}
                    <span class="dish-meta">${st.visits} ${st.visits === 1 ? 'visita' : 'visitas'}<span class="sep">·</span>${n} platos${st.score != null ? `<span class="sep">·</span><span class="mini-score">${pipsRO(st.score)}${f1(st.score)}</span>` : ''}</span>
                  </span>
                  ${icon('chev')}
                </a>`;
              })
              .join('')}</div>`
          : emptyState('店', 'Sin restaurantes', 'Añade vuestro sitio de sushi favorito con su carta.')}
        <button class="btn primary" data-act="new-rest">Nuevo restaurante</button>
      </div>`,
  };
}

function viewRestaurant(id) {
  const r = rest(id);
  if (!r) return viewMissing('Este restaurante ya no existe.');
  const st = restStats(r.id);
  const active = activeMeal();
  const n = r.dishes.filter((x) => !x.archived).length;
  const startBtn = active
    ? active.rid === r.id
      ? `<a class="btn primary" href="#/comida/${active.id}">Seguir contando</a>`
      : `<a class="btn" href="#/comida/${active.id}">Hay una comida en curso en otro sitio</a>`
    : `<button class="btn primary" data-act="start-here" data-id="${r.id}">Empezar comida aquí</button>`;
  return {
    tab: 'rest',
    html: `${appbar({ back: '#/restaurantes', title: r.name, jp: '店', actions: iconBtn('edit', 'Editar restaurante', `data-act="edit-rest" data-id="${r.id}"`) })}
      <div class="page">
        <section class="card rest-hero">
          <h2>${esc(r.name)}</h2>
          ${r.place ? `<p>${esc(r.place)}</p>` : ''}
          ${r.phone ? `<p class="muted">Teléfono <a href="tel:${esc(r.phone.replace(/\s/g, ''))}" class="sel">${esc(r.phone)}</a></p>` : ''}
          ${r.hours ? `<p class="muted">${esc(r.hours)}</p>` : ''}
          ${startBtn}
        </section>
        <nav class="list">
          <a class="nav-row" href="#/r/${r.id}/carta"><span lang="ja" class="nav-jp">品</span><span><b>Carta</b><span class="muted">${n} platos · ${r.categories.length} secciones</span></span>${icon('chev')}</a>
          <a class="nav-row" href="#/gustos/${r.id}"><span lang="ja" class="nav-jp">好</span><span><b>Lo que nos gusta</b><span class="muted">Top, a evitar y por probar</span></span>${icon('chev')}</a>
        </nav>
        ${st.visits
          ? `<div class="stats">
              <div class="stat"><b>${st.visits}</b><span>${st.visits === 1 ? 'visita' : 'visitas'}</span></div>
              <div class="stat"><b>${f1(st.avgPieces)}</b><span>piezas por visita</span></div>
              <div class="stat"><b>${f1(st.best)}</b><span>récord de piezas</span></div>
              <div class="stat"><b>${st.score != null ? f1(st.score) : '—'}</b><span>nota media</span></div>
            </div>`
          : ''}
        ${r.prices?.length
          ? `<section class="card">${secTitle('料金', 'Tarifas por persona')}<dl class="bill">${r.prices.map((p) => `<div><dt>${esc(p.label)}</dt><dd>${eur(p.eur)}</dd></div>`).join('')}</dl></section>`
          : ''}
        ${r.maxPerRound || r.notes
          ? `<section class="card">${secTitle('注意', 'Normas y notas')}${r.maxPerRound ? `<p>Máximo <b>${r.maxPerRound} platos por persona</b> en cada ronda.</p>` : ''}${r.notes ? `<p class="pre">${esc(r.notes)}</p>` : ''}</section>`
          : ''}
        ${r.source ? `<p class="muted small center">${esc(r.source)}</p>` : ''}
        <button class="btn danger" data-act="delete-rest" data-id="${r.id}">Borrar restaurante</button>
      </div>`,
  };
}

function menuListHTML(r) {
  const q = norm(ui.menuQuery.trim());
  const hidden = r.dishes.filter((d) => d.archived).length;
  const visible = (d) => (ui.showHidden || !d.archived) && (!q || searchScore(d, q) >= 0);
  const html = r.categories
    .map((cat) => {
      const ds = r.dishes.filter((d) => d.cat === cat.id && visible(d));
      if (q && !ds.length) return '';
      return `<div class="cat-h menu-cat">
          ${cat.jp ? `<span class="cat-jp" lang="ja">${esc(cat.jp)}</span>` : ''}<span>${esc(cat.name)}</span>
          <span class="cat-n">${ds.length}</span>
          <button class="ab-btn small" data-act="edit-cat" data-rid="${r.id}" data-cid="${cat.id}" aria-label="Editar sección ${esc(cat.name)}">${icon('edit')}</button>
        </div>
        ${ds.length
          ? ds.map((d) => `<button class="menu-row ${d.archived ? 'archived' : ''}" data-act="edit-dish" data-rid="${r.id}" data-id="${d.id}">
              <span class="code">${esc(d.code || '·')}</span>
              <span class="dish-text"><span class="dish-name">${esc(d.name)}${d.archived ? ' <i class="tag">oculto</i>' : ''}</span>${dishMeta(d)}</span>
              ${icon('chev')}
            </button>`).join('')
          : `<button class="menu-row empty-row" data-act="new-dish" data-rid="${r.id}" data-cat="${cat.id}">${icon('plus')}<span>Añadir el primer plato de esta sección</span></button>`}`;
    })
    .join('');
  return `${html || emptyState('無', 'Sin resultados')}
    ${hidden ? `<button class="btn-link" data-act="toggle-hidden">${ui.showHidden ? 'Ocultar' : 'Mostrar'} platos quitados de la carta (${hidden})</button>` : ''}`;
}

function viewMenu(id) {
  const r = rest(id);
  if (!r) return viewMissing('Este restaurante ya no existe.');
  return {
    tab: 'rest',
    html: `${appbar({ back: `#/r/${r.id}`, title: 'Carta', jp: 'お品書き', sub: r.name, actions: iconBtn('plus', 'Añadir plato', `data-act="new-dish" data-rid="${r.id}"`) })}
      <div class="page">
        <div class="row-actions">
          <button class="btn small" data-act="new-dish" data-rid="${r.id}">${icon('plus')}Plato</button>
          <button class="btn small" data-act="bulk-add" data-rid="${r.id}">Pegar lista</button>
          <button class="btn small" data-act="new-cat" data-rid="${r.id}">${icon('plus')}Sección</button>
        </div>
        <label class="search">${icon('search')}<input id="menu-q" type="search" autocomplete="off" placeholder="Buscar en la carta" value="${esc(ui.menuQuery)}" data-input="menu-q" data-rid="${r.id}"></label>
        <div id="menu-list" class="menu-list">${menuListHTML(r)}</div>
      </div>`,
  };
}

/* Ajustes */

const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function viewSettings() {
  const d = D();
  const seedMissing = Object.keys(BUILTINS).some((id) => !rest(id));
  return {
    tab: null,
    html: `${appbar({ back: '#/', title: 'Ajustes', jp: '設定' })}
      <div class="page">
        <section class="card">
          ${secTitle('名前', 'Vuestros nombres')}
          <label class="field"><span><i class="dot a"></i>Persona 1</span><input id="name-a" value="${esc(d.names.a)}" data-input="name" data-w="a" autocomplete="off"></label>
          <label class="field"><span><i class="dot b"></i>Persona 2</span><input id="name-b" value="${esc(d.names.b)}" data-input="name" data-w="b" autocomplete="off"></label>
        </section>
        ${isStandalone() ? '' : `<section class="card">
          ${secTitle('設置', 'Instalar en el iPhone')}
          <ol class="steps">
            <li>Abre esta página en <b>Safari</b>.</li>
            <li>Toca <b>Compartir</b> ${icon('share')} en la barra inferior.</li>
            <li>Elige <b>Añadir a pantalla de inicio</b>.</li>
          </ol>
          <p class="muted small">Se abrirá a pantalla completa como una app y funcionará sin conexión.</p>
        </section>`}
        <section class="card">
          ${secTitle('保存', 'Copia de seguridad')}
          <p class="muted small">Todo se guarda solo en este dispositivo. Haced una copia de vez en cuando (por ejemplo, en Archivos o iCloud Drive) para no perder vuestro historial.</p>
          <div class="btn-col">
            <button class="btn" data-act="export">${icon('share')}Exportar copia</button>
            <button class="btn" data-act="copy-data">${icon('copy')}Copiar datos</button>
            <label class="btn file-btn">${icon('load')}Importar copia<input type="file" id="import-file" accept="application/json,.json"></label>
            <button class="btn" data-act="paste-data">Pegar datos copiados</button>
          </div>
        </section>
        <section class="card">
          ${secTitle('品書き', 'Cartas de Sushitokyo y SUMO')}
          <p class="muted small">${seedMissing ? 'Has borrado alguna. Puedes volver a cargarla.' : 'Recarga las cartas originales si has borrado platos por error. Se mantienen tus notas, tus platos añadidos y el historial.'}</p>
          <button class="btn" data-act="restore-seed">${seedMissing ? 'Volver a cargar las cartas' : 'Restaurar cartas originales'}</button>
        </section>
        <section class="card">
          ${secTitle('危険', 'Empezar de cero')}
          <button class="btn danger" data-act="reset-all">Borrar todos los datos</button>
        </section>
        <p class="muted small center">Sushi Counter ${APP_VERSION} · ${d.meals.length} comidas · ${d.restaurants.length} restaurantes</p>
      </div>`,
  };
}

/* ───────────── hojas (bottom sheets) ───────────── */

let pendingConfirm = null;
let toastAction = null;
let toastTimer = null;

function openSheet(html) {
  const s = $('#sheet');
  s.innerHTML = `<div class="sheet-backdrop" data-act="sheet-close"></div><div class="sheet-panel" role="dialog" aria-modal="true"><div class="sheet-grip" aria-hidden="true"></div>${html}</div>`;
  s.hidden = false;
  requestAnimationFrame(() => s.classList.add('open'));
  document.documentElement.classList.add('sheet-open');
}

function closeSheet() {
  const s = $('#sheet');
  if (s.hidden) return;
  s.classList.remove('open');
  document.documentElement.classList.remove('sheet-open');
  setTimeout(() => {
    if (!s.classList.contains('open')) {
      s.hidden = true;
      s.innerHTML = '';
    }
  }, 220);
}

function confirmSheet({ title, text = '', ok = 'Aceptar', danger = false, jp = '' }, onOk) {
  pendingConfirm = onOk;
  openSheet(`<div class="confirm">
    ${jp ? `<p class="confirm-jp" lang="ja">${jp}</p>` : ''}
    <h2 class="sheet-title">${title}</h2>
    ${text ? `<p class="muted">${text}</p>` : ''}
    <div class="sheet-actions"><button class="btn" data-act="sheet-close">Cancelar</button><button class="btn ${danger ? 'danger-fill' : 'primary'}" data-act="confirm-ok">${ok}</button></div>
  </div>`);
}

function toast(html, action) {
  const el = $('#toast');
  toastAction = action?.fn || null;
  el.innerHTML = `<div class="toast-in" role="status"><span>${html}</span>${action ? `<button data-act="toast-action">${esc(action.label)}</button>` : ''}</div>`;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 4000 : 2400);
}

function openDish(rid, did, mid) {
  const r = rest(rid);
  const d = dishOf(r, did);
  if (!d) return;
  const s = dishStats(rid).get(did);
  const cat = r.categories.find((c) => c.id === d.cat);
  const m = mid ? mealById(mid) : null;
  const meta = [cat?.name, d.pieces ? `${d.pieces} ${d.pieces === 1 ? 'pieza' : 'piezas'}` : null, d.sushi ? null : 'no suma piezas'].filter(Boolean).map(esc).join(' · ');
  const tags = [
    d.rec ? '<i class="tag rec"><span lang="ja">おすすめ</span> de la casa</i>' : '',
    d.supl ? `<i class="tag supl">Suplemento ${eurShort(d.supl.eur)}${d.supl.from > 1 ? ' a partir de la 2ª vez' : ''}</i>` : '',
    d.extra ? `<i class="tag extra">${EXTRA_TEXT[d.extra]}</i>` : '',
  ].join('');
  const inMeal = m && (counts(m)[did] || m.ratings[did]);
  openSheet(`<div class="dish-sheet">
    <div class="ds-head"><span class="ds-code">${esc(d.code || '·')}</span><div><h2>${esc(d.name)}</h2><p class="muted">${meta}</p></div></div>
    ${d.desc ? `<p class="ds-desc">${esc(d.desc)}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${m ? `<div class="ds-add"><p class="muted small">Sumar uno para…</p><div class="seg">${['a', 's', 'b'].map((w) => `<button data-act="add-from-sheet" data-mid="${m.id}" data-id="${d.id}" data-w="${w}"><i class="dot ${w}"></i><span>${esc(whoName(w))}</span></button>`).join('')}</div></div>` : ''}
    ${inMeal ? `<div class="ds-today"><p class="muted small">Nota de hoy</p>${rateLine('dish', m, 'a', did)}${rateLine('dish', m, 'b', did)}</div>` : ''}
    <div class="ds-stats">
      <div><b>${s?.times || 0}</b><span>veces pedido</span></div>
      <div><b>${s?.avgA != null ? f1(s.avgA) : '—'}</b><span><i class="dot a"></i>${esc(N().a)}</span></div>
      <div><b>${s?.avgB != null ? f1(s.avgB) : '—'}</b><span><i class="dot b"></i>${esc(N().b)}</span></div>
    </div>
    <label class="field"><span>Nota personal</span><textarea id="dish-note" rows="2" data-input="dish-note" data-rid="${r.id}" data-id="${d.id}" placeholder="Pedirlo sin salsa, mejor al mediodía…">${esc(d.note)}</textarea></label>
    ${s?.hist.length
      ? `<p class="muted small">Historial</p><ul class="hist">${s.hist.map((h) => `<li><a href="#/comida/${h.mid}/resumen">${capital(dShort.format(h.at))}</a><span>${h.n ? `×${h.n}` : '—'}</span><span class="hr"><i class="dot a"></i>${h.a || '–'}<i class="dot b"></i>${h.b || '–'}</span></li>`).join('')}</ul>`
      : '<p class="muted small">Aún no lo habéis pedido aquí.</p>'}
    <div class="sheet-actions"><button class="btn" data-act="edit-dish" data-rid="${r.id}" data-id="${d.id}">Editar plato</button><button class="btn primary" data-act="sheet-close">Cerrar</button></div>
  </div>`);
}

function dishForm(r, d, opts = {}) {
  const isNew = !d;
  const preCat = opts.cat || r.categories.find((c) => c.id === ui.filter.slice(2))?.id || r.categories[r.categories.length - 1]?.id;
  const q = (opts.q || '').trim();
  const qIsCode = /^\d+[a-z]?$/i.test(q);
  d = d || { code: qIsCode ? q.toUpperCase() : '', name: qIsCode ? '' : q, desc: '', pieces: null, cat: preCat, rec: false, supl: null, note: '' };
  const cat = r.categories.find((c) => c.id === d.cat);
  const sushi = isNew ? cat?.sushi ?? true : d.sushi;
  openSheet(`<h2 class="sheet-title">${isNew ? 'Nuevo plato' : 'Editar plato'}</h2>
    <form id="dish-form" class="form" data-rid="${r.id}" data-id="${isNew ? '' : d.id}" data-mid="${opts.mid || ''}" autocomplete="off">
      <div class="grid-code">
        <label class="field"><span>Nº</span><input id="f-code" value="${esc(d.code)}" placeholder="158"></label>
        <label class="field"><span>Nombre</span><input id="f-name" value="${esc(d.name)}" placeholder="Rollo tigre" required></label>
      </div>
      <label class="field"><span>Sección</span>
        <select id="f-cat">${r.categories.map((c) => `<option value="${c.id}" ${c.id === d.cat ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ Nueva sección…</option></select>
      </label>
      <label class="field" id="f-newcat-wrap" hidden><span>Nombre de la nueva sección</span><input id="f-newcat" placeholder="Postres"></label>
      <div class="grid2">
        <label class="field"><span>Piezas por plato</span><input id="f-pieces" inputmode="numeric" value="${d.pieces ?? ''}" placeholder="—"></label>
        <label class="field"><span>Suplemento</span><input id="f-supl" inputmode="decimal" value="${d.supl ? nf2.format(d.supl.eur) : ''}" placeholder="0,00 €"></label>
      </div>
      <label class="check"><input type="checkbox" id="f-sushi" ${sushi ? 'checked' : ''}><span>Cuenta como sushi (suma piezas al contador)</span></label>
      <label class="check"><input type="checkbox" id="f-supl2" ${d.supl?.from > 1 ? 'checked' : ''}><span>El suplemento solo se cobra a partir de la 2ª vez</span></label>
      <label class="check"><input type="checkbox" id="f-rec" ${d.rec ? 'checked' : ''}><span>Recomendado por la casa (<span lang="ja">おすすめ</span>)</span></label>
      <label class="field"><span>Descripción</span><textarea id="f-desc" rows="2">${esc(d.desc)}</textarea></label>
      <label class="field"><span>Nota personal</span><textarea id="f-note" rows="2" placeholder="Pedirlo sin salsa…">${esc(d.note)}</textarea></label>
      <div class="sheet-actions">
        ${isNew ? '' : `<button type="button" class="btn danger" data-act="delete-dish" data-rid="${r.id}" data-id="${d.id}">Quitar</button>`}
        <button type="button" class="btn" data-act="sheet-close">Cancelar</button>
        <button type="submit" class="btn primary">${opts.mid && isNew ? 'Guardar y sumar' : 'Guardar'}</button>
      </div>
    </form>`);
}

function catForm(r, c) {
  const isNew = !c;
  c = c || { name: '', jp: '', sushi: true };
  const used = isNew ? 0 : r.dishes.filter((d) => d.cat === c.id).length;
  openSheet(`<h2 class="sheet-title">${isNew ? 'Nueva sección' : 'Editar sección'}</h2>
    <form id="cat-form" class="form" data-rid="${r.id}" data-cid="${isNew ? '' : c.id}" autocomplete="off">
      <label class="field"><span>Nombre</span><input id="c-name" value="${esc(c.name)}" placeholder="Uramaki" required></label>
      <label class="field"><span>Palabra en japonés (opcional)</span><input id="c-jp" value="${esc(c.jp)}" placeholder="裏巻き" lang="ja"></label>
      <label class="check"><input type="checkbox" id="c-sushi" ${c.sushi ? 'checked' : ''}><span>Los platos nuevos de esta sección cuentan como sushi</span></label>
      <div class="sheet-actions">
        ${isNew ? '' : `<button type="button" class="btn danger" data-act="delete-cat" data-rid="${r.id}" data-cid="${c.id}" ${used ? 'disabled' : ''}>${used ? 'Tiene platos' : 'Borrar'}</button>`}
        <button type="button" class="btn" data-act="sheet-close">Cancelar</button>
        <button type="submit" class="btn primary">Guardar</button>
      </div>
    </form>`);
}

function priceRowHTML(p = {}) {
  return `<div class="price-row" data-pid="${esc(p.id || uid())}" data-when="${esc(p.when || '')}">
    <input class="pr-label" value="${esc(p.label || '')}" placeholder="Cena" aria-label="Nombre de la tarifa">
    <input class="pr-eur money" inputmode="decimal" value="${p.eur != null ? nf2.format(p.eur) : ''}" placeholder="0,00" aria-label="Precio por persona">
    <button type="button" class="ab-btn small" data-act="del-price-row" aria-label="Quitar tarifa">${icon('x')}</button>
  </div>`;
}

function restForm(r) {
  const isNew = !r;
  r = r || { name: '', place: '', phone: '', hours: '', notes: '', maxPerRound: null, prices: [] };
  openSheet(`<h2 class="sheet-title">${isNew ? 'Nuevo restaurante' : 'Editar restaurante'}</h2>
    <form id="rest-form" class="form" data-id="${isNew ? '' : r.id}" autocomplete="off">
      <label class="field"><span>Nombre</span><input id="r-name" value="${esc(r.name)}" placeholder="Sushi del barrio" required></label>
      <label class="field"><span>Zona o dirección</span><input id="r-place" value="${esc(r.place)}" placeholder="Calle, centro comercial…"></label>
      <div class="grid2">
        <label class="field"><span>Teléfono</span><input id="r-phone" inputmode="tel" value="${esc(r.phone)}"></label>
        <label class="field"><span>Platos/persona/ronda</span><input id="r-max" inputmode="numeric" value="${r.maxPerRound ?? ''}" placeholder="Sin límite"></label>
      </div>
      <label class="field"><span>Horario</span><input id="r-hours" value="${esc(r.hours)}"></label>
      <div class="field"><span>Tarifas por persona</span><div id="price-rows" class="price-rows">${r.prices.map(priceRowHTML).join('')}</div>
        <button type="button" class="btn small" data-act="add-price-row">${icon('plus')}Añadir tarifa</button></div>
      <label class="field"><span>Notas</span><textarea id="r-notes" rows="3" placeholder="Normas del buffet, qué pedir…">${esc(r.notes)}</textarea></label>
      <div class="sheet-actions"><button type="button" class="btn" data-act="sheet-close">Cancelar</button><button type="submit" class="btn primary">Guardar</button></div>
    </form>`);
}

function parseBulk(text) {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      let code = '';
      let pieces = null;
      let name = line;
      const mc = name.match(/^(\d+[a-z]?)[\s.)\-–]+(.+)$/i);
      if (mc) { code = mc[1].toUpperCase(); name = mc[2]; }
      const mp = name.match(/^(.*?)[\s/·,-]*(?:[x×]\s*(\d+)|(\d+)\s*(?:pzs?|piezas|uds?|u)\.?)\s*$/i);
      if (mp && mp[1].trim()) { name = mp[1]; pieces = Number(mp[2] || mp[3]); }
      return { code, name: name.trim(), pieces };
    })
    .filter((x) => x.name);
}

/* ───────────── acciones ───────────── */

function startMeal(rid, opts = {}) {
  const d = D();
  const cur = activeMeal();
  if (cur && !opts.past) { location.hash = `#/comida/${cur.id}`; return; }
  const r = rest(rid);
  if (!r) return;
  const at = opts.at || Date.now();
  const m = {
    id: uid(), rid, startedAt: at, endedAt: opts.past ? at + 90 * 60000 : null,
    who: 's', round: 1, log: [], ratings: {}, rating: { a: 0, b: 0 }, note: '',
    priceId: suggestPrice(r, at), drinks: 0,
  };
  d.meals.push(m);
  if (!opts.past) d.activeMealId = m.id;
  d.lastRid = rid;
  save();
  ui.mealId = null;
  location.hash = `#/comida/${m.id}`;
}

function addDish(mid, did, w) {
  const m = mealById(mid);
  if (!m) return;
  const entry = { d: did, w: w || m.who || 's', r: m.round, t: Date.now() };
  m.log.push(entry);
  updateCounter(m, did, true);
  saveSoon(250);
  const d = dishOf(rest(m.rid), did);
  toast(`<b>+1</b> ${esc(d?.name || '')} <span class="toast-who">${esc(whoName(entry.w))}</span>`, {
    label: 'Deshacer',
    fn: () => {
      const i = m.log.lastIndexOf(entry);
      if (i >= 0) { m.log.splice(i, 1); save(); updateCounter(m, did); }
    },
  });
}

function removeDish(mid, did) {
  const m = mealById(mid);
  if (!m) return;
  const who = m.who || 's';
  let i = -1;
  for (let k = m.log.length - 1; k >= 0 && i < 0; k--) if (m.log[k].d === did && m.log[k].w === who) i = k;
  for (let k = m.log.length - 1; k >= 0 && i < 0; k--) if (m.log[k].d === did) i = k;
  if (i < 0) return;
  m.log.splice(i, 1);
  updateCounter(m, did);
  saveSoon(250);
}

function refresh() {
  render({ keepScroll: true });
}

async function exportData() {
  const json = JSON.stringify(D(), null, 2);
  const name = `sushi-counter-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Copia de Sushi Counter' });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { toast('Ese texto no es una copia válida.'); return; }
  if (!data || !Array.isArray(data.restaurants) || !Array.isArray(data.meals)) { toast('El archivo no parece una copia de Sushi Counter.'); return; }
  confirmSheet({ title: '¿Reemplazar los datos?', text: `La copia tiene ${data.meals.length} comidas y ${data.restaurants.length} restaurantes. Lo que hay ahora en este dispositivo se sustituirá.`, ok: 'Importar', danger: true }, () => {
    try {
      db.replace(data);
      toast('Copia importada');
      location.hash = '#/';
      refresh();
    } catch (e) {
      toast(esc(e.message));
    }
  });
}

const actions = {
  'sheet-close': () => closeSheet(),
  'confirm-ok': () => {
    const fn = pendingConfirm;
    pendingConfirm = null;
    closeSheet();
    fn?.();
  },
  'toast-action': () => {
    const fn = toastAction;
    toastAction = null;
    $('#toast').classList.remove('show');
    fn?.();
  },

  start: () => startMeal($('#start-rid')?.value || defaultRid()),
  'start-here': (el) => startMeal(el.dataset.id),
  'past-meal': () => {
    const d = D();
    if (!d.restaurants.length) { location.hash = '#/restaurantes'; return; }
    const today = toLocalInput(Date.now()).slice(0, 10);
    openSheet(`<h2 class="sheet-title">Apuntar una comida pasada</h2>
      <form id="past-form" class="form">
        <label class="field"><span>Restaurante</span><select id="p-rid">${d.restaurants.map((r) => `<option value="${r.id}" ${r.id === defaultRid() ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        <div class="grid2">
          <label class="field"><span>Día</span><input type="date" id="p-date" value="${today}" max="${today}" required></label>
          <label class="field"><span>Momento</span><select id="p-time"><option value="14:00">Mediodía</option><option value="21:00" selected>Noche</option></select></label>
        </div>
        <p class="muted small">Después podréis marcar lo que pedisteis y puntuarlo.</p>
        <div class="sheet-actions"><button type="button" class="btn" data-act="sheet-close">Cancelar</button><button type="submit" class="btn primary">Crear</button></div>
      </form>`);
  },

  add: (el) => addDish(ui.mealId, el.dataset.id),
  remove: (el) => removeDish(ui.mealId, el.dataset.id),
  'add-from-sheet': (el) => {
    closeSheet();
    addDish(el.dataset.mid, el.dataset.id, el.dataset.w);
  },
  who: (el) => {
    const m = mealById(el.dataset.id);
    m.who = el.dataset.w;
    save();
    $('#who').innerHTML = whoHTML(m);
  },
  'new-round': (el) => {
    const m = mealById(el.dataset.id);
    m.round++;
    save();
    $('#round').innerHTML = roundHTML(m, rest(m.rid));
    toast(`Ronda ${m.round} <span lang="ja">· ${m.round}巡目</span>`);
  },
  filter: (el) => {
    ui.filter = el.dataset.f;
    const m = mealById(ui.mealId);
    $$('#chips .chip').forEach((c) => c.classList.toggle('on', c.dataset.f === ui.filter));
    $('#list').innerHTML = listHTML(m, rest(m.rid));
    const tb = $('.toolbar');
    const target = $('#list').getBoundingClientRect().top + window.scrollY - tb.offsetHeight - $('.appbar').offsetHeight;
    if (window.scrollY > target) window.scrollTo({ top: target });
  },
  finish: (el) => {
    const m = mealById(el.dataset.id);
    const t = totals(m);
    confirmSheet({ jp: 'ごちそうさま', title: '¿Terminamos?', text: `${f1(t.pieces)} piezas y ${t.plates} platos en ${duration(Date.now() - m.startedAt)}. Después podréis puntuarlo todo.`, ok: 'Terminar comida' }, () => {
      m.endedAt = Date.now();
      if (D().activeMealId === m.id) D().activeMealId = null;
      save();
      ui.justFinished = m.id;
      location.hash = `#/comida/${m.id}/resumen`;
    });
  },
  'meal-menu': (el) => {
    const m = mealById(el.dataset.id);
    const isActive = D().activeMealId === m.id;
    openSheet(`<h2 class="sheet-title">Opciones de la comida</h2>
      <form id="date-form" class="form" data-id="${m.id}">
        <label class="field"><span>Fecha y hora de inicio</span><input type="datetime-local" id="m-date" value="${toLocalInput(m.startedAt)}" required></label>
        <button type="submit" class="btn">Cambiar fecha</button>
      </form>
      <div class="btn-col">
        ${isActive ? `<button class="btn primary" data-act="finish" data-id="${m.id}">Terminar comida</button>` : ''}
        <button class="btn danger" data-act="delete-meal" data-id="${m.id}">Borrar comida</button>
        <button class="btn" data-act="sheet-close">Cerrar</button>
      </div>`);
  },
  'delete-meal': (el) => {
    const id = el.dataset.id;
    confirmSheet({ title: '¿Borrar esta comida?', text: 'Se perderán lo que pedisteis y las notas. No se puede deshacer.', ok: 'Borrar', danger: true }, () => {
      const d = D();
      d.meals = d.meals.filter((m) => m.id !== id);
      if (d.activeMealId === id) d.activeMealId = null;
      save();
      toast('Comida borrada');
      location.hash = '#/historial';
    });
  },
  rate: (el) => {
    const { kind, mid, did, w } = el.dataset;
    const v = Number(el.dataset.v);
    const m = mealById(mid);
    if (!m) return;
    let next;
    if (kind === 'dish') {
      const cur = m.ratings[did] || { a: 0, b: 0 };
      next = cur[w] === v ? 0 : v;
      cur[w] = next;
      if (cur.a || cur.b) m.ratings[did] = cur;
      else delete m.ratings[did];
    } else {
      m.rating ||= { a: 0, b: 0 };
      next = m.rating[w] === v ? 0 : v;
      m.rating[w] = next;
    }
    save();
    // Actualiza todos los controles iguales (p. ej. lista + ficha abierta).
    $$(`.pip[data-kind="${kind}"][data-mid="${mid}"][data-did="${did}"][data-w="${w}"]`).forEach((p) => {
      p.classList.toggle('on', Number(p.dataset.v) <= next);
      const group = p.closest('.rate');
      group.dataset.v = next;
      $('.rate-word', group).textContent = RATE_WORDS[next] || '';
    });
  },
  price: (el) => {
    const m = mealById(el.dataset.id);
    m.priceId = m.priceId === el.dataset.p ? null : el.dataset.p;
    save();
    refresh();
  },
  'hist-filter': (el) => {
    ui.histRid = el.dataset.r;
    refresh();
  },
  'likes-seg': (el) => {
    ui.likesSeg = el.dataset.s;
    $$('.segs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.s === ui.likesSeg)));
    $('#likes-list').innerHTML = likesListHTML(rest(ui.likesRid));
  },
  dish: (el) => openDish(el.dataset.rid, el.dataset.id, el.dataset.mid),

  'new-rest': () => restForm(null),
  'edit-rest': (el) => restForm(rest(el.dataset.id)),
  'add-price-row': () => $('#price-rows').insertAdjacentHTML('beforeend', priceRowHTML()),
  'del-price-row': (el) => el.closest('.price-row').remove(),
  'delete-rest': (el) => {
    const r = rest(el.dataset.id);
    const n = D().meals.filter((m) => m.rid === r.id).length;
    confirmSheet({ title: `¿Borrar ${esc(r.name)}?`, text: n ? `También se borrarán sus ${n} comidas del historial.` : 'Se borrará con toda su carta.', ok: 'Borrar', danger: true }, () => {
      const d = D();
      d.restaurants = d.restaurants.filter((x) => x.id !== r.id);
      d.meals = d.meals.filter((m) => m.rid !== r.id);
      if (d.activeMealId && !mealById(d.activeMealId)) d.activeMealId = null;
      save();
      toast('Restaurante borrado');
      location.hash = '#/restaurantes';
    });
  },
  'new-dish': (el) => dishForm(rest(el.dataset.rid), null, { mid: el.dataset.mid, q: el.dataset.q, cat: el.dataset.cat }),
  'edit-dish': (el) => {
    const r = rest(el.dataset.rid);
    dishForm(r, dishOf(r, el.dataset.id));
  },
  'delete-dish': (el) => {
    const r = rest(el.dataset.rid);
    const d = dishOf(r, el.dataset.id);
    const used = D().meals.some((m) => m.rid === r.id && (m.log.some((e) => e.d === d.id) || m.ratings[d.id]));
    if (used) {
      d.archived = true;
      toast('Quitado de la carta. Se mantiene en el historial.');
    } else {
      r.dishes = r.dishes.filter((x) => x.id !== d.id);
      toast('Plato borrado');
    }
    save();
    closeSheet();
    refresh();
  },
  'new-cat': (el) => catForm(rest(el.dataset.rid), null),
  'edit-cat': (el) => {
    const r = rest(el.dataset.rid);
    catForm(r, r.categories.find((c) => c.id === el.dataset.cid));
  },
  'delete-cat': (el) => {
    const r = rest(el.dataset.rid);
    r.categories = r.categories.filter((c) => c.id !== el.dataset.cid);
    save();
    closeSheet();
    refresh();
  },
  'toggle-hidden': () => {
    ui.showHidden = !ui.showHidden;
    refresh();
  },
  'bulk-add': (el) => {
    const r = rest(el.dataset.rid);
    openSheet(`<h2 class="sheet-title">Pegar una lista de platos</h2>
      <form id="bulk-form" class="form" data-rid="${r.id}">
        <label class="field"><span>Sección</span><select id="b-cat">${r.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Un plato por línea</span><textarea id="b-text" rows="7" data-input="bulk" placeholder="158 Rollo tigre 8 pzs&#10;159 Rollo ángel 8 pzs&#10;Gyoza de pollo x5&#10;Edamame"></textarea></label>
        <p class="muted small" id="b-preview">El número delante y las piezas al final («8 pzs» o «x8») son opcionales.</p>
        <div class="sheet-actions"><button type="button" class="btn" data-act="sheet-close">Cancelar</button><button type="submit" class="btn primary">Añadir</button></div>
      </form>`);
  },

  export: () => exportData(),
  'copy-data': async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(D()));
      toast('Datos copiados. Pégalos en Notas o en un mensaje para guardarlos.');
    } catch {
      toast('No se ha podido copiar. Usa «Exportar copia».');
    }
  },
  'paste-data': () => {
    openSheet(`<h2 class="sheet-title">Pegar datos copiados</h2>
      <form id="paste-form" class="form">
        <label class="field"><span>Datos</span><textarea id="paste-text" rows="6" placeholder='{"v":1,…}'></textarea></label>
        <div class="sheet-actions"><button type="button" class="btn" data-act="sheet-close">Cancelar</button><button type="submit" class="btn primary">Importar</button></div>
      </form>`);
  },
  'restore-seed': () => {
    db.restoreSeeds();
    toast('Cartas originales cargadas');
    refresh();
  },
  'reset-all': () => {
    confirmSheet({ title: '¿Borrar todo?', text: 'Se borrarán todas las comidas, notas y restaurantes de este dispositivo. Exporta una copia antes si la quieres guardar.', ok: 'Borrar todo', danger: true }, () => {
      db.reset();
      ui.mealId = null;
      toast('Datos borrados');
      location.hash = '#/';
      refresh();
      setTimeout(onboarding, 300);
    });
  },
  'onboard-done': () => {
    const a = $('#ob-a').value.trim();
    const b = $('#ob-b').value.trim();
    if (a) D().names.a = a;
    if (b) D().names.b = b;
    D().onboarded = true;
    save();
    closeSheet();
    refresh();
  },
};

const forms = {
  'past-form': () => {
    const [y, mo, da] = $('#p-date').value.split('-').map(Number);
    const [h, mi] = $('#p-time').value.split(':').map(Number);
    if (!y) return;
    closeSheet();
    startMeal($('#p-rid').value, { past: true, at: new Date(y, mo - 1, da, h, mi).getTime() });
  },
  'date-form': (f) => {
    const m = mealById(f.dataset.id);
    const ts = new Date($('#m-date').value).getTime();
    if (!Number.isFinite(ts)) return;
    if (m.endedAt) m.endedAt += ts - m.startedAt;
    m.startedAt = ts;
    save();
    closeSheet();
    refresh();
    toast('Fecha cambiada');
  },
  'rest-form': (f) => {
    const name = $('#r-name').value.trim();
    if (!name) { $('#r-name').focus(); return; }
    const prices = $$('.price-row', f)
      .map((row) => ({ id: row.dataset.pid, when: row.dataset.when || undefined, label: $('.pr-label', row).value.trim(), eur: parseNum($('.pr-eur', row).value) }))
      .filter((p) => p.label && p.eur != null);
    const max = parseInt($('#r-max').value, 10);
    const fields = {
      name, prices,
      place: $('#r-place').value.trim(),
      phone: $('#r-phone').value.trim(),
      hours: $('#r-hours').value.trim(),
      notes: $('#r-notes').value.trim(),
      maxPerRound: max > 0 ? max : null,
    };
    closeSheet();
    if (f.dataset.id) {
      Object.assign(rest(f.dataset.id), fields);
      save();
      refresh();
      toast('Guardado');
    } else {
      const r = { id: uid(), ...fields, categories: [{ id: 'carta', name: 'Carta', jp: '', sushi: true }], dishes: [], createdAt: Date.now() };
      D().restaurants.push(r);
      save();
      location.hash = `#/r/${r.id}/carta`;
      toast('Restaurante creado. Ahora añade su carta.');
    }
  },
  'dish-form': (f) => {
    const r = rest(f.dataset.rid);
    const name = $('#f-name').value.trim();
    if (!name) { $('#f-name').focus(); return; }
    let cat = $('#f-cat').value;
    if (cat === '__new') {
      const c = { id: uid(), name: $('#f-newcat').value.trim() || 'Otros', jp: '', sushi: $('#f-sushi').checked };
      r.categories.push(c);
      cat = c.id;
    }
    const pieces = parseInt($('#f-pieces').value, 10);
    const supl = parseNum($('#f-supl').value);
    const fields = {
      code: $('#f-code').value.trim().toUpperCase(),
      name, cat,
      pieces: pieces > 0 ? pieces : null,
      sushi: $('#f-sushi').checked,
      rec: $('#f-rec').checked,
      supl: supl > 0 ? { eur: supl, from: $('#f-supl2').checked ? 2 : 1 } : null,
      desc: $('#f-desc').value.trim(),
      note: $('#f-note').value.trim(),
    };
    let id = f.dataset.id;
    if (id) Object.assign(dishOf(r, id), fields);
    else {
      id = uid();
      r.dishes.push({ id, ...fields });
    }
    save();
    closeSheet();
    if (f.dataset.mid && !f.dataset.id) {
      ui.query = '';
      refresh();
      addDish(f.dataset.mid, id);
    } else {
      refresh();
      toast('Plato guardado');
    }
  },
  'cat-form': (f) => {
    const r = rest(f.dataset.rid);
    const name = $('#c-name').value.trim();
    if (!name) { $('#c-name').focus(); return; }
    const fields = { name, jp: $('#c-jp').value.trim(), sushi: $('#c-sushi').checked };
    if (f.dataset.cid) Object.assign(r.categories.find((c) => c.id === f.dataset.cid), fields);
    else r.categories.push({ id: uid(), ...fields });
    save();
    closeSheet();
    refresh();
  },
  'bulk-form': (f) => {
    const r = rest(f.dataset.rid);
    const cat = r.categories.find((c) => c.id === $('#b-cat').value);
    const items = parseBulk($('#b-text').value);
    if (!items.length) { $('#b-text').focus(); return; }
    items.forEach((x) => r.dishes.push({ id: uid(), code: x.code, name: x.name, pieces: x.pieces, cat: cat.id, sushi: cat.sushi, rec: false, supl: null, desc: '', note: '' }));
    save();
    closeSheet();
    refresh();
    toast(`${items.length} ${items.length === 1 ? 'plato añadido' : 'platos añadidos'}`);
  },
  'paste-form': () => {
    const text = $('#paste-text').value.trim();
    if (!text) return;
    closeSheet();
    setTimeout(() => importJSON(text), 250);
  },
};

const inputs = {
  q: (el) => {
    ui.query = el.value;
    const m = mealById(ui.mealId);
    $('#list').innerHTML = listHTML(m, rest(m.rid));
  },
  'likes-q': (el) => {
    ui.likesQuery = el.value;
    $('#likes-list').innerHTML = likesListHTML(rest(ui.likesRid));
  },
  'menu-q': (el) => {
    ui.menuQuery = el.value;
    $('#menu-list').innerHTML = menuListHTML(rest(el.dataset.rid));
  },
  'meal-note': (el) => {
    mealById(el.dataset.id).note = el.value;
    saveSoon();
  },
  'dish-note': (el) => {
    dishOf(rest(el.dataset.rid), el.dataset.id).note = el.value;
    saveSoon();
  },
  drinks: (el) => {
    const m = mealById(el.dataset.id);
    m.drinks = Math.max(0, parseNum(el.value) || 0);
    saveSoon();
    const b = bill(m);
    $('#bill-total').textContent = eur(b.total);
    $('#bill-pp').textContent = eur(b.total / 2);
  },
  name: (el) => {
    D().names[el.dataset.w] = el.value.trim() || (el.dataset.w === 'a' ? 'Yo' : 'Mi novia');
    saveSoon();
  },
  bulk: (el) => {
    const n = parseBulk(el.value).length;
    $('#b-preview').textContent = n ? `Se añadirán ${n} ${n === 1 ? 'plato' : 'platos'}.` : 'El número delante y las piezas al final («8 pzs» o «x8») son opcionales.';
  },
};

/* ───────────── router ───────────── */

let timer = null;
let lastPath = null;

function currentView() {
  const path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
  const seg = path.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return viewHome();
    case 'historial': return viewHistory();
    case 'gustos': return viewLikes(seg[1]);
    case 'restaurantes': return viewRestaurants();
    case 'r': return seg[2] === 'carta' ? viewMenu(seg[1]) : viewRestaurant(seg[1]);
    case 'comida': return seg[2] === 'resumen' ? viewSummary(seg[1]) : viewCounter(seg[1]);
    case 'ajustes': return viewSettings();
    default: return viewHome();
  }
}

function render({ keepScroll = false } = {}) {
  clearInterval(timer);
  timer = null;
  const y = window.scrollY;
  const v = currentView();
  $('#view').innerHTML = v.html;
  document.body.classList.toggle('no-tabbar', !!v.hideTabbar);
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === v.tab;
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  const path = location.hash;
  if (keepScroll || path === lastPath) window.scrollTo(0, y);
  else window.scrollTo(0, 0);
  lastPath = path;
  v.mount?.();
}

/* ───────────── arranque ───────────── */

function onboarding() {
  if (D().onboarded) return;
  openSheet(`<div class="onboard">
    <p class="confirm-jp" lang="ja">いらっしゃいませ</p>
    <h2 class="sheet-title">Vuestro contador de sushi</h2>
    <p class="muted">Contad cada pieza, puntuad cada plato y acordaos de lo que os gusta. Ya están cargadas las cartas de <b>Sushitokyo Príncipe Pío</b> y <b>SUMO</b>; podéis añadir más restaurantes cuando queráis.</p>
    <div class="grid2">
      <label class="field"><span><i class="dot a"></i>Tu nombre</span><input id="ob-a" value="${esc(N().a)}" autocomplete="off"></label>
      <label class="field"><span><i class="dot b"></i>Su nombre</span><input id="ob-b" value="${esc(N().b)}" autocomplete="off"></label>
    </div>
    ${isStandalone() ? '' : '<p class="muted small">Consejo: en Safari, toca Compartir y luego «Añadir a pantalla de inicio» para tenerla como app.</p>'}
    <div class="sheet-actions"><button class="btn primary big" data-act="onboard-done">Empezar</button></div>
  </div>`);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const f = e.target;
  if (!forms[f.id]) return;
  e.preventDefault();
  forms[f.id](f);
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el) inputs[el.dataset.input]?.(el, e);
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'f-cat') $('#f-newcat-wrap').hidden = e.target.value !== '__new';
  if (e.target.id === 'import-file') {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importJSON(String(reader.result));
    reader.readAsText(file);
    e.target.value = '';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  if (e.key === 'Enter' && e.target.id === 'q') e.target.blur();
});

document.addEventListener('animationend', (e) => e.target.classList?.remove('bump'));

window.addEventListener('hashchange', () => {
  closeSheet();
  $('#toast').classList.remove('show');
  toastAction = null;
  if (!location.hash.includes('/resumen')) ui.justFinished = null;
  render();
});

// Guarda lo pendiente al salir de la app.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
  else if (location.hash.startsWith('#/comida/') && !location.hash.includes('resumen')) {
    const m = mealById(ui.mealId);
    if (m && $('#hero')) $('#hero').innerHTML = heroHTML(m, rest(m.rid));
  }
});
window.addEventListener('pagehide', save);

db.load();
render();
onboarding();
askPersistence();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
