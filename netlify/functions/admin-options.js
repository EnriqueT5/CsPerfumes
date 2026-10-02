const { getSupabaseAdmin } = require('../lib/supabase');
const { json, parseJsonBody, requireSameOrigin } = require('../lib/http');
const { isAdmin } = require('../lib/auth');
const { slugify } = require('../lib/products');

const DEFAULT_TYPES = [
  'Eau de Toilette', 'Eau de Parfum', 'Parfum', 'Extrait de Parfum',
  'Elixir', 'Cologne', 'Body Mist', 'Colección', 'Varios modelos',
  'Luxury Collection · Eau de Parfum', 'Otro'
];

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const unique = values => [...new Map(values.filter(Boolean).map(v => [v.toLocaleLowerCase('es'), v])).values()]
  .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

function normalizeCategory(item = {}, index = 0) {
  const label = clean(item.label || item.name, 80);
  const value = clean(item.value || item.slug || slugify(label), 80);
  const order = Number.isInteger(Number(item.order)) ? Number(item.order) : (index + 1) * 10;
  if (!label || !value || value !== slugify(value)) return null;
  return { slug: value, label, sort_order: order };
}

async function loadOptions(supabase) {
  const [{ data: categories, error: categoriesError }, { data: brands, error: brandsError }, { data: types, error: typesError }, { data: products, error: productsError }] = await Promise.all([
    supabase.from('catalog_categories').select('slug,label,sort_order').order('sort_order', { ascending: true }).order('label', { ascending: true }),
    supabase.from('catalog_brands').select('name,sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('catalog_types').select('name,sort_order').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('products').select('brand,type')
  ]);
  if (categoriesError) throw categoriesError;
  if (brandsError) throw brandsError;
  if (typesError) throw typesError;
  if (productsError) throw productsError;

  return {
    categories: (categories || []).map(row => ({ value: row.slug, label: row.label, order: row.sort_order })),
    brands: unique([...(brands || []).map(row => row.name), ...(products || []).map(row => row.brand)]),
    types: unique([...DEFAULT_TYPES, ...(types || []).map(row => row.name), ...(products || []).map(row => row.type)])
  };
}

async function syncOptions(supabase, options = {}) {
  const categories = (Array.isArray(options.categories) ? options.categories : [])
    .map(normalizeCategory)
    .filter(Boolean);
  const brands = unique((Array.isArray(options.brands) ? options.brands : []).map(value => clean(value, 120)));
  const types = unique((Array.isArray(options.types) ? options.types : []).map(value => clean(value, 120)));

  if (categories.length) {
    const { error } = await supabase.from('catalog_categories').upsert(categories, { onConflict: 'slug' });
    if (error) throw error;
  }
  if (brands.length) {
    const rows = brands.map((name, index) => ({ name, sort_order: index + 1 }));
    const { error } = await supabase.from('catalog_brands').upsert(rows, { onConflict: 'name' });
    if (error) throw error;
  }
  if (types.length) {
    const rows = types.map((name, index) => ({ name, sort_order: index + 1 }));
    const { error } = await supabase.from('catalog_types').upsert(rows, { onConflict: 'name' });
    if (error) throw error;
  }
}

async function deleteOption(supabase, kind, value) {
  const cleanValue = clean(value, 120);
  if (!cleanValue) throw Object.assign(new Error('Falta la opción a eliminar.'), { code: 'VALIDATION_ERROR' });

  const config = {
    categories: { table: 'catalog_categories', key: 'slug', productKey: 'category' },
    brands: { table: 'catalog_brands', key: 'name', productKey: 'brand' },
    types: { table: 'catalog_types', key: 'name', productKey: 'type' }
  }[kind];
  if (!config) throw Object.assign(new Error('Tipo de lista inválido.'), { code: 'VALIDATION_ERROR' });

  const { count, error: countError } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq(config.productKey, cleanValue);
  if (countError) throw countError;
  if ((count || 0) > 0) {
    const e = new Error(`No se puede eliminar: ${count} producto${count === 1 ? '' : 's'} usa${count === 1 ? '' : 'n'} esta opción.`);
    e.code = 'IN_USE';
    throw e;
  }

  const { error } = await supabase.from(config.table).delete().eq(config.key, cleanValue);
  if (error) throw error;
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (!['GET', 'PUT', 'DELETE'].includes(method)) {
    return json(405, { error: 'Método no permitido.' }, { Allow: 'GET, PUT, DELETE' });
  }

  try {
    if (!isAdmin(event)) return json(401, { error: 'Sesión administrativa requerida.' });
    if (method !== 'GET' && !requireSameOrigin(event)) return json(403, { error: 'Origen no permitido.' });

    const supabase = getSupabaseAdmin();
    if (method === 'GET') return json(200, { options: await loadOptions(supabase) });

    const body = parseJsonBody(event);
    if (method === 'PUT') {
      await syncOptions(supabase, body.options || body);
      return json(200, { ok: true, options: await loadOptions(supabase) });
    }

    await deleteOption(supabase, clean(body.kind, 40), body.value);
    return json(200, { ok: true, options: await loadOptions(supabase) });
  } catch (error) {
    console.error('admin-options:', error);
    if (['VALIDATION_ERROR', 'INVALID_JSON'].includes(error.code)) return json(400, { error: error.message });
    if (error.code === 'IN_USE') return json(409, { error: error.message });
    if (error.code === '23503') return json(409, { error: 'La opción está siendo utilizada por el catálogo.' });
    if (error.code === 'CONFIG_MISSING') return json(503, { error: error.message });
    return json(500, { error: error.message || 'No se pudieron actualizar las listas.' });
  }
};
