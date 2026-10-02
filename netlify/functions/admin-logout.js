const { json, requireSameOrigin } = require('../lib/http');
const { clearSessionCookie } = require('../lib/auth');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' }, { Allow: 'POST' });
  if (!requireSameOrigin(event)) return json(403, { error: 'Origen no permitido.' });
  return json(200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
};
