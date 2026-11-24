'use strict';

const crypto = require('node:crypto');
const { hashPassword, verifyPassword } = require('./auth');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const ALLOWED_ORDERS_TABLES = new Set(['orders', 'coffee_orders']);

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  });
  return out;
}

function buildClientCookie(cookieName, token, clear = false, isSecure = false) {
  const sec = isSecure ? '; Secure' : '';
  if (clear) {
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${sec}`;
  }
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${sec}`;
}

function parseMeta(raw) {
  try {
    const obj = JSON.parse(raw || '{}');
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    meta: parseMeta(row.meta_json)
  };
}

function createClientSession(db, clientId) {
  db.prepare('DELETE FROM client_sessions WHERE expires_at < ?').run(Date.now());
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare('INSERT INTO client_sessions (token, client_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    clientId,
    expiresAt
  );
  return token;
}

function getSessionClient(db, req, cookieName) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[cookieName];
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT c.id, c.name, c.email, c.phone, c.meta_json, s.expires_at
       FROM client_sessions s
       JOIN client_users c ON c.id = s.client_id
       WHERE s.token = ?`
    )
    .get(token);

  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM client_sessions WHERE token = ?').run(token);
    return null;
  }
  return { ...mapClientRow(row), token };
}

function mapOrderRow(table, row) {
  let items = [];
  try {
    items = JSON.parse(row.items_json || '[]');
  } catch {
    items = [];
  }
  if (table === 'coffee_orders') {
    return {
      id: row.id,
      code: row.code,
      items,
      subtotal: row.subtotal,
      bonusUsed: row.bonus_used,
      total: row.total,
      bar: row.bar,
      readyIn: row.ready_in,
      clientName: row.client_name,
      status: row.status,
      createdAt: row.created_at
    };
  }
  return {
    id: row.id,
    code: row.code,
    items,
    subtotal: row.subtotal,
    discount: row.discount,
    deliveryFee: row.delivery_fee,
    total: row.total,
    promoCode: row.promo_code || '',
    deliveryMethod: row.delivery_method,
    city: row.city,
    address: row.address || '',
    clientName: row.client_name,
    status: row.status,
    createdAt: row.created_at
  };
}

function initClientAccount(db, config) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      meta_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_sessions (
      token TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (client_id) REFERENCES client_users(id) ON DELETE CASCADE
    );
  `);

  if (config?.seed?.email) {
    const email = String(config.seed.email).trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM client_users WHERE email = ?').get(email);
    if (!existing) {
      db.prepare(
        'INSERT INTO client_users (name, email, phone, password_hash, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        String(config.seed.name || 'Клиент').trim(),
        email,
        String(config.seed.phone || '').trim(),
        hashPassword(String(config.seed.password || 'client12345')),
        JSON.stringify(config.seed.meta || {}),
        new Date().toISOString()
      );
    }
  }
}

