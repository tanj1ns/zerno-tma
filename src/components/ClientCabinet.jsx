import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Coffee, LogOut, RefreshCw, ShoppingBag, UserCheck } from 'lucide-react';
import { COFFEE_BARS, MILK_OPTIONS, PICKUP_STATUS, formatRub, zernoApi } from '../api';
import { formatClientPhone } from '../clientAuth';

export default function ClientCabinet({
  client,
  clientAuth,
  menu,
  localOrderCodes,
  onClientChange,
  onBackToMenu,
  onRepeatOrder,
  onOpenPrivacy
}) {
  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });
  const [authBusy, setAuthBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBar, setRegBar] = useState(COFFEE_BARS[0]);
  const [regMilk, setRegMilk] = useState('Овсяное');
  const [regPassword, setRegPassword] = useState('');
  const [regWebsite, setRegWebsite] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const regOpenedAt = useRef(Date.now());

  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profBar, setProfBar] = useState(COFFEE_BARS[0]);
  const [profMilk, setProfMilk] = useState('Овсяное');
  const [profMsg, setProfMsg] = useState({ type: '', text: '' });
  const [profBusy, setProfBusy] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (authTab === 'register') regOpenedAt.current = Date.now();
  }, [authTab]);

  useEffect(() => {
    if (!client) {
      setOrders([]);
      return;
    }
    setProfName(client.name || '');
    setProfPhone(client.phone || '');
    setProfBar(client.meta?.favBar || COFFEE_BARS[0]);
    setProfMilk(client.meta?.favMilk || 'Классическое');

    const codes = Array.from(new Set([...(client.meta?.orderCodes || []), ...(localOrderCodes || [])]));
    setOrdersLoading(true);
    zernoApi
      .getOrdersByCodes(codes)
      .then((res) => setOrders(res.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [client, localOrderCodes]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.login(loginEmail, loginPassword);
      onClientChange(res.client);
      setLoginPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        meta: {
          favBar: regBar,
          favMilk: regMilk,
          bonus: 150,
          stamps: 1,
          orderCodes: localOrderCodes || []
        },
        consent: regConsent,
        website: regWebsite,
        elapsedMs: Date.now() - regOpenedAt.current
      });
      if (res.client) onClientChange(res.client);
      setRegPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfMsg({ type: '', text: '' });
    setProfBusy(true);
    try {
      const res = await clientAuth.updateProfile({
        name: profName,
        phone: profPhone,
        meta: { favBar: profBar, favMilk: profMilk }
      });
      onClientChange(res.client);
      setProfMsg({ type: 'ok', text: 'Настройки гостя сохранены.' });
    } catch (err) {
      setProfMsg({ type: 'err', text: err.message });
    } finally {
      setProfBusy(false);
    }
  }

  async function handleLogout() {
    await clientAuth.logout().catch(() => {});
    onClientChange(null);
  }

  function fillDemoGuest() {
    setAuthTab('login');
    setLoginEmail('client@zerno-coffee.ru');
    setLoginPassword('client12345');
    setAuthMsg({ type: 'ok', text: 'Подставлены данные демо-гостя' });
  }

  const bonus = client?.meta?.bonus ?? 340;
  const stamps = client?.meta?.stamps ?? 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', color: 'var(--accent)' }}>
            ЗЕРНО Pass
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.18rem' }}>
            {client ? `Профиль · ${client.name}` : 'Личный кабинет'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onBackToMenu}>
            <ArrowLeft size={13} /> В меню
          </button>
          {client && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout} aria-label="Выйти">
              <LogOut size={13} />
            </button>
          )}
        </div>
      </div>

      {!client ? (
        <>
          <div className="panel">
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              <button
                type="button"
                className={`tab ${authTab === 'login' ? 'is-active' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Вход
              </button>
              <button
                type="button"
                className={`tab ${authTab === 'register' ? 'is-active' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Регистрация
              </button>
            </div>

            {authTab === 'login' ? (
              <form className="form" onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="zrnLoginEmail">Email</label>
                  <input
                    id="zrnLoginEmail"
                    type="email"
                    className="input mono"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="client@zerno-coffee.ru"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label htmlFor="zrnLoginPass">Пароль</label>
                  <input
                    id="zrnLoginPass"
                    type="password"
                    className="input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Введите пароль"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Входим...' : 'Войти'}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={handleRegister}>
                <div className="field">
                  <label htmlFor="zrnRegName">Имя *</label>
                  <input
                    id="zrnRegName"
                    className="input"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Антон"
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="zrnRegEmail">Email *</label>
                  <input
                    id="zrnRegEmail"
                    type="email"
                    className="input mono"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="zrnRegPhone">Телефон</label>
                  <input
                    id="zrnRegPhone"
                    type="tel"
                    className="input mono"
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatClientPhone(e.target.value))}
                    placeholder="+7 (999) 000-00-00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="zrnRegBar">Любимая кофейня</label>
                  <select id="zrnRegBar" className="input" value={regBar} onChange={(e) => setRegBar(e.target.value)}>
                    {COFFEE_BARS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="zrnRegMilk">Любимое молоко</label>
                  <select id="zrnRegMilk" className="input" value={regMilk} onChange={(e) => setRegMilk(e.target.value)}>
                    {MILK_OPTIONS.map((m) => (
                      <option key={m.label} value={m.label}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="zrnRegPass">Пароль (от 6 символов) *</label>
                  <input
                    id="zrnRegPass"
                    type="password"
                    className="input"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="hp-trap" aria-hidden="true">
                  <label htmlFor="zrnRegTrap">Ваш сайт</label>
                  <input
                    id="zrnRegTrap"
                    tabIndex={-1}
                    autoComplete="off"
                    value={regWebsite}
                    onChange={(e) => setRegWebsite(e.target.value)}
                  />
                </div>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={regConsent}
                    onChange={(e) => setRegConsent(e.target.checked)}
                    required
                  />
                  <span>
                    Согласен с{' '}
                    <button type="button" className="link-inline" onClick={onOpenPrivacy}>
                      обработкой персональных данных (152-ФЗ)
                    </button>
                  </span>
                </label>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Создаём карту...' : 'Получить ЗЕРНО Pass (+150 ₽)'}
                </button>
              </form>
            )}
          </div>

          <div className="panel demo-creds__box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong style={{ fontSize: '0.92rem' }}>Демо-гость</strong>
              <span className="status-pill status--live">ЗЕРНО PASS</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              340 ₽ бонусных баллов, 5 из 6 штампов и история заказов в кофейне.
            </p>
            <div className="mono" style={{ fontSize: '0.78rem' }}>Email: client@zerno-coffee.ru</div>
            <div className="mono" style={{ fontSize: '0.78rem', marginBottom: 10 }}>Пароль: client12345</div>
            <button type="button" className="btn btn--outline btn--sm" onClick={fillDemoGuest}>
              Подставить данные клиента
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="loyalty-card">
            <div style={{ flex: 1 }}>
              <div className="loyalty-top">
                <div>
                  <span className="loyalty-kicker">Wallet Coffee Pass &bull; Кэшбэк 7%</span>
                  <strong className="mono" style={{ fontSize: '1.3rem', display: 'block' }}>{bonus} ₽ баллов</strong>
                </div>
                <span className="status-pill status--live">{stamps}/6 штампов</span>
              </div>
              <div className="stamps-row">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <span key={n} className={`stamp-dot ${n <= stamps ? 'is-filled' : ''}`}>
                    <Coffee size={13} />
                  </span>
                ))}
                <span className="stamps-caption">6-й напиток бесплатно</span>
              </div>
            </div>
          </section>

          <div className="panel">
            <h3 style={{ fontSize: '1rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
              <UserCheck size={16} color="var(--accent)" /> Профиль гостя
            </h3>
            <form className="form" onSubmit={handleProfileSave}>
              <div className="field">
                <label>Email</label>
                <input className="input mono" value={client.email} disabled />
              </div>
              <div className="field">
                <label htmlFor="zrnProfName">Имя для стаканчика</label>
                <input
                  id="zrnProfName"
                  className="input"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="zrnProfPhone">Телефон</label>
                <input
                  id="zrnProfPhone"
                  type="tel"
                  className="input mono"
                  value={profPhone}
                  onChange={(e) => setProfPhone(formatClientPhone(e.target.value))}
                />
              </div>
              <div className="field">
                <label htmlFor="zrnProfBar">Любимая кофейня</label>
                <select id="zrnProfBar" className="input" value={profBar} onChange={(e) => setProfBar(e.target.value)}>
                  {COFFEE_BARS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="zrnProfMilk">Любимое молоко</label>
                <select id="zrnProfMilk" className="input" value={profMilk} onChange={(e) => setProfMilk(e.target.value)}>
                  {MILK_OPTIONS.map((m) => (
                    <option key={m.label} value={m.label}>{m.label}</option>
                  ))}
                </select>
              </div>
              {profMsg.text && (
                <div className={`status-msg ${profMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                  {profMsg.text}
                </div>
              )}
              <button type="submit" className="btn btn--primary btn--sm" disabled={profBusy}>
                {profBusy ? 'Сохраняем...' : 'Сохранить профиль'}
              </button>
            </form>
          </div>

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 7 }}>
                <ShoppingBag size={16} color="var(--accent)" /> Мои заказы в баре
              </h3>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{orders.length}</span>
            </div>

            {ordersLoading ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Загружаем историю...</p>
            ) : orders.length === 0 ? (
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>У вас пока нет сохранённых предзаказов.</p>
            ) : (
              <div className="cab-list">
                {orders.map((ord) => {
                  const st = PICKUP_STATUS[ord.status] || PICKUP_STATUS.preparing;
                  const canRepeat = (ord.items || []).some((it) =>
                    menu.some((m) => m.id === it.itemId && m.available)
                  );
                  return (
                    <article key={ord.code} className="cab-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong className="mono">{ord.code}</strong>
                        <span className={`status-pill ${st.cls}`}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {ord.bar} &bull; {ord.readyIn} &bull; <strong className="mono">{formatRub(ord.total)}</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        {(ord.items || []).map((i) => `${i.title} ×${i.qty}`).join(', ')}
                      </div>
                      {canRepeat && (
                        <div>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => onRepeatOrder(ord.items || [])}
                          >
                            <RefreshCw size={12} /> Повторить заказ
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
