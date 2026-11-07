#!/usr/bin/env node
/**
 * Builds reproducible SQL seeds for the public catalogue from primary sources:
 *
 *  - Generic foods: USDA FoodData Central, SR Legacy (April 2018 release).
 *    Public domain (CC0 1.0). Nutrient values are copied verbatim; names,
 *    categories and Spanish labels come from data/generic-foods/foods.csv.
 *  - Additives: Open Food Facts additives taxonomy (ODbL 1.0), plus curated
 *    editorial overrides in data/additives/overrides.json.
 *
 * Usage: node scripts/seed/build-seed.mjs   (downloads raw data on first run)
 * Output: supabase/seeds/01_generic_foods.sql, supabase/seeds/02_additives.sql
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RAW = join(ROOT, 'data/raw');
const SR_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';
const SR_DIR = 'FoodData_Central_sr_legacy_food_csv_2018-04';
const OFF_ADDITIVES_URL = 'https://static.openfoodfacts.org/data/taxonomies/additives.json';
const USDA_LICENSE = 'CC0 1.0 (public domain) — USDA FoodData Central';
const OFF_LICENSE = 'ODbL-1.0 — Open Food Facts contributors';

/* --------------------------------- utils --------------------------------- */

async function download(url, dest) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'nutrition-platform-seed/1.0' } });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

