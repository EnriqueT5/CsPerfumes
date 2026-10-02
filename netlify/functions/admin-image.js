const crypto = require('crypto');
const { getSupabaseAdmin, getStorageBucket } = require('../lib/supabase');
const { json, parseJsonBody, requireSameOrigin } = require('../lib/http');
const { isAdmin } = require('../lib/auth');

const ALLOWED_TYPES = new Map([['image/webp','webp'],['image/jpeg','jpg'],['image/png','png']]);
const MAX_BYTES = 2 * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' }, { Allow: 'POST' });
  try {
    if (!isAdmin(event)) return json(401, { error: 'Sesión administrativa requerida.' });
    if (!requireSameOrigin(event)) return json(403, { error: 'Origen no permitido.' });
    const { data, contentType } = parseJsonBody(event);
    const extension = ALLOWED_TYPES.get(contentType);
    if (!extension) return json(400, { error: 'Formato de imagen no permitido.' });
    if (!data || typeof data !== 'string') return json(400, { error: 'No se recibió la imagen.' });
    const buffer = Buffer.from(data, 'base64');
    if (!buffer.length) return json(400, { error: 'La imagen está vacía.' });
    if (buffer.length > MAX_BYTES) return json(413, { error: 'La imagen supera 2 MB después de optimizarse.' });
    const path = `products/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    const supabase = getSupabaseAdmin();
    const bucket = getStorageBucket();
    const { error } = await supabase.storage.from(bucket).upload(path, buffer, { contentType, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    return json(201, { url: publicData.publicUrl, path });
  } catch (error) {
    if (error.code === 'INVALID_JSON') return json(400, { error: error.message });
    if (error.code === 'CONFIG_MISSING') return json(503, { error: error.message });
    return json(500, { error: error.message || 'No se pudo subir la imagen.' });
  }
};
