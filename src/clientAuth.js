export function formatClientPhone(raw) {
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

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function createClientAuth({ prefix, demoSeed }) {
  const DB_KEY = `${prefix}_clients_db_v1`;
  const SESSION_KEY = `${prefix}_client_session_v1`;
  const GUARD_KEY = `${prefix}_client_guard_v1`;
  const PASS_SALT = `${prefix}-cli-v1:`;
  let useStatic =
    typeof window !== 'undefined' &&
    (window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:');

  async function ensureStaticDb() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
      if (parsed && Array.isArray(parsed.users) && parsed.users.length) {
        return parsed;
      }
    } catch {}
    const passHash = await sha256Hex(PASS_SALT + String(demoSeed.password || 'client12345'));
    const init = {
      nextId: 2,
      users: [
        {
          id: 1,
          name: demoSeed.name,
          email: String(demoSeed.email || '').trim().toLowerCase(),
          phone: demoSeed.phone || '',
          passHash,
          meta: { ...(demoSeed.meta || {}) },
          createdAt: new Date().toISOString()
        }
      ]
    };
    localStorage.setItem(DB_KEY, JSON.stringify(init));
    return init;
  }

  function saveStaticDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  }

  function publicClient(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone || '',
      meta: { ...(row.meta || {}) }
    };
  }

  async function readStaticSession() {
    try {
      const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!raw || !raw.clientId || (raw.expiresAt && raw.expiresAt < Date.now())) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      const db = await ensureStaticDb();
      const user = db.users.find((u) => u.id === raw.clientId);
      return publicClient(user);
    } catch {
      return null;
    }
  }

  function writeStaticSession(clientId) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ clientId, expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000 })
    );
  }

  async function serverOrStatic(url, opts, staticFn) {
    if (useStatic) return staticFn();
    let res;
    try {
      res = await fetch(url, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
        ...opts
      });
    } catch {
      useStatic = true;
      return staticFn();
    }
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      useStatic = true;
      return staticFn();
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || `Ошибка ${res.status}`);
    }
    return data;
  }

  const clientAuth = {
    async me() {
      return serverOrStatic('./api/client/me', { method: 'GET' }, async () => ({
        ok: true,
        client: await readStaticSession()
      }));
    },

    async login(email, password) {
      return serverOrStatic(
        './api/client/login',
        { method: 'POST', body: JSON.stringify({ email, password }) },
        async () => {
          const now = Date.now();
          let guard = { count: 0, firstAt: now, lockedUntil: 0 };
          try {
            const raw = JSON.parse(localStorage.getItem(GUARD_KEY) || 'null');
            if (raw && typeof raw === 'object') guard = raw;
          } catch {}
          await new Promise((r) => setTimeout(r, 350));
          if (guard.lockedUntil && guard.lockedUntil > Date.now()) {
            const sec = Math.ceil((guard.lockedUntil - Date.now()) / 1000);
            throw new Error(`Слишком много попыток входа. Повторите через ${sec} сек.`);
          }
          if (!guard.firstAt || Date.now() - guard.firstAt > 600_000) {
            guard = { count: 0, firstAt: Date.now(), lockedUntil: 0 };
          }
          const db = await ensureStaticDb();
          const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);
          const candidate = db.users.find((u) => u.email === cleanEmail);
          const passHash = await sha256Hex(PASS_SALT + String(password || ''));
          if (!candidate || candidate.passHash !== passHash) {
            const count = Number(guard.count || 0) + 1;
            const next =
              count >= 5
                ? { count: 0, firstAt: guard.firstAt, lockedUntil: Date.now() + 5 * 60_000 }
                : { count, firstAt: guard.firstAt, lockedUntil: 0 };
            localStorage.setItem(GUARD_KEY, JSON.stringify(next));
            throw new Error('Неверный email или пароль');
          }
          localStorage.removeItem(GUARD_KEY);
          writeStaticSession(candidate.id);
          return { ok: true, client: publicClient(candidate) };
        }
      );
    },

    async register({ name, email, phone, password, meta, consent, website, elapsedMs }) {
      if (String(website || '').trim() !== '') {
        return { ok: true, client: null };
      }
      if (typeof elapsedMs === 'number' && elapsedMs < 1200) {
        throw new Error('Пожалуйста, проверьте поля формы и повторите отправку.');
      }
      if (!consent) {
        throw new Error('Подтвердите согласие на обработку персональных данных (152-ФЗ).');
      }
      return serverOrStatic(
        './api/client/register',
        { method: 'POST', body: JSON.stringify({ name, email, phone, password, meta, consent, website }) },
        async () => {
          const cleanName = String(name || '').trim().slice(0, 100);
          const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);
          const cleanPhone = String(phone || '').trim().slice(0, 32);
          const cleanPass = String(password || '');
          if (cleanName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail) || cleanPass.length < 6) {
            throw new Error('Укажите имя (от 2 символов), корректный email и пароль (от 6 символов).');
          }
          const db = await ensureStaticDb();
          if (db.users.some((u) => u.email === cleanEmail)) {
            throw new Error('Аккаунт с таким email уже зарегистрирован.');
          }
          const created = {
            id: db.nextId++,
            name: cleanName,
            email: cleanEmail,
            phone: cleanPhone,
            passHash: await sha256Hex(PASS_SALT + cleanPass),
            meta: meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {},
            createdAt: new Date().toISOString()
          };
          db.users.push(created);
          saveStaticDb(db);
          writeStaticSession(created.id);
          return { ok: true, client: publicClient(created) };
        }
      );
    },

    async updateProfile({ name, phone, meta }) {
      return serverOrStatic(
        './api/client/profile',
        { method: 'PUT', body: JSON.stringify({ name, phone, meta }) },
        async () => {
          const current = await readStaticSession();
          if (!current) throw new Error('Требуется вход в личный кабинет');
          const db = await ensureStaticDb();
          const idx = db.users.findIndex((u) => u.id === current.id);
          if (idx === -1) throw new Error('Профиль не найден');
          const nextName = String(name !== undefined ? name : db.users[idx].name).trim().slice(0, 100);
          if (nextName.length < 2) throw new Error('Имя должно содержать минимум 2 символа');
          const nextPhone =
            phone !== undefined ? String(phone || '').trim().slice(0, 32) : db.users[idx].phone;
          const patchMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
          db.users[idx] = {
            ...db.users[idx],
            name: nextName,
            phone: nextPhone,
            meta: { ...(db.users[idx].meta || {}), ...patchMeta }
          };
          saveStaticDb(db);
          return { ok: true, client: publicClient(db.users[idx]) };
        }
      );
    },

    async appendCode(listKey, code) {
      const cleanCode = String(code || '').trim().toUpperCase();
      if (!cleanCode) return null;
      const { client } = await clientAuth.me();
      if (!client) return null;
      const existing = Array.isArray(client.meta?.[listKey]) ? client.meta[listKey] : [];
      const next = [cleanCode, ...existing.filter((c) => c !== cleanCode)].slice(0, 30);
      const res = await clientAuth.updateProfile({
        name: client.name,
        phone: client.phone,
        meta: { [listKey]: next }
      });
      return res.client;
    },

    async logout() {
      return serverOrStatic('./api/client/logout', { method: 'POST' }, async () => {
        localStorage.removeItem(SESSION_KEY);
        return { ok: true };
      });
    }
  };

  return clientAuth;
}
