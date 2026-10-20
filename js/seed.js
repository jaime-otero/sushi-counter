// Carta precargada de Sushitokyo Príncipe Pío.
// Fuente: carta digital oficial enlazada desde sushitokyoprincipepio.com
// (to-focus.com/restaurant_menu/sushitokyo_principe_menu, menú noche), consultada el 20/10/2026.

import { SUMO_ID, SUMO_META, SUMO_CATEGORIES, SUMO_DISHES } from './seed-sumo.js';

export const SEED_ID = 'sushitokyo-principe-pio';
export const SEED_VERSION = 2;

const CATEGORIES = [
  ['entrantes', 'Entrantes y dim sum', '前菜', false],
  ['sopas', 'Sopa y ramen', '汁物', false],
  ['gunkan', 'Gunkan', '軍艦', true],
  ['especiales', 'Especiales', '特選', true],
  ['mixto', 'Sushi mixto', '盛合せ', true],
  ['sashimi', 'Sashimi', '刺身', true],
  ['nigiri', 'Nigiri', '握り', true],
  ['fritos', 'Fritos', '揚げ物', false],
  ['onigiri', 'Onigiri', 'おにぎり', true],
  ['bao', 'Bao', '包', false],
  ['arroz', 'Arroz', 'ご飯', false],
  ['fideos', 'Fideos', '麺', false],
  ['teppanyaki', 'Teppanyaki', '鉄板', false],
  ['wok', 'Wok variado', '炒め', false],
  ['poke', 'Taco y poke bowl', 'ポケ', false],
  ['maki', 'Futomaki y hosomaki', '巻き', true],
  ['temaki', 'Temaki', '手巻き', true],
  ['uramaki', 'Uramaki', '裏巻き', true],
];