/** Minimal ZIP reader (central directory + deflate) — avoids external tools. */
function unzipEntries(buffer, wanted) {
  const out = new Map();
  let eocd = buffer.length - 22;
  while (eocd >= 0 && buffer.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) throw new Error('Invalid zip file');
  const count = buffer.readUInt16LE(eocd + 10);
  let ptr = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    const method = buffer.readUInt16LE(ptr + 10);
    const compSize = buffer.readUInt32LE(ptr + 20);
    const nameLen = buffer.readUInt16LE(ptr + 28);
    const extraLen = buffer.readUInt16LE(ptr + 30);
    const commentLen = buffer.readUInt16LE(ptr + 32);
    const localOffset = buffer.readUInt32LE(ptr + 42);
    const name = buffer.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    ptr += 46 + nameLen + extraLen + commentLen;
    const base = name.split('/').pop();
    if (!wanted.includes(base)) continue;
    const lNameLen = buffer.readUInt16LE(localOffset + 26);
    const lExtraLen = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const data = buffer.subarray(start, start + compSize);
    out.set(base, method === 0 ? data : inflateRawSync(data));
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

const sql = (v) => {
  if (v === null || v === undefined || v === '') return 'null';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};
const sqlArray = (arr) => (arr.length ? `array[${arr.map(sql).join(', ')}]::text[]` : `'{}'::text[]`);
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/* ------------------------------ generic foods ----------------------------- */

const NUTRIENTS = {
  1008: 'energy_kcal',
  1003: 'protein_g',
  1005: 'carbs_g',
  2000: 'sugars_g',
  1004: 'fat_g',
  1258: 'saturated_fat_g',
  1079: 'fiber_g',
  1093: 'sodium_mg',
};
const MICROS = {
  1087: 'calcium_mg',
  1089: 'iron_mg',
  1092: 'potassium_mg',
  1162: 'vitamin_c_mg',
  1253: 'cholesterol_mg',
  1257: 'trans_fat_g',
  1292: 'monounsaturated_fat_g',
  1293: 'polyunsaturated_fat_g',
  1051: 'water_g',
  1018: 'alcohol_g',
  1235: 'added_sugars_g',
};

const SIZE_ES = { 'extra large': 'extra grande', jumbo: 'jumbo', large: 'grande', medium: 'mediana', small: 'pequeña', 'extra small': 'muy pequeña' };
const SIZE_ES_M = { 'extra large': 'extra grande', jumbo: 'jumbo', large: 'grande', medium: 'mediano', small: 'pequeño', 'extra small': 'muy pequeño' };
const CUP_QUALIFIERS = {
  sliced: 'en rodajas', slices: 'en rodajas', chopped: 'picado', diced: 'en dados', cubes: 'en cubos', shredded: 'rallado',
  grated: 'rallado', whole: 'entero', halves: 'en mitades', sections: 'en gajos', pieces: 'en trozos', mashed: 'en puré',
  pureed: 'en puré', cooked: 'cocinado', melted: 'fundido', chunks: 'en trozos', crumbled: 'desmenuzado', ground: 'molido',
};

/**
 * Translates a USDA portion modifier into Spanish/English labels.
 * Returns null for portions we do not want to expose (imperial-only, brand-specific…).
 */
function portionLabels(amount, modifier, category) {
  const m = modifier.trim();
  const lower = m.toLowerCase();
  const qty = Number(amount) || 1;
  const n = qty === 1 ? '1' : String(qty).replace('.', ',');
  const en = `${qty} ${m}`;
  if (/^(oz|fl oz|lb|quart|pint|liter|dash|cubic inch)/.test(lower)) return null;
  if (/pepperidge|keebler|grandma|chips ahoy|drink, |container \(|package|bag |box|serving \d|serving packet|yields|refuse|can \(303/.test(lower)) return null;
  if (/^nlea serving/.test(lower)) return { es: `${n} ración de referencia (EE. UU.)`, en, rank: 6 };
  if (/^cup/.test(lower)) {
    const q = Object.keys(CUP_QUALIFIERS).find((k) => lower.includes(k));
    if (/spaghetti|penne|shells|lasagne|rotini|farfalle|elbows|cherry tomatoes|arils|balls|whipped|fluid|curd|eggs\)|nlea/.test(lower)) return null;
    return { es: `${n} taza${qty === 1 ? '' : 's'}${q ? ` (${CUP_QUALIFIERS[q]})` : ''}`, en, rank: 5 };
  }
  if (/^(tbsp|tablespoon)/.test(lower)) return { es: `${n} cucharada${qty === 1 ? '' : 's'}`, en, rank: 3 };
  if (/^tsp/.test(lower)) return { es: `${n} cucharadita${qty === 1 ? '' : 's'}`, en, rank: 4 };
  if (/^slice/.test(lower)) {
    if (/crust|snack|very thin/.test(lower)) return null;
    const noun = ['grains', 'sweets_snacks', 'prepared'].includes(category)
      ? 'rebanada'
      : ['meat', 'dairy', 'fish_seafood'].includes(category)
        ? 'loncha'
        : 'rodaja';
    const size = /thin|small/.test(lower) ? ' fina' : /large|thick/.test(lower) ? ' gruesa' : '';
    return { es: `${n} ${noun}${qty === 1 ? '' : 's'}${size}`, en, rank: 1 };
  }
  const size = Object.keys(SIZE_ES).sort((a, b) => b.length - a.length).find((s) => lower.startsWith(s));
  if (size && /^(extra large|jumbo|large|medium|small|extra small)( \(|$)/.test(lower)) {
    if (category === 'eggs') return { es: `${n} huevo${qty === 1 ? '' : 's'} ${SIZE_ES_M[size]}`, en, rank: 0 };
    return { es: `${n} unidad${qty === 1 ? '' : 'es'} ${SIZE_ES[size]}`, en, rank: 0 };
  }
  const nouns = [
    [/^fillet/, 'filete'],
    [/^breast, bone and skin removed|^breast$/, 'pechuga'],
    [/^thigh without skin/, 'muslo sin piel'],
    [/^(link|hot dog)/, 'salchicha'],
    [/^patty/, 'hamburguesa'],
    [/^fruit( \(|$| without refuse)/, 'pieza'],
    [/^clove$/, 'diente'],
    [/^stalk, medium/, 'tallo mediano'],
    [/^olive$/, 'aceituna'],
    [/^almond$/, 'almendra'],
    [/^cookie$/, 'galleta'],
    [/^muffin$/, 'muffin'],
    [/^croissant, medium/, 'cruasán mediano'],
    [/^donut$/, 'dónut'],
    [/^pancake \(4/, 'tortita (10 cm)'],
    [/^tortilla medium/, 'tortilla mediana (15 cm)'],
    [/^tortilla \(approx 10/, 'tortilla grande (25 cm)'],
    [/^tortilla$/, 'tortilla'],
    [/^scoop/, 'cacito (scoop)'],
    [/^bar \(1 oz\)|^bar$/, 'barrita'],
    [/^(can or bottle \(12 fl oz\)|can \(12 fl oz\))/, 'lata (355 ml)'],
    [/^pat /, 'porción individual'],
    [/^date, pitted/, 'dátil sin hueso'],
    [/^cake$/, 'tortita'],
    [/^sandwich/, 'hamburguesa'],
    [/^leaf, medium|^leaf outer/, 'hoja'],
    [/^head, medium|^head medium/, 'pieza mediana'],
    [/^potato medium|^medium \(approx/, 'unidad mediana'],
    [/^cherry$/, 'cereza'],
    [/^peanut$/, 'cacahuete'],
    [/^kernel$/, 'pipa'],
    [/^anchovy$/, 'anchoa'],
    [/^apricot$/, 'albaricoque'],
    [/^spear, medium/, 'espárrago mediano'],
    [/^artichoke, medium/, 'alcachofa mediana'],
    [/^plum tomato|^medium whole/, 'tomate mediano'],
    [/^leek$/, 'puerro'],
    [/^beet \(/, 'remolacha'],
    [/^pomegranate \(/, 'granada'],
    [/^wedge, medium/, 'tajada mediana'],
  ];
  for (const [rx, noun] of nouns) {
    if (rx.test(lower)) return { es: `${n} ${noun}`, en, rank: 2 };
  }
  return null;
}

/**
 * USDA portions that are accurate for the US reference but misleading for the
 * Spanish label we attach to the food. Excluded explicitly (documented here).
 */
const EXCLUDED_PORTIONS = new Set([
  // "1 slice" of French/Vienna bread = 139 g; a slice of a Spanish "barra" is far smaller.
  'fdc_portion:91076',
]);

/** Standard volume portions for beverages, using density derived from USDA cup / fl oz weights. */
function beveragePortions(slug, densityGPerMl) {
  const ml = (v, es, en) => ({ es, en, grams: round(v * densityGPerMl, 1), rank: -1 });
  const list = [ml(100, '100 ml', '100 ml')];
  if (slug === 'espresso') list.push(ml(30, '1 café espresso (30 ml)', '1 espresso (30 ml)'));
  else if (slug.startsWith('vino')) list.push(ml(150, '1 copa (150 ml)', '1 glass (150 ml)'));
  else if (slug === 'cerveza') list.push(ml(200, '1 caña (200 ml)', '1 small glass (200 ml)'), ml(330, '1 lata (330 ml)', '1 can (330 ml)'));
  else if (slug.startsWith('refresco')) list.push(ml(330, '1 lata (330 ml)', '1 can (330 ml)'));
  else if (slug === 'cafe' || slug === 'te-negro') list.push(ml(200, '1 taza (200 ml)', '1 cup (200 ml)'));
  else list.push(ml(250, '1 vaso (250 ml)', '1 glass (250 ml)'));
  return list;
}

async function buildGenericFoods() {
  const zipPath = join(RAW, 'sr_legacy.zip');
  if (!existsSync(zipPath)) await download(SR_URL, zipPath);
  const files = unzipEntries(readFileSync(zipPath), ['food.csv', 'food_nutrient.csv', 'food_portion.csv']);
  const foods = new Map(parseCsv(files.get('food.csv').toString('utf8')).map((r) => [r.fdc_id, r]));
  const nutrientRows = parseCsv(files.get('food_nutrient.csv').toString('utf8'));
  const portionRows = parseCsv(files.get('food_portion.csv').toString('utf8'));
  const curated = parseCsv(readFileSync(join(ROOT, 'data/generic-foods/foods.csv'), 'utf8'));

  const ids = new Set(curated.map((c) => c.fdc_id));
  const values = new Map();
  for (const r of nutrientRows) {
    if (!ids.has(r.fdc_id)) continue;
    const key = NUTRIENTS[r.nutrient_id] ?? MICROS[r.nutrient_id];
    if (!key || r.amount === '') continue;
    if (!values.has(r.fdc_id)) values.set(r.fdc_id, {});
    values.get(r.fdc_id)[key] = Number(r.amount);
  }
  const portionsByFood = new Map();
  for (const r of portionRows) {
    if (!ids.has(r.fdc_id)) continue;
    if (!portionsByFood.has(r.fdc_id)) portionsByFood.set(r.fdc_id, []);
    portionsByFood.get(r.fdc_id).push(r);
  }

  const lines = [
    '-- Generated by scripts/seed/build-seed.mjs — do not edit by hand.',
    `-- Source: USDA FoodData Central, SR Legacy (2018-04). ${USDA_LICENSE}.`,
    'begin;',
  ];
  const slugs = new Set();
  for (const c of curated) {
    const food = foods.get(c.fdc_id);
    if (!food) throw new Error(`FDC id ${c.fdc_id} (${c.slug}) not found in SR Legacy`);
    if (slugs.has(c.slug)) throw new Error(`Duplicate slug ${c.slug}`);
    slugs.add(c.slug);
    const v = values.get(c.fdc_id) ?? {};
    if (v.energy_kcal == null) throw new Error(`No energy value for ${c.slug}`);
    const micros = Object.fromEntries(Object.values(MICROS).filter((k) => v[k] != null).map((k) => [k, v[k]]));
    const salt = v.sodium_mg != null ? round((v.sodium_mg * 2.5) / 1000, 3) : null;
    const split = (s) => (s ? s.split('|').map((x) => x.trim()).filter(Boolean) : []);
    lines.push(
      `insert into public.generic_foods (slug, name_es, name_en, synonyms_es, synonyms_en, category, basis, energy_kcal, protein_g, carbs_g, sugars_g, fat_g, saturated_fat_g, fiber_g, salt_g, micros, source, source_id, source_url, source_version, license) values (` +
        [
          sql(c.slug), sql(c.name_es), sql(c.name_en), sqlArray(split(c.synonyms_es)), sqlArray(split(c.synonyms_en)),
          sql(c.category), sql('100g'), sql(v.energy_kcal), sql(v.protein_g), sql(v.carbs_g), sql(v.sugars_g), sql(v.fat_g),
          sql(v.saturated_fat_g), sql(v.fiber_g), sql(salt), `${sql(JSON.stringify(micros))}::jsonb`, sql('usda_fdc'),
          sql(c.fdc_id), sql(`https://fdc.nal.usda.gov/food-details/${c.fdc_id}/nutrients`), sql('SR Legacy 2018-04'), sql(USDA_LICENSE),
        ].join(', ') +
        `) on conflict (source, source_id) do update set slug = excluded.slug, name_es = excluded.name_es, name_en = excluded.name_en, synonyms_es = excluded.synonyms_es, synonyms_en = excluded.synonyms_en, category = excluded.category, energy_kcal = excluded.energy_kcal, protein_g = excluded.protein_g, carbs_g = excluded.carbs_g, sugars_g = excluded.sugars_g, fat_g = excluded.fat_g, saturated_fat_g = excluded.saturated_fat_g, fiber_g = excluded.fiber_g, salt_g = excluded.salt_g, micros = excluded.micros, source_url = excluded.source_url, source_version = excluded.source_version, license = excluded.license;`,
    );

    const raw = portionsByFood.get(c.fdc_id) ?? [];
    let portions = [];
    for (const p of raw) {
      const grams = Number(p.gram_weight);
      if (!(grams > 0) || EXCLUDED_PORTIONS.has(`fdc_portion:${p.id}`)) continue;
      const label = portionLabels(p.amount, p.modifier || '', c.category);
      if (label) portions.push({ ...label, grams, ref: `fdc_portion:${p.id}` });
    }
    if (c.category === 'beverages') {
      const cup = raw.find((p) => /^cup/.test(p.modifier) && Number(p.amount) === 1);
      const floz = raw.find((p) => /^fl oz/.test(p.modifier) && Number(p.amount) === 1);
      const density = cup ? Number(cup.gram_weight) / 236.588 : floz ? Number(floz.gram_weight) / 29.5735 : null;
      portions = portions.filter((p) => !/taza|cup/.test(p.es));
      if (density && density > 0.8 && density < 1.3) {
        portions.push(...beveragePortions(c.slug, density).map((p) => ({ ...p, ref: `derived_density:${round(density, 4)}` })));
      }
    }
    const seen = new Set();
    portions = portions
      .sort((a, b) => a.rank - b.rank || a.grams - b.grams)
      .filter((p) => (seen.has(p.es) ? false : (seen.add(p.es), true)))
      .slice(0, 4);
    lines.push(`delete from public.generic_food_portions where food_id = (select id from public.generic_foods where source = 'usda_fdc' and source_id = ${sql(c.fdc_id)});`);
    portions.forEach((p, idx) => {
      lines.push(
        `insert into public.generic_food_portions (food_id, position, label_es, label_en, grams, source_ref) select id, ${idx}, ${sql(p.es)}, ${sql(p.en)}, ${sql(round(p.grams, 2))}, ${sql(p.ref)} from public.generic_foods where source = 'usda_fdc' and source_id = ${sql(c.fdc_id)};`,
      );
    });
  }
  lines.push('commit;', '');
  return { sql: lines.join('\n'), count: curated.length };
}

/* -------------------------------- additives ------------------------------- */

function normalizeCode(key) {
  const m = /^en:e(\d{3,4}[a-z]*)$/.exec(key);
  return m ? `e${m[1]}` : null;
}

function stripName(name, code) {
  if (!name) return null;
  return name.replace(new RegExp(`^E\\s?${code.slice(1)}\\s*[-–]\\s*`, 'i'), '').trim() || null;
}

function doiFromUrl(url) {
  const m = /10\.\d{4,9}\/[^\s]+/.exec(url ?? '');
  return m ? m[0] : null;
}

async function buildAdditives() {
  const path = join(RAW, 'off-additives.json');
  if (!existsSync(path)) await download(OFF_ADDITIVES_URL, path);
  const taxonomy = JSON.parse(readFileSync(path, 'utf8'));
  const overrides = JSON.parse(readFileSync(join(ROOT, 'data/additives/overrides.json'), 'utf8'));
  const lines = [
    '-- Generated by scripts/seed/build-seed.mjs — do not edit by hand.',
    `-- Source: Open Food Facts additives taxonomy (${OFF_LICENSE}); curated overrides in data/additives/overrides.json.`,
    'begin;',
  ];
  let count = 0;
  const classesOk = new Set([
    'acid', 'acidity-regulator', 'anti-caking-agent', 'anti-foaming-agent', 'antioxidant', 'bulking-agent', 'carrier',
    'coagulant', 'colour', 'emulsifier', 'firming-agent', 'flavour-enhancer', 'flour-treatment-agent', 'foaming-agent',
    'gelling-agent', 'glazing-agent', 'humectant', 'modified-starch', 'packaging-gas', 'preservative', 'propellent-gas',
    'raising-agent', 'sequestrant', 'stabiliser', 'sweetener', 'thickener',
  ]);
  const sources = [];
  for (const [key, entry] of Object.entries(taxonomy).sort(([a], [b]) => a.localeCompare(b))) {
    const code = normalizeCode(key);
    if (!code || !entry.e_number) continue;
    const eNumber = `E${code.slice(1)}`;
    const classes = (entry.additives_classes?.en ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^en:/, ''))
      .filter((s) => classesOk.has(s));
    const parent = (entry.parents ?? []).map(normalizeCode).find(Boolean) ?? null;
    const adi = entry.efsa_evaluation_adi?.en != null ? Number(entry.efsa_evaluation_adi.en) : null;
    const groups = (entry.efsa_evaluation_exposure_95th_greater_than_adi?.en ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^en:/, ''))
      .filter(Boolean);
    const triState = (v) => (['yes', 'no', 'maybe'].includes(v) ? v : null);
    const evalUrl = entry.efsa_evaluation_url?.en ?? null;
    const doi = doiFromUrl(evalUrl);
    const normalizedUrl = doi ? `https://doi.org/${doi}` : evalUrl;
    const ov = overrides[code] ?? {};
    lines.push(
      `insert into public.additives (code, e_number, name_es, name_en, classes, parent_code, efsa_evaluation_title, efsa_evaluation_url, efsa_evaluation_date, efsa_adi_mg_per_kg, efsa_exposure_above_adi_groups, vegan, vegetarian, wikidata_id, editorial_note_es, editorial_note_en, review_status, source, license) values (` +
        [
          sql(code), sql(eNumber), sql(stripName(entry.name?.es, code)), sql(stripName(entry.name?.en, code)), sqlArray(classes),
          sql(parent), sql(entry.efsa_evaluation?.en ?? null), sql(normalizedUrl), sql(entry.efsa_evaluation_date?.en ?? null),
          sql(Number.isFinite(adi) ? adi : null), sqlArray(groups), sql(triState(entry.vegan?.en)), sql(triState(entry.vegetarian?.en)),
          sql(entry.wikidata?.en ?? null), sql(ov.note_es ?? null), sql(ov.note_en ?? null), sql('not_reviewed'),
          sql('open_food_facts'), sql(OFF_LICENSE),
        ].join(', ') +
        `) on conflict (code) do update set e_number = excluded.e_number, name_es = excluded.name_es, name_en = excluded.name_en, classes = excluded.classes, parent_code = excluded.parent_code, efsa_evaluation_title = excluded.efsa_evaluation_title, efsa_evaluation_url = excluded.efsa_evaluation_url, efsa_evaluation_date = excluded.efsa_evaluation_date, efsa_adi_mg_per_kg = excluded.efsa_adi_mg_per_kg, efsa_exposure_above_adi_groups = excluded.efsa_exposure_above_adi_groups, vegan = excluded.vegan, vegetarian = excluded.vegetarian, wikidata_id = excluded.wikidata_id, editorial_note_es = excluded.editorial_note_es, editorial_note_en = excluded.editorial_note_en, license = excluded.license;`,
    );
    count += 1;
    if (normalizedUrl) {
      sources.push({
        code, kind: 'regulatory_evaluation', relation: 'evaluation', title: entry.efsa_evaluation?.en ?? `EFSA evaluation of ${eNumber}`,
        publisher: 'EFSA (European Food Safety Authority)', url: normalizedUrl, doi, published_on: entry.efsa_evaluation_date?.en ?? null,
      });
    }
    for (const s of ov.sources ?? []) sources.push({ code, ...s });
  }
  for (const s of sources) {
    lines.push(
      `insert into public.scientific_sources (kind, title, publisher, url, doi, published_on) values (${[s.kind, s.title, s.publisher, s.url, s.doi ?? null, s.published_on ?? null].map(sql).join(', ')}) on conflict (url) do update set title = excluded.title, publisher = excluded.publisher, doi = excluded.doi, published_on = excluded.published_on, kind = excluded.kind;`,
      `insert into public.additive_sources (additive_code, source_id, relation) select ${sql(s.code)}, id, ${sql(s.relation)} from public.scientific_sources where url = ${sql(s.url)} on conflict do nothing;`,
    );
  }
  lines.push('commit;', '');
  return { sql: lines.join('\n'), count, sources: sources.length };
}

/* ---------------------------------- main ---------------------------------- */

const outDir = join(ROOT, 'supabase/seeds');
mkdirSync(outDir, { recursive: true });
const foods = await buildGenericFoods();
writeFileSync(join(outDir, '01_generic_foods.sql'), foods.sql);
const additives = await buildAdditives();
writeFileSync(join(outDir, '02_additives.sql'), additives.sql);
console.log(`Wrote ${foods.count} generic foods and ${additives.count} additives (${additives.sources} source links).`);
void createWriteStream;
