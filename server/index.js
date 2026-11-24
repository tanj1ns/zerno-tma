'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { initDatabase } = require('./db');
const {
  verifyPassword,
  createSession,
  deleteSession,
  getSessionUser,
  buildCookie
} = require('./auth');
const {
  apiLimiter,
  loginLimiter,
  orderLimiter,
  applySecurityHeaders,
  verifySameOrigin,
  hardenHttpServer
} = require('./security');

const PORT = Number(process.env.PORT) || 4004;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const db = initDatabase();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

const VOLUME_FEE = { '250 мл': 0, '350 мл': 60, '450 мл': 110 };
const MILK_FEE = { Классическое: 0, Овсяное: 60, Кокосовое: 70 };
const SYRUP_FEE = { 'Без сиропа': 0, 'Солёная карамель': 50, Ваниль: 50 };

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readJson(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Размер запроса превышает лимит'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function mapMenuItem(r) {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description,
    price: r.price,
    image: r.image,
    customizable: Boolean(r.customizable),
    available: Boolean(r.available)
  };
}

function mapQueueOrder(r, includePhone = false) {
  let items = [];
  try {
    items = JSON.parse(r.items_json || '[]');
  } catch {
    items = [];
  }
  const base = {
    id: r.id,
    code: r.code,
    items,
    subtotal: r.subtotal,
    bonusUsed: r.bonus_used,
    total: r.total,
    bar: r.bar,
    readyIn: r.ready_in,
    clientName: r.client_name,
    status: r.status,
    createdAt: r.created_at
  };
  if (includePhone) base.clientPhone = r.client_phone;
  return base;
}

