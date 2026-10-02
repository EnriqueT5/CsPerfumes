const { json } = require('../lib/http');
const { isAdmin } = require('../lib/auth');
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Método no permitido.' }, { Allow: 'GET' });
  try { return json(200, { authenticated: isAdmin(event) }); }
  catch (error) { return json(error.code === 'CONFIG_MISSING' ? 503 : 500, { error: error.message }); }
};
