# ЗЕРНО — Telegram Mini App предзаказа спешелти-кофе

Веб-приложение внутри Telegram (Mini App) для спешелти-кофейни: выбор объёма, молока и сиропа, списание бонусных баллов лояльности и моментальный код выдачи `#ZRN-XXX`.

- **Стек:** React 19, Vite 6, Lucide Icons, Node.js (`http` + `node:sqlite`), поддержка `window.Telegram?.WebApp`.
- **Деплой:**
  - Статика: `npm run publish` -> ветка `gh-pages`.
  - Node.js + SQLite (VPS / Amvera): `Dockerfile` + `amvera.yml`, порт `4004`, `/data`, `/api/health`.
- **Безопасность:** `HttpOnly`-куки, `scrypt` + `timingSafeEqual`, rate limiting, CSRF проверка `Origin/Host`, строгий CSP (`script-src 'self'`), honeypot `.hp-trap`, согласие 152-ФЗ, `robots.txt`.
