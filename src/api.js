const SECRET_ROUTE_SALT = 'zerno-route-v1:';
const SECRET_ROUTE_HASH = 'e2995b42634296cfcdebb3c4de8c8abfc75a5ab3848023649328039a97e65c5f';

const ADMIN_EMAIL = 'admin@zerno-coffee.ru';
const ADMIN_PASS_SALT = 'zerno-adm-v1:';
const ADMIN_PASS_HASH = '7f4894e528c47b3d23e53661318d0b4e88cf404d35d00bcb7c52ed2ad67885f5';

const STATIC_DB_KEY = 'zerno_static_db_v1';
const STATIC_SESSION_KEY = 'zerno_static_admin_v1';
const LOGIN_GUARD_KEY = 'zerno_login_guard_v1';
const LOYALTY_POINTS = 340;

let staticModeFlag = null;

export const MENU_CATEGORIES = [
  { id: 'all', label: 'Всё меню' },
  { id: 'coffee', label: 'Классика' },
  { id: 'signature', label: 'Авторские' },
  { id: 'pastry', label: 'Выпечка' },
  { id: 'beans', label: 'Зерно домой' }
];

export const VOLUME_OPTIONS = [
  { label: '250 мл', fee: 0 },
  { label: '350 мл', fee: 60 },
  { label: '450 мл', fee: 110 }
];

export const MILK_OPTIONS = [
  { label: 'Классическое', fee: 0 },
  { label: 'Овсяное', fee: 60 },
  { label: 'Кокосовое', fee: 70 }
];

export const SYRUP_OPTIONS = [
  { label: 'Без сиропа', fee: 0 },
  { label: 'Солёная карамель', fee: 50 },
  { label: 'Ваниль', fee: 50 }
];

export const COFFEE_BARS = ['Покровка, 19', 'Большая Никитская, 24'];
export const READY_TIMES = ['Через 5 мин', 'Через 10 мин', 'Через 20 мин'];

export const PICKUP_STATUS = {
  preparing: { label: 'Готовится', cls: 'status--wip' },
  ready: { label: 'Ждёт на стойке', cls: 'status--live' },
  picked_up: { label: 'Выдан', cls: 'status--oss' }
};

export function isStaticHost() {
  if (staticModeFlag !== null) return staticModeFlag;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSecretAdminHash(hashStr) {
  const clean = String(hashStr || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim();
  if (!clean) return false;
  return (await sha256Hex(SECRET_ROUTE_SALT + clean)) === SECRET_ROUTE_HASH;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:|\.\.?\/)/i.test(url)) return url;
  if (url.startsWith('/')) return `.${url}`;
  return url;
}

export function formatRub(val) {
  return `${Math.round(Number(val) || 0).toLocaleString('ru-RU')} ₽`;
}

export function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8' || digits[0] === '7') digits = '7' + digits.slice(1);
  else digits = '7' + digits;
  digits = digits.slice(0, 11);

  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length > 4) out += ') ' + digits.slice(4, 7);
  if (digits.length > 7) out += '-' + digits.slice(7, 9);
  if (digits.length > 9) out += '-' + digits.slice(9, 11);
  return out;
}

export function calcBonusDiscount(subtotal, spendBonus, balance = LOYALTY_POINTS) {
  if (!spendBonus || subtotal <= 0) return 0;
  return Math.min(balance, Math.round(subtotal * 0.3));
}

