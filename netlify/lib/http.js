function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

function parseJsonBody(event) {
  try {
    if (!event.body) return {};
    return JSON.parse(event.body);
  } catch {
    const error = new Error('JSON inválido.');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

function header(event, name) {
  const headers = event.headers || {};
  return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
}

function requireSameOrigin(event) {
  const origin = header(event, 'origin');
  const host = header(event, 'host');
  if (!origin) return true;
  if (!host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

module.exports = { json, parseJsonBody, header, requireSameOrigin };
