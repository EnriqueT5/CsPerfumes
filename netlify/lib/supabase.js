const { createClient } = require('@supabase/supabase-js');

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const error = new Error('Faltan SUPABASE_URL y/o SUPABASE_SECRET_KEY en Netlify.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

function getStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET || 'product-images';
}

module.exports = { getSupabaseAdmin, getStorageBucket };