// [nº, nombre, piezas, descripción, flags]
// flags: r = recomendado por la casa (pulgar en la carta)
//        s1/s2 = suplemento de 1/2 € · x1 = +1 € a partir de la 2ª vez
//        n = no cuenta como pieza de sushi aunque esté en una sección de sushi
const DISHES = {
  entrantes: [
    ['1', 'Edamame', null, 'Vainas de soja.', 'r'],
    ['3', 'Ensalada wakame', null, 'Ensalada de algas wakame.', 'r'],
    ['6', 'Takoyaki', null, 'Albóndigas de pulpo.', 'r'],
    ['7', 'Ensalada Yasai', null, 'Ensalada mixta de verduras y sésamo.', 'r'],
    ['40', 'Niku gyoza', 3, 'Gyozas de carne y verduras a la plancha.', 'r'],
    ['42', 'Pan frito', 2, '', ''],
    ['43', 'Shumai gyoza', 3, 'Raviolis de carne al vapor.', 'r'],
    ['44', 'Ebi gyoza', 3, 'Raviolis de gambas al vapor.', ''],
    ['45', 'Xiao Long Bao', null, 'Bollitos de sopa al vapor.', 'r'],
    ['29', 'Bolas de sésamo', null, '', 'r'],
  ],
  sopas: [
    ['9', 'Miso', null, 'Sopa de soja con algas y tofu.', 'r'],
    ['10', 'Miso mashi', null, 'Sopa con algas y gambas.', ''],
    ['11', 'Ramen style', null, 'Ramen en caldo con algas, huevo, surimi de cangrejo y gambas.', 'r'],
  ],
  gunkan: [
    ['20', 'Gunkan salmón calabacín', 2, 'Arroz envuelto en calabacín asado con salmón picante.', 'r'],
    ['21', 'Gunkan tobiko', 2, 'Arroz envuelto en alga con huevas de pez volador.', ''],
    ['23', 'Gunkan de salmón', 2, 'Arroz envuelto en salmón con tobiko, mayonesa picante y tabasco.', 'r'],
    ['24', 'Gunkan de queso crema', 2, 'Bolas de arroz con queso crema, copos de almendra y salsa teriyaki.', ''],
    ['26', 'Gunkan de fruta', 3, 'Arroz venus con queso crema, frutos del bosque y salsa de fresa.', 'r'],
  ],
  especiales: [
    ['80', 'Tartar doble', 2, 'Tartar de salmón, pez escolar, gambas al vapor, aguacate, tobiko, sésamo y salsa ponzu.', 'r s2'],
    ['81', 'Carpaccio mixto', null, 'Carpaccio de salmón, atún y pez escolar en salsa ponzu.', 'x1 n'],
    ['82', 'Rollo de salmón', 2, 'Queso crema envuelto en salmón con salsa teriyaki y pasta kataifi.', 'r s1'],
    ['83', 'Rollo de flor de atún', 2, 'Tempura de verduras y queso crema envuelta en atún, salsa rosa y teriyaki.', 'r s1'],
    ['84', 'Rollo de flor de salmón', 2, 'Tempura de verduras y queso crema envuelta en salmón, salsa rosa y teriyaki.', 's1'],
    ['85', 'White tartar', 1, 'Tartar de arroz y salmón cubierto de aguacate.', ''],
    ['86', 'Black tartar', 1, 'Tartar de salmón y arroz venus con aguacate, pasta kataifi y salsa de mango.', 'r'],
  ],
  mixto: [
    ['101', 'Barca', 18, '5 nigiri (con atún flameado), 5 sashimi, 4 hosomakis y 4 uramakis.', 's1'],
    ['102', 'Sake maguro nigiri', 8, '4 nigiri de salmón y 4 nigiri de atún flameado.', ''],
    ['103', 'Sushi mixto', 16, '8 nigiri (con atún flameado), 4 hosomakis y 4 uramakis.', ''],
  ],
  sashimi: [
    ['104', 'Sashimi mixto', null, 'Pescado crudo variado.', 's1'],
    ['105', 'Sashimi salmón', null, 'Salmón crudo.', 'x1'],
  ],
  nigiri: [
    ['186', 'Nigiri de salmón flameado', 2, 'Salmón flameado con salsa teriyaki, sésamo y leche condensada.', 'r'],
    ['187', 'Nigiri huevo', 2, 'Huevo de codorniz con salsa de trufa.', 'r'],
    ['188', 'Nigiri salmón', 2, 'Nigiri de salmón.', ''],
    ['189', 'Nigiri pez mantequilla', 2, 'Nigiri de pez mantequilla.', ''],
    ['190', 'Nigiri de amaebi', 2, 'Gambas con mayonesa y kataifi.', ''],
    ['191', 'Nigiri de atún', 2, 'Atún flambeado con salsa de anguila.', ''],
    ['192', 'Nigiri salmón style', 2, 'Salmón flameado con queso crema y pasta kataifi.', ''],
    ['193', 'Nigiri de anguila', 2, 'Anguila con salsa teriyaki y sésamo.', 'r'],
    ['194', 'Nigiri de aguacate', 2, 'Nigiri de aguacate.', ''],
    ['195', 'Nigiri spicy maguro', 2, 'Atún flameado, mayonesa y spicy kimchi.', 'r'],
    ['196', 'Nigiri sake mango', 2, 'Salmón flameado, salsa de mango y pistacho.', 'r'],
    ['197', 'Nigiri maguro trufada', 2, 'Atún flameado, salsa trufada y tobiko.', 'r'],
    ['198', 'Nigiri salmón love', 2, 'Salmón flameado, mayonesa picante, teriyaki y arroz frito.', 'r'],
    ['198F', 'Nigiri salmón fresa', 2, 'Salmón, fresa y salsa de fresa.', 'r'],
  ],
  fritos: [
    ['30', 'Tempura de verduras', null, '', 'r'],
    ['31', 'Pinzas de cangrejo frito', 2, '', ''],
    ['32', 'Harumaki ebi', 2, 'Rollitos fritos.', ''],
    ['32B', 'Rollito vietnamita', 2, 'Relleno de cerdo.', ''],
    ['33', 'Tempura moriawase', null, 'Gambas y verduras en tempura.', ''],
    ['34', 'Ebi tempura', null, 'Gambas en tempura.', ''],
    ['35', 'Saquito de verduras', null, '', 'r'],
    ['36', 'Alitas de pollo', null, '', ''],
    ['37', 'Patatas fritas', null, '', ''],
    ['38', 'Finger de pollo', null, 'Tiras de pollo rebozado en panko con salsa especial mayo.', 'r'],
  ],
  onigiri: [
    ['61', 'Onigiri de atún', 1, 'Triángulo de arroz con atún, mayonesa picante y sésamo.', ''],
    ['62', 'Onigiri sake', 1, 'Triángulo de arroz con salmón, queso crema y sésamo.', ''],
    ['63', 'Onigiri miura', 1, 'Triángulo de arroz con salmón, queso crema, mayonesa picante y sésamo.', ''],
  ],
  bao: [
    ['50', 'Yaki bao', 1, 'Pan al vapor con lechuga, tomate, pollo rebozado, especial mayo y sésamo.', ''],
    ['51', 'Ebi bao', 1, 'Pan al vapor con lechuga, tomate, ebi tempura, teriyaki y especial mayo.', 'r'],
    ['53', 'Pato bao', 1, 'Pan al vapor con pato asado y pepino con salsa hoisin.', ''],
  ],
  arroz: [
    ['52', 'Yakimeshi con gambas', null, 'Arroz salteado con gambas, verduras y huevo.', 'r'],
    ['54', 'Yakimeshi', null, 'Arroz salteado con verduras y huevo.', ''],
    ['55', 'Arroz blanco', null, '', ''],
  ],
  fideos: [
    ['65', 'Yakisoba', null, 'Fideos fritos con gambas, verduras y huevo.', 'r'],
    ['66', 'Fideos de arroz', null, 'Salteados con gambas, verduras y huevo.', ''],
    ['67', 'Espagueti de soja', null, 'Con gambas, verduras y huevo.', ''],
    ['68', 'Yakiudon', null, 'Udon salteado con gambas, verduras y huevo.', 'r'],
  ],
  teppanyaki: [
    ['70', 'Tataki de ternera', null, 'Ternera a la plancha con salsa especial.', 'r'],
    ['71', 'Ebi kushi', 2, 'Pinchos de gambas.', 'r'],
    ['72', 'Oebi no shioaki', 2, 'Langostinos a la plancha.', 'x1'],
    ['73', 'Pulpitos', null, 'A la plancha.', ''],
    ['74', 'Yaki tori', 2, 'Pinchos de pollo con salsa teriyaki.', 'r'],
    ['75', 'Verduras', null, 'Verduras variadas a la plancha.', ''],
    ['76', 'Almejas', null, 'Con salsa especial.', 'r'],
    ['77', 'Sepia a la plancha', null, '', ''],
    ['78', 'Viera', 2, '', 's2'],
  ],
  wok: [
    ['115', 'Pollo con bambú', null, 'Pollo salteado con bambú y setas.', 'r'],
    ['116', 'Gambas con sal y pimienta', null, 'Gambas rebozadas y verduras.', ''],
    ['117', 'Pollo al curry con leche de coco', null, 'Con verduras.', ''],
    ['118', 'Lemon tori', null, 'Pollo en salsa de limón.', 'r'],
    ['119', 'Pato asado', null, '', 'r'],
    ['120', 'Ebi picante', null, 'Gambas y verduras con salsa picante.', ''],
    ['121', 'Gambas con setas', null, 'Gambas salteadas con bambú y setas.', 'r'],
    ['122', 'Pollo con almendras', null, 'Con verduras.', ''],
    ['123', 'Pak choi', null, 'Verduras salteadas.', ''],
    ['124', 'Ternera Sushitokyo', null, 'Ternera con salsa de ostras y verduras.', 'r'],
    ['125', 'Ternera con bambú', null, 'Con bambú y champiñones.', ''],
    ['126', 'Sartén de calamares y verduras', null, 'Ligeramente picante.', 'r'],
    ['127', 'Sartén de gambas y verduras', null, 'Ligeramente picante.', 'r'],
    ['128', 'Sartén de ternera y verduras', null, 'Ligeramente picante.', 'r'],
    ['129', 'Sartén de pollo y verduras', null, 'Ligeramente picante.', 'r'],
  ],
  poke: [
    ['184', 'Poke pollo crujiente', null, 'Pollo crujiente, aguacate, cebolla crujiente, wakame y tomate cherry con mayonesa y teriyaki.', 'x1'],
    ['185', 'Poke salmón spicy', null, 'Salmón, aguacate, cebolla crujiente, wakame y tomate cherry con spicy mayo.', 's1'],
    ['199', 'Taco ebi', 1, 'Pasta crujiente, ebi tempura, aguacate, spicy mayo y cebolla crujiente.', 'x1'],
    ['200', 'Taco sake', 1, 'Pasta crujiente con salmón picado, aguacate, salsa de mango y kataifi.', 'x1'],
  ],
  maki: [
    ['201', 'Futo frito', 4, 'Maki frito con queso crema, pasta kataifi y salsa teriyaki.', 'r'],
    ['202', 'Futo ebiten', 8, 'Gambas en tempura, mayonesa, pasta kataifi y salsa teriyaki.', ''],
    ['210', 'Hoso fruta', 4, 'Maki frito, queso crema, fresas, sésamo y salsa de fresa.', 'r'],
    ['211', 'Hoso sake', 8, 'Maki de salmón.', ''],
    ['212', 'Hoso aguacate', 8, 'Maki de aguacate.', ''],
    ['213', 'Hoso tekka', 8, 'Maki de atún.', ''],
    ['214', 'Hoso gamba', 8, 'Maki de gamba cocida.', ''],
    ['215', 'Hoso mango', 4, 'Maki frito, queso crema, mango, sésamo y salsa de mango.', 'r'],
  ],
  temaki: [
    ['136', 'Temaki mango', 1, 'Ensalada, aguacate, philadelphia y salsa de mango.', 'r'],
    ['137', 'Temaki vegetal', 1, 'Queso crema, aguacate, frisée y sésamo.', ''],
    ['138', 'Temaki Sushitokyo', 1, 'Queso crema, aguacate, salmón y copos de almendra.', ''],
    ['139', 'Temaki sake', 1, 'Salmón, aguacate y sésamo.', ''],
    ['140', 'Temaki black rice', 1, 'Arroz venus, salmón y pistachos en hojaldre de soja con sésamo.', ''],
    ['141', 'Temaki rosa ángel', 1, 'Gambas en tempura, aguacate, queso crema y patata frita en hojaldre de soja.', ''],
    ['142', 'Temaki ebiten y salmón', 1, 'Salmón, gambas en tempura, patata frita y salsa de azafrán en hojaldre de soja.', 'r'],
  ],
  uramaki: [
    ['150', 'Salmón plus', 8, 'Salmón, aguacate, salmón flameado, cheddar, mayonesa picante, teriyaki y pistachos.', 'r'],
    ['151', 'Rollo atún fantasy', 8, 'Atún, aguacate, sésamo y spicy mayo.', ''],
    ['152', 'Rúcula roll', 8, 'Salmón, aguacate, rúcula y spicy mayo.', ''],
    ['153', 'Rollo crujiente', 8, 'Arroz venus con gambas en tempura, aguacate, almendra y teriyaki.', ''],
    ['154', 'Sake aguacate', 4, 'Salmón con aguacate y sésamo.', 'r'],
    ['155', 'Salmón picante', 4, 'Salmón, aguacate, tobiko y mayonesa picante.', ''],
    ['156', 'Miura maki', 4, 'Atún cocido con queso crema y sésamo.', ''],
    ['157', 'Ebiten', 4, 'Gambas en tempura, mayonesa, pasta kataifi, teriyaki y sésamo.', ''],
    ['158', 'Rollo tigre', 8, 'Gambas en tempura con mayonesa, cubierto de salmón y salsa teriyaki.', 'r'],
    ['159', 'Rollo ángel', 8, 'Gambas en tempura y queso crema, cubierto de aguacate y salsa teriyaki.', 'r'],
    ['160', 'Arcoíris', 8, 'Salmón con aguacate, cubierto de salmón y aguacate.', ''],
    ['161', 'Rollo especial', 8, 'Salmón con aguacate, cubierto de salmón y queso crema.', 'r'],
    ['162', 'Rollo vegetal', 8, 'Queso crema y aguacate, cubierto de aguacate.', ''],
    ['163', 'Creación del chef', 4, 'Surimi en tempura, aguacate, tartar de salmón, salsa picante, nachos, teriyaki y sésamo.', 'r'],
    ['164', 'Rollo estrella', 8, 'Salmón, aguacate, queso crema, patatas fritas y teriyaki.', ''],
    ['166', 'Rollo mando', 8, 'Atún cocido con aguacate y queso crema, almendra, sésamo y teriyaki.', ''],
    ['167', 'Rollo de mango', 8, 'Salmón, mango, sésamo y salsa de mango.', ''],
    ['168', 'Rollo de ghibli', 8, 'Surimi en tempura con aguacate, tartar de salmón, teriyaki y arroz frito.', ''],
    ['169', 'Rollo de ghibli fresa', 8, 'Surimi en tempura con aguacate, queso crema, fresa, arroz frito y salsa de fresa.', 'r'],
    ['170', 'Suspiro blanco', 4, 'Arroz blanco con tartar de salmón, queso crema, aguacate, kataifi y teriyaki.', ''],
    ['172', 'Ebiten negro', 8, 'Arroz venus con gambas en tempura, tartar de salmón, almendra y spicy mayo.', 'r'],
    ['173', 'Nido', 4, 'Maki frito con tartar de salmón, pasta kataifi y salsa de azafrán.', ''],
    ['174', 'Crazy salmón roll', 8, 'Salmón, aguacate y cebolla crujiente con teriyaki y mayonesa.', 'r'],
    ['175', 'Rollo especial ebi', 8, 'Gambas en tempura, queso crema, aguacate, tartar de salmón, kataifi y teriyaki.', 'r'],
    ['176', 'Suspiro negro', 4, 'Arroz venus, queso crema, tartar de salmón, kataifi y teriyaki.', ''],
    ['177', 'Rollo nuevo ángel', 8, 'Gamba en tempura, cubierto de salmón flameado con queso crema y teriyaki.', ''],
    ['178', 'Rollo negro de salmón', 8, 'Arroz venus con salmón y queso crema, aguacate, kataifi y teriyaki.', 'r'],
    ['179', 'Rollo de trufa especial', 8, 'Surimi en tempura y aguacate, cubierto de salmón y trufa.', 's1'],
  ],
};