function getInitialStaticDb() {
  const now = new Date().toISOString();
  return {
    nextItemId: 7,
    nextOrderId: 3,
    menu: [
      {
        id: 1,
        category: 'coffee',
        title: 'Флэт Уайт',
        description: 'Двойной эспрессо на бразильской арабике и тонко взбитое молоко.',
        price: 320,
        image: './uploads/latte-hero.webp',
        customizable: true,
        available: true
      },
      {
        id: 2,
        category: 'coffee',
        title: 'Капучино Классик',
        description: 'Сбалансированная текстура молока с орехово-карамельным профилем зерна.',
        price: 290,
        image: './uploads/latte-hero.webp',
        customizable: true,
        available: true
      },
      {
        id: 3,
        category: 'signature',
        title: 'Раф Солёная Карамель',
        description: 'Сливки 11%, морская соль и домашняя карамель собственной варки.',
        price: 390,
        image: './uploads/latte-hero.webp',
        customizable: true,
        available: true
      },
      {
        id: 4,
        category: 'signature',
        title: 'Фильтр V60 Эфиопия',
        description: 'Чистая чашка ручного пролива с нотами бергамота, персика и жасмина.',
        price: 310,
        image: './uploads/beans-pack.webp',
        customizable: false,
        available: true
      },
      {
        id: 5,
        category: 'pastry',
        title: 'Круассан на сливочном масле',
        description: 'Слоёная выпечка утреннего замеса 82,5% жирности с хрустящей корочкой.',
        price: 240,
        image: './uploads/latte-hero.webp',
        customizable: false,
        available: true
      },
      {
        id: 6,
        category: 'beans',
        title: 'Зерно Эфиопия Сидамо 250 г',
        description: 'Светлая обжарка под фильтр и воронку, урожай 2026 года, цельное зерно.',
        price: 1150,
        image: './uploads/beans-pack.webp',
        customizable: false,
        available: true
      }
    ],
    orders: [
      {
        id: 1,
        code: 'ZRN-412',
        items: [{ itemId: 1, title: 'Флэт Уайт (350 мл, Овсяное)', qty: 1, price: 440 }],
        subtotal: 440,
        bonusUsed: 0,
        total: 440,
        bar: 'Покровка, 19',
        readyIn: 'Через 5 мин',
        clientName: 'Антон К.',
        clientPhone: '+7 (916) 334-10-92',
        status: 'ready',
        createdAt: now
      },
      {
        id: 2,
        code: 'ZRN-415',
        items: [
          { itemId: 4, title: 'Фильтр V60 Эфиопия', qty: 1, price: 310 },
          { itemId: 5, title: 'Круассан на сливочном масле', qty: 1, price: 240 }
        ],
        subtotal: 550,
        bonusUsed: 110,
        total: 440,
        bar: 'Большая Никитская, 24',
        readyIn: 'Через 10 мин',
        clientName: 'Лена С.',
        clientPhone: '+7 (926) 802-44-15',
        status: 'preparing',
        createdAt: now
      }
    ]
  };
}

function readStaticDb() {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.menu) && Array.isArray(parsed.orders)) return parsed;
    }
  } catch {}
  const init = getInitialStaticDb();
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(init));
  return init;
}

