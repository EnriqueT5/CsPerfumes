const { getSupabaseAdmin } = require('../lib/supabase');
const { json } = require('../lib/http');

const FALLBACK = [
  { id: 'disenador', nav: 'Diseñador', eyebrow: 'Casas de diseñador', title: 'Perfumes de diseñador', line: 'Firmas icónicas, composiciones reconocibles y presencia elegante.', word: 'DESIGNER', theme: 'noir', description: 'Una selección de firmas internacionales con acceso rápido al resto de la categoría.', sortOrder: 10 },
  { id: 'arabes', nav: 'Árabe', eyebrow: 'Perfumería árabe', title: 'Perfumes árabes', line: 'Oud, ámbar, especias y composiciones con mucha presencia.', word: 'OUD', theme: 'gold', description: 'Fragancias intensas y distintivas organizadas dentro de su propia colección.', sortOrder: 20 },
  { id: 'americanos', nav: 'Americanos', eyebrow: 'Colección Americanos', title: 'Catálogo Americanos', line: 'Una selección importada con perfiles frescos, elegantes y reconocibles.', word: 'AMERICAN', theme: 'noir-soft', description: 'Una colección independiente con filtros para hombre y mujer.', sortOrder: 30 }
];
const THEMES = ['noir', 'gold', 'noir-soft', 'rose'];

function toPublicCategory(row, index) {
  const label = row.label;
  return {
    id: row.slug,
    nav: label,
    eyebrow: row.eyebrow || `Colección ${label}`,
    title: row.title || label,
    line: row.line || `Descubre la selección disponible de ${label}.`,
    description: row.description || `Explora las fragancias disponibles dentro de ${label}. El contenido se actualiza automáticamente desde el catálogo.`,
    word: row.word || label.toUpperCase(),
    theme: THEMES.includes(row.theme) ? row.theme : THEMES[index % THEMES.length],
    coverImage: row.cover_image_url || '',
    sortOrder: Number(row.sort_order || 0)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' }, { Allow: 'GET' });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('catalog_categories')
      .select('slug,label,eyebrow,title,line,description,word,theme,cover_image_url,sort_order,visible')
      .eq('visible', true)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });
    if (error) throw error;

    const categories = (data || []).map(toPublicCategory);
    return json(200, { categories: categories.length ? categories : FALLBACK }, {
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
  } catch (error) {
    console.error('catalog-meta:', error);
    // El sitio nunca debe caerse por metadatos: usa las 3 categorías históricas de respaldo.
    return json(200, { categories: FALLBACK, fallback: true }, {
      'Cache-Control': 'public, max-age=0, must-revalidate'
    });
  }
};
