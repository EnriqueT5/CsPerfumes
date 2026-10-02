const crypto = require('crypto');
const { header } = require('./http');

const COOKIE_NAME = 'cs_admin_session';
const DEFAULT_SESSION_SECONDS = 60 * 60 * 12;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('SESSION_SECRET debe existir y tener al menos 32 caracteres.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return secret;
}

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.ADMIN_SESSION_SECONDS || DEFAULT_SESSION_SECONDS);
  const payload = base64urlJson({
    iat: now,
    exp: now + Math.max(900, Math.min(ttl, 60 * 60 * 24 * 7)),
    nonce: crypto.randomBytes(12).toString('hex')
  });
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(decoded.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function parseCookies(event) {
  const raw = header(event, 'cookie') || '';
  return raw.split(';').reduce((acc, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return acc;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function isAdmin(event) {
  return verifySessionToken(parseCookies(event)[COOKIE_NAME]);
}

function isLocalDev() {
  return process.env.CONTEXT === 'dev' || process.env.NETLIFY_DEV === 'true';
}

function sessionCookie(token) {
  const ttl = Number(process.env.ADMIN_SESSION_SECONDS || DEFAULT_SESSION_SECONDS);
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isLocalDev() ? null : 'Secure',
    `Max-Age=${Math.max(900, Math.min(ttl, 60 * 60 * 24 * 7))}`
  ].filter(Boolean).join('; ');
}

function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isLocalDev() ? null : 'Secure',
    'Max-Age=0'
  ].filter(Boolean).join('; ');
}

function validAdminPassword(candidate) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    const error = new Error('ADMIN_PASSWORD no está configurada.');
    error.code = 'CONFIG_MISSING';
    throw error;
  }
  return safeEqual(candidate || '', expected);
}

module.exports = { createSessionToken, isAdmin, sessionCookie, clearSessionCookie, validAdminPassword };