function writeStaticDb(db) {
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

function getStaticUser() {
  try {
    const raw = sessionStorage.getItem(STATIC_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function reqJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Ошибка ${res.status}`);
  }
  return data;
}

export const zernoApi = {
  async bootstrap() {
    if (isStaticHost()) {
      const db = readStaticDb();
      return {
        ok: true,
        menu: db.menu,
        queue: db.orders.filter((o) => o.status !== 'picked_up'),
        user: getStaticUser()
      };
    }
    try {
      const res = await reqJson('./api/bootstrap');
      staticModeFlag = false;
      return res;
    } catch {
      staticModeFlag = true;
      const db = readStaticDb();
      return {
        ok: true,
        menu: db.menu,
        queue: db.orders.filter((o) => o.status !== 'picked_up'),
        user: getStaticUser()
      };
    }
  },

  async createOrder(payload) {
    if (String(payload.website || '').trim() !== '') {
      return { ok: true, order: { code: 'ZRN-999', status: 'preparing', total: 0 } };
    }
    if (!payload.consent) {
      throw new Error('Подтвердите согласие на обработку персональных данных (152-ФЗ).');
    }

    if (isStaticHost()) {
      const clientName = String(payload.clientName || '').trim();
      const clientPhone = String(payload.clientPhone || '').trim();
      if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
        throw new Error('Укажите имя и телефон (+7) для уведомления о готовности');
      }
      const db = readStaticDb();
      let subtotal = 0;
      const orderItems = [];
      for (const line of payload.items || []) {
        const item = db.menu.find((m) => m.id === Number(line.itemId));
        if (!item || !item.available) throw new Error('Позиция временно на стоп-листе');
        const qty = Math.max(1, Math.min(10, Math.round(Number(line.qty) || 1)));
        let extra = 0;
        let label = item.title;
        if (item.customizable && line.options) {
          const v = VOLUME_OPTIONS.find((x) => x.label === line.options.volume)?.fee || 0;
          const m = MILK_OPTIONS.find((x) => x.label === line.options.milk)?.fee || 0;
          const s = SYRUP_OPTIONS.find((x) => x.label === line.options.syrup)?.fee || 0;
          extra = v + m + s;
          label = `${item.title} (${line.options.volume}, ${line.options.milk}${line.options.syrup !== 'Без сиропа' ? `, ${line.options.syrup}` : ''})`;
        }
        const unitPrice = item.price + extra;
        subtotal += unitPrice * qty;
        orderItems.push({ itemId: item.id, title: label, qty, price: unitPrice });
      }
      if (!orderItems.length) throw new Error('Корзина пуста');
      const bonusUsed = calcBonusDiscount(subtotal, payload.spendBonus, LOYALTY_POINTS);
      const total = Math.max(0, subtotal - bonusUsed);
      const order = {
        id: db.nextOrderId++,
        code: `ZRN-${415 + db.nextOrderId}`,
        items: orderItems,
        subtotal,
        bonusUsed,
        total,
        bar: payload.bar || COFFEE_BARS[0],
        readyIn: payload.readyIn || READY_TIMES[1],
        clientName,
        clientPhone,
        status: 'preparing',
        createdAt: new Date().toISOString()
      };
      db.orders.unshift(order);
      writeStaticDb(db);
      return { ok: true, order };
    }

    return reqJson('./api/orders', { method: 'POST', body: JSON.stringify(payload) });
  },

  async login(email, password) {
    if (isStaticHost()) {
      let guard = { count: 0, lockedUntil: 0 };
      try {
        guard = JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || '{}');
      } catch {}
      if (guard.lockedUntil && guard.lockedUntil > Date.now()) {
        const sec = Math.ceil((guard.lockedUntil - Date.now()) / 1000);
        throw new Error(`Слишком много попыток входа. Повторите через ${sec} сек.`);
      }
      await new Promise((r) => setTimeout(r, 450));
      const cleanEmail = String(email || '').trim().toLowerCase();
      const passHash = await sha256Hex(ADMIN_PASS_SALT + String(password || ''));
      if (cleanEmail !== ADMIN_EMAIL || passHash !== ADMIN_PASS_HASH) {
        const count = Number(guard.count || 0) + 1;
        const next = count >= 5 ? { count: 0, lockedUntil: Date.now() + 5 * 60_000 } : { count, lockedUntil: 0 };
        localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(next));
        throw new Error('Неверный email или пароль');
      }
      localStorage.removeItem(LOGIN_GUARD_KEY);
      const user = { id: 1, name: 'Шеф-бариста ЗЕРНО', email: ADMIN_EMAIL, role: 'admin' };
      sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user));
      return { ok: true, user };
    }
    return reqJson('./api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  },

  async logout() {
    if (isStaticHost()) {
      sessionStorage.removeItem(STATIC_SESSION_KEY);
      return { ok: true };
    }
    return reqJson('./api/auth/logout', { method: 'POST' });
  },

  async getAdminOrders() {
    if (isStaticHost()) {
      return { ok: true, orders: readStaticDb().orders };
    }
    return reqJson('./api/admin/orders');
  },

  async updateOrderStatus(id, status) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const target = db.orders.find((o) => o.id === Number(id));
      if (!target) throw new Error('Заказ не найден');
      target.status = status;
      writeStaticDb(db);
      return { ok: true, order: target };
    }
    return reqJson(`./api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },

  async toggleMenuAvailable(id, available) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const target = db.menu.find((m) => m.id === Number(id));
      if (!target) throw new Error('Позиция не найдена');
      target.available = available;
      writeStaticDb(db);
      return { ok: true, item: target };
    }
    return reqJson(`./api/admin/menu/${id}`, { method: 'PATCH', body: JSON.stringify({ available }) });
  },

  async addMenuItem(payload) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const item = {
        id: db.nextItemId++,
        category: payload.category || 'coffee',
        title: String(payload.title || '').trim(),
        description: String(payload.description || payload.title || '').trim(),
        price: Math.max(50, Math.round(Number(payload.price) || 290)),
        image: resolveAssetUrl(payload.image || './uploads/latte-hero.webp'),
        customizable: Boolean(payload.customizable),
        available: true
      };
      db.menu.push(item);
      writeStaticDb(db);
      return { ok: true, item };
    }
    return reqJson('./api/admin/menu', { method: 'POST', body: JSON.stringify(payload) });
  }
};
