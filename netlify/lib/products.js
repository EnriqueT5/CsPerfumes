const VALID_GENDERS = new Set(['hombre', 'mujer', 'unisex']);
const VALID_STATUSES = new Set(['available', 'sold_out', 'hidden']);
const CATEGORY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' y ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function cleanText(value, max = 160) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeProductInput(raw = {}, { partial = false } = {}) {
  const data = {};

  const assignText = (key, max, required = false) => {
    if (raw[key] !== undefined) {
      data[key] = cleanText(raw[key], max);
    } else if (!partial && required) {
      data[key] = '';
    }
  };

  assignText('brand', 120, true);
  assignText('name', 160, true);
  assignText('type', 120, true);
  assignText('image_url', 1200, true);
  assignText('image_path', 500, false);

  if (raw.category !== undefined || !partial) data.category = cleanText(raw.category, 80);
  if (raw.gender !== undefined || !partial) data.gender = cleanText(raw.gender, 40);
  if (raw.status !== undefined || !partial) data.status = cleanText(raw.status || 'available', 40);

  if (raw.slug !== undefined || !partial) {
    const supplied = cleanText(raw.slug, 100);
    data.slug = slugify(supplied || `${raw.brand || ''}-${raw.name || ''}`);
  }

  if (raw.featured !== undefined || !partial) data.featured = Boolean(raw.featured);
  if (raw.sort_order !== undefined || !partial) {
    const parsed = Number(raw.sort_order);
    data.sort_order = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  const errors = [];
  if (!partial || data.brand !== undefined) if (!data.brand) errors.push('Marca requerida.');
  if (!partial || data.name !== undefined) if (!data.name) errors.push('Nombre requerido.');
  if (!partial || data.type !== undefined) if (!data.type) errors.push('Tipo/concentración requerida.');
  if (!partial || data.image_url !== undefined) if (!data.image_url) errors.push('Imagen requerida.');
  if (!partial || data.slug !== undefined) if (!data.slug) errors.push('No se pudo generar un slug válido.');
  if (!partial || data.category !== undefined) {
    if (!data.category || !CATEGORY_RE.test(data.category)) errors.push('Categoría inválida.');
  }
  if (!partial || data.gender !== undefined) if (!VALID_GENDERS.has(data.gender)) errors.push('Género inválido.');
  if (!partial || data.status !== undefined) if (!VALID_STATUSES.has(data.status)) errors.push('Estado inválido.');

  if (errors.length) {
    const error = new Error(errors.join(' '));
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (data.image_path === '') data.image_path = null;
  return data;
}

const LEGACY_ASSET_BASE = process.env.LEGACY_ASSET_BASE || 'https://raw.githubusercontent.com/EnriqueT5/CsPerfumes/ef9da1288d6f14851cf1a9a6b4303c280394de90/site';

function resolveImageUrl(value = '') {
  const image = String(value || '').trim();
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || image.startsWith('data:')) return image;
  const clean = image.replace(/^\.\//, '').replace(/^\//, '');
  if (clean.startsWith('assets/')) return `${LEGACY_ASSET_BASE}/${clean}`;
  return image;
}

function toPublicProduct(row) {
  const genderCategories = row.gender === 'unisex' ? ['hombre', 'mujer'] : [row.gender];
  return {
    id: row.slug,
    dbId: row.id,
    brand: row.brand,
    name: row.name,
    type: row.type,
    image: resolveImageUrl(row.image_url),
    categories: [row.category, ...genderCategories],
    category: row.category,
    gender: row.gender,
    status: row.status,
    featured: Boolean(row.featured),
    sortOrder: row.sort_order
  };
}

module.exports = { normalizeProductInput, toPublicProduct, slugify, resolveImageUrl };