async function handleClientApi(req, res, parsed, db, config, helpers) {
  const { sendJson, readJson, loginLimiter, isSecure } = helpers;
  const method = req.method;
  const pathname = parsed.pathname;
  const cookieName = `${config.prefix}_client_sid`;
  const client = getSessionClient(db, req, cookieName);

  if (method === 'GET' && pathname === '/api/client/me') {
    const safeClient = client
      ? { id: client.id, name: client.name, email: client.email, phone: client.phone, meta: client.meta }
      : null;
    return sendJson(res, 200, { ok: true, client: safeClient });
  }

  if (method === 'POST' && pathname === '/api/client/login') {
    const rate = loginLimiter(req);
    if (!rate.allowed) {
      return sendJson(
        res,
        429,
        { ok: false, error: 'Слишком много попыток входа. Подождите несколько минут.' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
    }
    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const password = String(body.password || '');
    const row = db.prepare('SELECT * FROM client_users WHERE email = ?').get(email);
    if (!row || !verifyPassword(password, row.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }
    const token = createClientSession(db, row.id);
    const safeClient = mapClientRow(row);
    return sendJson(
      res,
      200,
      { ok: true, client: safeClient },
      { 'Set-Cookie': buildClientCookie(cookieName, token, false, isSecure) }
    );
  }

  if (method === 'POST' && pathname === '/api/client/register') {
    const rate = loginLimiter(req);
    if (!rate.allowed) {
      return sendJson(
        res,
        429,
        { ok: false, error: 'Слишком много попыток регистрации. Подождите несколько минут.' },
        { 'Retry-After': String(rate.retryAfterSec) }
      );
    }
    const body = await readJson(req);
    if (String(body.website || '').trim() !== '') {
      return sendJson(res, 200, { ok: true, client: null });
    }
    if (!body.consent) {
      return sendJson(res, 400, { ok: false, error: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }
    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
    const phone = String(body.phone || '').trim().slice(0, 32);
    const password = String(body.password || '');
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 6) {
      return sendJson(res, 400, { ok: false, error: 'Укажите имя (от 2 символов), корректный email и пароль (от 6 символов).' });
    }
    const existing = db.prepare('SELECT id FROM client_users WHERE email = ?').get(email);
    if (existing) {
      return sendJson(res, 409, { ok: false, error: 'Аккаунт с таким email уже зарегистрирован.' });
    }
    const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : {};
    const info = db
      .prepare('INSERT INTO client_users (name, email, phone, password_hash, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, email, phone, hashPassword(password), JSON.stringify(meta), new Date().toISOString());
    const row = db.prepare('SELECT * FROM client_users WHERE id = ?').get(info.lastInsertRowid);
    const token = createClientSession(db, row.id);
    return sendJson(
      res,
      201,
      { ok: true, client: mapClientRow(row) },
      { 'Set-Cookie': buildClientCookie(cookieName, token, false, isSecure) }
    );
  }

  if (method === 'PUT' && pathname === '/api/client/profile') {
    if (!client) {
      return sendJson(res, 401, { ok: false, error: 'Требуется вход в личный кабинет' });
    }
    const body = await readJson(req);
    const nextName = String(body.name !== undefined ? body.name : client.name).trim().slice(0, 100);
    if (nextName.length < 2) {
      return sendJson(res, 400, { ok: false, error: 'Имя должно содержать минимум 2 символа' });
    }
    const nextPhone =
      body.phone !== undefined ? String(body.phone || '').trim().slice(0, 32) : client.phone;
    const patchMeta =
      body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : {};
    const nextMeta = { ...client.meta, ...patchMeta };

    db.prepare('UPDATE client_users SET name = ?, phone = ?, meta_json = ? WHERE id = ?').run(
      nextName,
      nextPhone,
      JSON.stringify(nextMeta),
      client.id
    );
    const updated = db.prepare('SELECT * FROM client_users WHERE id = ?').get(client.id);
    return sendJson(res, 200, { ok: true, client: mapClientRow(updated) });
  }

  if (method === 'POST' && pathname === '/api/client/logout') {
    if (client?.token) {
      db.prepare('DELETE FROM client_sessions WHERE token = ?').run(client.token);
    }
    return sendJson(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': buildClientCookie(cookieName, '', true, isSecure) }
    );
  }

  if (method === 'GET' && pathname === '/api/client/orders' && ALLOWED_ORDERS_TABLES.has(config.ordersTable)) {
    if (!client) {
      return sendJson(res, 401, { ok: false, error: 'Требуется вход в личный кабинет' });
    }
    const queryCodes = String(parsed.searchParams.get('codes') || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const profileCodes = Array.isArray(client.meta?.orderCodes)
      ? client.meta.orderCodes.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)
      : [];
    const codes = Array.from(new Set([...profileCodes, ...queryCodes])).slice(0, 30);
    if (!codes.length) {
      return sendJson(res, 200, { ok: true, orders: [] });
    }
    const placeholders = codes.map(() => '?').join(',');
    const rows = db
      .prepare(`SELECT * FROM ${config.ordersTable} WHERE code IN (${placeholders}) ORDER BY id DESC LIMIT 20`)
      .all(...codes);
    return sendJson(res, 200, {
      ok: true,
      orders: rows.map((r) => mapOrderRow(config.ordersTable, r))
    });
  }

  return sendJson(res, 404, { ok: false, error: 'Маршрут личного кабинета не найден' });
}

module.exports = {
  initClientAccount,
  handleClientApi
};
