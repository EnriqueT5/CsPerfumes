const { getSupabaseAdmin } = require('../lib/supabase');
const { json } = require('../lib/http');
const { toPublicProduct } = require('../lib/products');
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' }, { Allow: 'GET' });
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('products')
      .select('id,slug,brand,name,type,category,gender,image_url,status,featured,sort_order')
      .neq('status','hidden').order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if (error) throw error;
    return json(200,{products:(data||[]).map(toPublicProduct)},{'Cache-Control':'public, max-age=0, must-revalidate'});
  } catch (error) {
    const status = error.code === 'CONFIG_MISSING' ? 503 : 500;
    return json(status,{error:status===503?error.message:'No se pudo cargar el catálogo.'});
  }
};
