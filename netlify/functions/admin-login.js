const { json, parseJsonBody, requireSameOrigin } = require('../lib/http');
const { createSessionToken, sessionCookie, validAdminPassword } = require('../lib/auth');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido.' }, { Allow: 'POST' });
  if (!requireSameOrigin(event)) return json(403, { error: 'Origen no permitido.' });
  try {
    const { password } = parseJsonBody(event);
    if (!validAdminPassword(password)) {
      await wait(450);
      return json(401, { error: 'Contraseña incorrecta.' });
    }
    return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(createSessionToken()) });
  } catch (error) {
    const status = error.code === 'CONFIG_MISSING' ? 503 : error.code === 'INVALID_JSON' ? 400 : 500;
    return json(status, { error: error.message || 'No se pudo iniciar sesión.' });
  }
};
