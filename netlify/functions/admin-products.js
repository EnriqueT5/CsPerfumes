const { getSupabaseAdmin, getStorageBucket } = require('../lib/supabase');
const { json, parseJsonBody, requireSameOrigin } = require('../lib/http');
const { isAdmin } = require('../lib/auth');
const { normalizeProductInput, resolveImageUrl } = require('../lib/products');

async function removeManagedImage(supabase, imagePath) {
  if (!imagePath) return;
  const { error } = await supabase.storage.from(getStorageBucket()).remove([imagePath]);
  if (error) console.warn('No se pudo borrar imagen anterior:', error.message);
}

async function ensureCategoryExists(supabase, category) {
  if (!category) return;
  const { data, error } = await supabase
    .from('catalog_categories')
    .select('slug')
    .eq('slug', category)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const e = new Error('La categoría seleccionada no existe. Actualiza las listas e inténtalo de nuevo.');
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
}

exports.handler = async (event) => {
  const method = event.httpMethod;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
    return json(405, { error: 'Método no permitido.' }, { Allow: 'GET, POST, PUT, DELETE' });
  }

  try {
    if (!isAdmin(event)) return json(401, { error: 'Sesión administrativa requerida.' });
    if (method !== 'GET' && !requireSameOrigin(event)) return json(403, { error: 'Origen no permitido.' });

    const supabase = getSupabaseAdmin();

    if (method === 'GET') {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return json(200, { products: (data || []).map(row => ({ ...row, image_url: resolveImageUrl(row.image_url) })) });
    }

    const body = parseJsonBody(event);

    if (method === 'POST') {
      const product = normalizeProductInput(body);
      await ensureCategoryExists(supabase, product.category);

      if (product.featured) {
        const { error: clearError } = await supabase
          .from('products')
          .update({ featured: false })
          .eq('category', product.category)
          .eq('featured', true);
        if (clearError) throw clearError;
      }

      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select('*')
        .single();
      if (error) throw error;
      return json(201, { product: { ...data, image_url: resolveImageUrl(data.image_url) } });
    }

    const id = String(body.id || '').trim();
    if (!id) return json(400, { error: 'Falta el id del producto.' });

    const { data: existing, error: existingError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (existingError || !existing) return json(404, { error: 'Producto no encontrado.' });

    if (method === 'PUT') {
      const updates = normalizeProductInput(body, { partial: true });
      delete updates.id;
      const targetCategory = updates.category || existing.category;
      if (updates.category !== undefined) await ensureCategoryExists(supabase, targetCategory);

      if (updates.featured === true) {
        const { error: clearError } = await supabase
          .from('products')
          .update({ featured: false })
          .eq('category', targetCategory)
          .eq('featured', true)
          .neq('id', id);
        if (clearError) throw clearError;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      // Solo se borra Storage cuando la imagen anterior fue administrada por Supabase.
      // Las imágenes históricas de GitHub tienen image_path = null y se conservan intactas.
      if (updates.image_path !== undefined && existing.image_path && existing.image_path !== updates.image_path) {
        await removeManagedImage(supabase, existing.image_path);
      }

      return json(200, { product: { ...data, image_url: resolveImageUrl(data.image_url) } });
    }

    if (method === 'DELETE') {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      await removeManagedImage(supabase, existing.image_path);
      return json(200, { ok: true });
    }
  } catch (error) {
    console.error('admin-products:', error);
    if (error.code === 'VALIDATION_ERROR' || error.code === 'INVALID_JSON') return json(400, { error: error.message });
    if (error.code === '23503') return json(400, { error: 'La categoría indicada no existe.' });
    if (error.code === '23505') return json(409, { error: 'Ya existe un producto con ese slug o ya hay un destacado en esa categoría.' });
    if (error.code === 'CONFIG_MISSING') return json(503, { error: error.message });
    return json(500, { error: error.message || 'Error al procesar el producto.' });
  }
};
