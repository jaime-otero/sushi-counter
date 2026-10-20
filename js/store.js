// Persistencia local (localStorage) + copia de seguridad en JSON.
import { seedRestaurants, buildSushiTokyo, SEED_ID, SEED_VERSION } from './seed.js';

const KEY = 'sushi-counter/v1';
const VERSION = 1;

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function fresh() {
  return {
    v: VERSION,
    names: { a: 'Yo', b: 'Mi novia' },
    onboarded: false,
    restaurants: seedRestaurants(),
    meals: [],
    activeMealId: null,
    createdAt: Date.now(),
  };
}

function isValid(d) {
  return d && typeof d === 'object' && Array.isArray(d.restaurants) && Array.isArray(d.meals) && d.names;
}

function migrate(d) {
  d.v ??= VERSION;
  d.meals.forEach((m) => {
    m.log ??= [];
    m.ratings ??= {};
    m.rating ??= { a: 0, b: 0 };
    m.round ??= 1;
  });
  // Actualiza tarifas y normas de la carta precargada sin tocar platos ni notas.
  const st = d.restaurants.find((r) => r.id === SEED_ID);
  if (st && (st.seed?.version ?? 1) < SEED_VERSION) {
    const seed = buildSushiTokyo();
    st.prices = seed.prices;
    st.notes = seed.notes;
    st.seed = seed.seed;
  }
  return d;
}

export const db = {
  data: null,

  load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { /* modo privado */ }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        this.data = isValid(parsed) ? migrate(parsed) : fresh();
      } catch {
        this.data = fresh();
      }
    } else {
      this.data = fresh();
    }
    return this.data;
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      console.error('No se pudo guardar', e);
      return false;
    }
  },

  replace(data) {
    if (!isValid(data)) throw new Error('El archivo no parece una copia de Sushi Counter.');
    this.data = migrate(data);
    this.save();
  },

  reset() {
    this.data = fresh();
    this.save();
  },

  // Vuelve a añadir la carta de Sushitokyo si se borró, o actualiza la carta
  // manteniendo notas personales y platos añadidos a mano.
  restoreSeed() {
    const seed = buildSushiTokyo();
    const current = this.data.restaurants.find((r) => r.id === SEED_ID);
    if (!current) {
      this.data.restaurants.unshift(seed);
    } else {
      const old = new Map(current.dishes.map((d) => [d.id, d]));
      const merged = seed.dishes.map((d) => {
        const o = old.get(d.id);
        return o ? { ...d, note: o.note || '', archived: false } : d;
      });
      const seedIds = new Set(seed.dishes.map((d) => d.id));
      current.dishes = [...merged, ...current.dishes.filter((d) => !seedIds.has(d.id))];
      const cats = new Map(current.categories.map((c) => [c.id, c]));
      seed.categories.forEach((c) => cats.set(c.id, c));
      current.categories = [...cats.values()];
      current.seed = seed.seed;
    }
    this.save();
  },
};

// Persistencia "de verdad": pide al navegador que no borre los datos.
export async function askPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch { /* no soportado */ }
}