function parseFlags(flags) {
  const f = flags.split(' ').filter(Boolean);
  let supl = null;
  for (const x of f) {
    const m = x.match(/^([sx])(\d)$/);
    if (m) supl = { eur: Number(m[2]), from: m[1] === 's' ? 1 : 2 };
  }
  const extra = f.includes('extra') ? 'aparte' : f.includes('noche') ? 'noche' : null;
  return { rec: f.includes('r'), supl, extra, notSushi: f.includes('n'), forceSushi: f.includes('S') };
}

function buildDishes(categories, data, prefix) {
  const dishes = [];
  for (const cat of categories) {
    data[cat.id].forEach(([code, name, pieces, desc, flags], i) => {
      const { rec, supl, extra, notSushi, forceSushi } = parseFlags(flags);
      dishes.push({
        id: prefix + (code ? code.toLowerCase() : `-${cat.id}-${i + 1}`),
        code, name, desc, pieces,
        cat: cat.id,
        sushi: (cat.sushi || forceSushi) && !notSushi,
        rec, supl, note: '',
        ...(extra ? { extra } : {}),
      });
    });
  }
  return dishes;
}

const toCategories = (list) => list.map(([id, name, jp, sushi]) => ({ id, name, jp, sushi }));

export function buildSushiTokyo() {
  const categories = toCategories(CATEGORIES);
  return {
    id: SEED_ID,
    seed: { id: SEED_ID, version: SEED_VERSION },
    name: 'Sushitokyo Príncipe Pío',
    place: 'C.C. Príncipe Pío · Paseo de la Florida, 2, Madrid',
    phone: '910 857 741',
    hours: 'Todos los días 13:00–16:30 y 20:00–00:00',
    notes: 'Menú Infinity (a la carta ilimitado): máximo 4 platos por persona y ronda, sin límite de rondas. 5 € por cada plato que no se consuma. Bebida y postre aparte (mínimo 1 bebida por persona). Al mediodía algunos suplementos cambian.\n\nTarifas (cartel del local): mediodía de lunes a viernes no festivos 17,80 €; cena de lunes a jueves no festivos ni vísperas 23,90 €; fin de semana (viernes noche a domingo, festivos y vísperas) 25,90 €. Niños: menos de 0,95 m gratis, menos de 1,30 m 9,50 €, menos de 1,50 m 13,95 €.',
    maxPerRound: 4,
    prices: [
      { id: 'mediodia', label: 'Mediodía L–V', eur: 17.8, when: 'lunch-weekday' },
      { id: 'noche', label: 'Cena L–J', eur: 23.9, when: 'dinner-weekday' },
      { id: 'finde', label: 'Fin de semana', eur: 25.9, when: 'weekend' },
    ],
    source: 'Carta oficial (to-focus.com), consultada el 20/10/2026',
    categories,
    dishes: buildDishes(categories, DISHES, 'st'),
    createdAt: Date.now(),
  };
}

export function buildSumo() {
  const categories = toCategories(SUMO_CATEGORIES);
  return {
    id: SUMO_ID,
    seed: { id: SUMO_ID, version: 1 },
    ...SUMO_META,
    prices: SUMO_META.prices.map((p) => ({ ...p })),
    categories,
    dishes: buildDishes(categories, SUMO_DISHES, 'sm'),
    createdAt: Date.now(),
  };
}

// Cartas que vienen con la app. Las nuevas se añaden solas a los datos ya guardados.
export const BUILTINS = { [SEED_ID]: buildSushiTokyo, [SUMO_ID]: buildSumo };

export function seedRestaurants() {
  return Object.values(BUILTINS).map((build) => build());
}
