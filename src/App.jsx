import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Coffee,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Plus,
  ShoppingBag,
  Sparkles,
  Sun,
  X
} from 'lucide-react';
import {
  COFFEE_BARS,
  MENU_CATEGORIES,
  PICKUP_STATUS,
  READY_TIMES,
  calcBonusDiscount,
  formatPhone,
  formatRub,
  isSecretAdminHash,
  resolveAssetUrl,
  zernoApi
} from './api';
import DrinkModal from './components/DrinkModal';
import PrivacyModal from './components/PrivacyModal';
import AdminBarista from './pages/AdminBarista';
import CookieBanner, { setCookie } from './components/CookieBanner';

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [wideMode, setWideMode] = useState(false);

  const [menu, setMenu] = useState([]);
  const [queue, setQueue] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  const [category, setCategory] = useState('all');
  const [activeItem, setActiveItem] = useState(null);

  const [cart, setCart] = useState([]);
  const [spendBonus, setSpendBonus] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [bar, setBar] = useState(COFFEE_BARS[0]);
  const [readyIn, setReadyIn] = useState(READY_TIMES[1]);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [consent, setConsent] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [cookieForceOpen, setCookieForceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [lastOrder, setLastOrder] = useState(null);

  const formOpenedAt = useRef(Date.now());

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    setCookie('zerno_theme', next);
    try {
      localStorage.setItem('zerno_theme', next);
    } catch {}
  }

  async function refresh() {
    try {
      const res = await zernoApi.bootstrap();
      setMenu(res.menu || []);
      setQueue(res.queue || []);
      setUser(res.user || null);
    } catch {}
  }

  useEffect(() => {
    refresh();
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      }
    } catch {}

    async function syncHash() {
      const ok = await isSecretAdminHash(window.location.hash);
      setIsAdminRoute(ok);
    }
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    if (checkoutOpen) formOpenedAt.current = Date.now();
  }, [checkoutOpen]);

  const filteredMenu = useMemo(
    () => menu.filter((m) => category === 'all' || m.category === category),
    [menu, category]
  );

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const bonusDiscount = calcBonusDiscount(subtotal, spendBonus);
  const finalTotal = Math.max(0, subtotal - bonusDiscount);
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  function addCartLine(item, unitPrice, options) {
    const key = `${item.id}-${options ? `${options.volume}-${options.milk}-${options.syrup}` : 'base'}`;
    const label = options
      ? `${item.title} (${options.volume}, ${options.milk}${options.syrup !== 'Без сиропа' ? `, ${options.syrup}` : ''})`
      : item.title;

    setCart((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) {
        return prev.map((c, k) => (k === idx ? { ...c, qty: Math.min(10, c.qty + 1) } : c));
      }
      return [...prev, { key, itemId: item.id, title: label, unitPrice, options, qty: 1 }];
    });
  }

  function updateQty(key, delta) {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  }

  async function handleCheckoutSubmit(e) {
    e.preventDefault();
    setErr('');
    if (Date.now() - formOpenedAt.current < 1200) {
      setErr('Проверьте параметры выдачи и отправьте заказ ещё раз.');
      return;
    }
    setBusy(true);
    try {
      const res = await zernoApi.createOrder({
        items: cart.map((c) => ({ itemId: c.itemId, qty: c.qty, options: c.options })),
        spendBonus,
        bar,
        readyIn,
        clientName,
        clientPhone,
        consent,
        website: honeypot
      });
      setLastOrder(res.order);
      setCart([]);
      setCheckoutOpen(false);
      await refresh();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`tma-stage ${wideMode ? 'is-wide' : ''}`}>
      <div className="tma-shell">
        <header className="tma-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="tma-logo">
              <Coffee size={16} />
            </span>
            <div>
              <strong style={{ fontSize: '0.96rem', display: 'block', lineHeight: 1.1 }}>ЗЕРНО</strong>
              <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                @zerno_coffee_bot &bull; Mini App
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              type="button"
              className="icon-btn desktop-only"
              onClick={() => setWideMode((v) => !v)}
              title={wideMode ? 'Компактный TMA' : 'Широкий вид'}
              aria-label="Переключить ширину Telegram Mini App"
            >
              {wideMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Переключить тему">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <main className="tma-body">
          {isAdminRoute ? (
            <AdminBarista
              user={user}
              menu={menu}
              onUserChange={setUser}
              onRefresh={refresh}
              onExit={() => {
                window.location.hash = '';
                setIsAdminRoute(false);
              }}
            />
          ) : (
            <>
              <section className="hero-banner">
                <img src="./uploads/latte-hero.webp" alt="Флэт Уайт и круассан в кофейне ЗЕРНО" draggable={false} />
                <div className="hero-banner__overlay">
                  <span className="eyebrow">Предзаказ без очереди</span>
                  <h1>Свежий эспрессо к вашему выходу из метро</h1>
                </div>
              </section>

              <section className="loyalty-card">
                <div>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Карта гостя ЗЕРНО &bull; Кэшбэк 7%</span>
                  <strong className="mono" style={{ fontSize: '1.25rem', display: 'block' }}>340 ₽ баллов</strong>
                </div>
                <label className="bonus-toggle">
                  <input
                    type="checkbox"
                    checked={spendBonus}
                    onChange={(e) => setSpendBonus(e.target.checked)}
                  />
                  <span>Списать до 30%</span>
                </label>
              </section>

              {lastOrder && (
                <section className="panel order-ready-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="status-pill status--live">
                      <CheckCircle2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Заказ отправлен на бар
                    </span>
                    <strong className="mono">{lastOrder.code}</strong>
                  </div>
                  <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Точка: {lastOrder.bar} &bull; {lastOrder.readyIn} &bull; <strong className="mono">{formatRub(lastOrder.total)}</strong>
                  </p>
                </section>
              )}

              {queue.length > 0 && (
                <section className="queue-strip">
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Sparkles size={13} color="var(--accent)" /> Табло выдачи на баре
                  </span>
                  <div className="queue-pills">
                    {queue.slice(0, 4).map((q) => {
                      const st = PICKUP_STATUS[q.status] || PICKUP_STATUS.preparing;
                      return (
                        <div key={q.id} className="queue-pill">
                          <strong className="mono">{q.code}</strong>
                          <span className={`status-pill ${st.cls}`}>{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              <div className="cat-scroll">
                {MENU_CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`tab ${category === c.id ? 'is-active' : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <section className="menu-grid">
                {filteredMenu.map((item) => (
                  <article key={item.id} className={`menu-card ${!item.available ? 'is-disabled' : ''}`}>
                    <div
                      className="menu-card__media"
                      onClick={() => item.available && setActiveItem(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && item.available && setActiveItem(item)}
                    >
                      <img src={resolveAssetUrl(item.image)} alt={item.title} loading="lazy" draggable={false} />
                    </div>
                    <div className="menu-card__body">
                      <h3 onClick={() => item.available && setActiveItem(item)}>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="menu-card__foot">
                        <strong className="mono">{formatRub(item.price)}</strong>
                        {item.available ? (
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            onClick={() =>
                              item.customizable ? setActiveItem(item) : addCartLine(item, item.price, null)
                            }
                          >
                            <Plus size={14} /> {item.customizable ? 'Выбрать' : 'В заказ'}
                          </button>
                        ) : (
                          <span className="status-pill status--oss">Стоп-лист</span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
          <footer className="tma-footer">
            <span>&copy; 2026 ЗЕРНО</span>
            <span className="footer__meta">
              <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>152-ФЗ и cookie</button>
              <span aria-hidden="true">·</span>
              <button type="button" className="link-inline" onClick={() => setCookieForceOpen(true)}>Настройки cookie</button>
            </span>
          </footer>
        </main>

        {!isAdminRoute && totalQty > 0 && (
          <div className="tg-main-bar">
            <button type="button" className="tg-main-btn" onClick={() => setCheckoutOpen(true)}>
              <span>
                <ShoppingBag size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Оформить ({totalQty})
              </span>
              <strong className="mono">{formatRub(finalTotal)}</strong>
            </button>
          </div>
        )}
      </div>

      {activeItem && (
        <DrinkModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
          onAdd={addCartLine}
        />
      )}

      {checkoutOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCheckoutOpen(false)}>
          <div className="modal-box" role="dialog" aria-modal="true" aria-label="Оформление предзаказа">
            <div className="modal-head">
              <h3 style={{ fontSize: '1.08rem' }}>Ваш заказ в ЗЕРНО</h3>
              <button type="button" className="icon-btn" onClick={() => setCheckoutOpen(false)} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>

            <div className="checkout-items">
              {cart.map((c) => (
                <div key={c.key} className="checkout-line">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{c.title}</div>
                    <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {formatRub(c.unitPrice)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" className="qty-btn" onClick={() => updateQty(c.key, -1)} aria-label="Меньше">
                      <Minus size={12} />
                    </button>
                    <span className="mono" style={{ minWidth: 16, textAlign: 'center' }}>{c.qty}</span>
                    <button type="button" className="qty-btn" onClick={() => updateQty(c.key, 1)} aria-label="Больше">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="totals-line">
              <span>Подытог</span>
              <span className="mono">{formatRub(subtotal)}</span>
            </div>
            {bonusDiscount > 0 && (
              <div className="totals-line" style={{ color: 'var(--success)' }}>
                <span>Списано баллов</span>
                <span className="mono">−{formatRub(bonusDiscount)}</span>
              </div>
            )}

            <form onSubmit={handleCheckoutSubmit} className="form">
              <div className="field">
                <label>Кофейня</label>
                <select className="input" value={bar} onChange={(e) => setBar(e.target.value)}>
                  {COFFEE_BARS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>К какому времени приготовить</label>
                <select className="input" value={readyIn} onChange={(e) => setReadyIn(e.target.value)}>
                  {READY_TIMES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Ваше имя</label>
                <input
                  className="input"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Игорь"
                  required
                />
              </div>
              <div className="field">
                <label>Телефон</label>
                <input
                  className="input mono"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                  placeholder="+7 (999) 000-00-00"
                  required
                />
              </div>

              <div className="hp-trap" aria-hidden="true">
                <label htmlFor="hp-zerno">Ваш сайт</label>
                <input
                  id="hp-zerno"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <label className="consent-check">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Согласен с{' '}
                  <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>
                    обработкой персональных данных (152-ФЗ)
                  </button>
                </span>
              </label>

              {err && <div className="status-msg status-msg--err">{err}</div>}

              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? 'Отправка на бар...' : `Подтвердить предзаказ • ${formatRub(finalTotal)}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

      <CookieBanner
        prefix="zerno"
        forceOpen={cookieForceOpen}
        onCloseForce={() => setCookieForceOpen(false)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        bottomOffset={!isAdminRoute && totalQty > 0}
      />
    </div>
  );
}