async function handleApi(req, res, parsed) {
  const method = req.method;
  const pathname = parsed.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'zerno-tma' });
  }

  const rate = apiLimiter(req);
  if (!rate.allowed) {
    return sendJson(res, 429, { ok: false, error: 'Слишком много запросов. Подождите минуту.' }, { 'Retry-After': String(rate.retryAfterSec) });
  }

  if (!verifySameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'Запрос отклонён политикой безопасности источника (CSRF)' });
  }

  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const user = getSessionUser(db, req);

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const menu = db.prepare('SELECT * FROM menu_items ORDER BY sort_order ASC, id ASC').all().map(mapMenuItem);
    const queue = db
      .prepare("SELECT * FROM coffee_orders WHERE status IN ('preparing', 'ready') ORDER BY id DESC LIMIT 12")
      .all()
      .map((r) => mapQueueOrder(r, false));
    return sendJson(res, 200, {
      ok: true,
      menu,
      queue,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
    });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const oRate = orderLimiter(req);
    if (!oRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много предзаказов подряд.' }, { 'Retry-After': String(oRate.retryAfterSec) });
    }

    const body = await readJson(req);
    if (String(body.website || '').trim() !== '') {
      return sendJson(res, 201, {
        ok: true,
        order: { code: 'ZRN-999', status: 'preparing', total: 0 }
      });
    }

    if (!body.consent) {
      return sendJson(res, 400, { ok: false, error: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }

    const clientName = String(body.clientName || '').trim().slice(0, 80);
    const clientPhone = String(body.clientPhone || '').trim().slice(0, 32);
    const bar = ['Покровка, 19', 'Большая Никитская, 24'].includes(body.bar) ? body.bar : 'Покровка, 19';
    const readyIn = ['Через 5 мин', 'Через 10 мин', 'Через 20 мин'].includes(body.readyIn) ? body.readyIn : 'Через 10 мин';

    if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
      return sendJson(res, 400, { ok: false, error: 'Укажите имя и телефон (+7) для уведомления о готовности' });
    }

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 15) : [];
    if (!rawItems.length) {
      return sendJson(res, 400, { ok: false, error: 'Добавьте хотя бы одну позицию из меню' });
    }

    let subtotal = 0;
    const orderItems = [];
    for (const line of rawItems) {
      const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(Number(line.itemId));
      if (!item || !item.available) {
        return sendJson(res, 400, { ok: false, error: 'Позиция недоступна для заказа' });
      }
      const qty = Math.max(1, Math.min(10, Math.round(Number(line.qty) || 1)));
      let extra = 0;
      let label = item.title;
      if (item.customizable && line.options) {
        const vFee = VOLUME_FEE[line.options.volume] || 0;
        const mFee = MILK_FEE[line.options.milk] || 0;
        const sFee = SYRUP_FEE[line.options.syrup] || 0;
        extra = vFee + mFee + sFee;
        label = `${item.title} (${line.options.volume || '250 мл'}, ${line.options.milk || 'Классическое'}${line.options.syrup && line.options.syrup !== 'Без сиропа' ? `, ${line.options.syrup}` : ''})`;
      }
      const unitPrice = item.price + extra;
      subtotal += unitPrice * qty;
      orderItems.push({ itemId: item.id, title: label, qty, price: unitPrice });
    }

    const bonusUsed = body.spendBonus ? Math.min(340, Math.round(subtotal * 0.3)) : 0;
    const total = Math.max(0, subtotal - bonusUsed);
    const code = `ZRN-${crypto.randomInt(420, 999)}`;
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO coffee_orders (code, items_json, subtotal, bonus_used, total, bar, ready_in, client_name, client_phone, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'preparing', ?)`
      )
      .run(code, JSON.stringify(orderItems), subtotal, bonusUsed, total, bar, readyIn, clientName, clientPhone, now);

    const created = db.prepare('SELECT * FROM coffee_orders WHERE id = ?').get(info.lastInsertRowid);
    return sendJson(res, 201, { ok: true, order: mapQueueOrder(created, false) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const lRate = loginLimiter(req);
    if (!lRate.allowed) {
      return sendJson(res, 429, { ok: false, error: 'Слишком много попыток входа.' }, { 'Retry-After': String(lRate.retryAfterSec) });
    }

    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const account = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (!account || !verifyPassword(password, account.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }

    const token = createSession(db, account.id);
    return sendJson(
      res,
      200,
      { ok: true, user: { id: account.id, name: account.name, email: account.email, role: account.role } },
      { 'Set-Cookie': buildCookie(token, false, isSecure) }
    );
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (user?.token) deleteSession(db, user.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildCookie('', true, isSecure) });
  }

  if (pathname.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация бариста/администратора' });
    }

    if (method === 'GET' && pathname === '/api/admin/orders') {
      const orders = db.prepare('SELECT * FROM coffee_orders ORDER BY id DESC LIMIT 60').all().map((r) => mapQueueOrder(r, true));
      return sendJson(res, 200, { ok: true, orders });
    }

    const orderMatch = pathname.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (orderMatch && method === 'PATCH') {
      const body = await readJson(req);
      if (!['preparing', 'ready', 'picked_up'].includes(body.status)) {
        return sendJson(res, 400, { ok: false, error: 'Недопустимый статус выдачи' });
      }
      db.prepare('UPDATE coffee_orders SET status = ? WHERE id = ?').run(body.status, Number(orderMatch[1]));
      const updated = db.prepare('SELECT * FROM coffee_orders WHERE id = ?').get(Number(orderMatch[1]));
      return sendJson(res, 200, { ok: true, order: mapQueueOrder(updated, true) });
    }

    if (method === 'POST' && pathname === '/api/admin/menu') {
      const body = await readJson(req);
      const title = String(body.title || '').trim().slice(0, 100);
      const category = ['coffee', 'signature', 'pastry', 'beans'].includes(body.category) ? body.category : 'coffee';
      const price = Math.max(50, Math.round(Number(body.price) || 290));
      const description = String(body.description || title).trim().slice(0, 300);
      const image = String(body.image || '/uploads/latte-hero.webp').trim();
      const customizable = body.customizable ? 1 : 0;

      if (title.length < 2) return sendJson(res, 400, { ok: false, error: 'Укажите название позиции' });
      const info = db
        .prepare('INSERT INTO menu_items (category, title, description, price, image, customizable, available, sort_order) VALUES (?, ?, ?, ?, ?, ?, 1, 20)')
        .run(category, title, description, price, image, customizable);
      return sendJson(res, 201, { ok: true, item: mapMenuItem(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(info.lastInsertRowid)) });
    }

    const menuMatch = pathname.match(/^\/api\/admin\/menu\/(\d+)$/);
    if (menuMatch && method === 'PATCH') {
      const body = await readJson(req);
      const id = Number(menuMatch[1]);
      const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { ok: false, error: 'Позиция не найдена' });
      const available = body.available !== undefined ? (body.available ? 1 : 0) : existing.available;
      db.prepare('UPDATE menu_items SET available = ? WHERE id = ?').run(available, id);
      return sendJson(res, 200, { ok: true, item: mapMenuItem(db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id)) });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Маршрут не найден' });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);

  try {
    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (parsed.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed);
    }

    const reqPath = decodeURIComponent(parsed.pathname);
    if (reqPath === '/robots.txt') {
      return serveFile(res, path.join(ROOT_DIR, 'public', 'robots.txt'));
    }
    if (reqPath.startsWith('/uploads/')) {
      const uploadTarget = path.resolve(ROOT_DIR, 'public', `.${reqPath}`);
      if (!uploadTarget.startsWith(path.resolve(ROOT_DIR, 'public', 'uploads'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      return serveFile(res, uploadTarget);
    }

    const cleanDistPath = path.resolve(DIST_DIR, reqPath === '/' ? 'index.html' : `.${reqPath}`);
    if (!cleanDistPath.startsWith(path.resolve(DIST_DIR))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(cleanDistPath) && fs.statSync(cleanDistPath).isFile()) {
      return serveFile(res, cleanDistPath);
    }

    return serveFile(res, path.join(DIST_DIR, 'index.html'));
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Внутренняя ошибка сервера' });
  }
});

hardenHttpServer(server);
server.listen(PORT, HOST, () => {
  console.log(`zerno-tma server running at http://${HOST}:${PORT}`);
});
