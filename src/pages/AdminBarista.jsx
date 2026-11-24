import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, Plus, Shield } from 'lucide-react';
import { MENU_CATEGORIES, PICKUP_STATUS, formatRub, zernoApi } from '../api';

export default function AdminBarista({ user, menu, onUserChange, onRefresh, onExit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState('queue');
  const [orders, setOrders] = useState([]);
  const [msg, setMsg] = useState('');

  const [newItem, setNewItem] = useState({
    title: '',
    category: 'signature',
    price: 360,
    image: './uploads/latte-hero.webp',
    description: '',
    customizable: true
  });

  useEffect(() => {
    if (user) {
      zernoApi
        .getAdminOrders()
        .then((res) => setOrders(res.orders || []))
        .catch(() => {});
    }
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await zernoApi.login(email, password);
      onUserChange(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await zernoApi.logout();
    onUserChange(null);
  }

  async function handleStatusChange(orderId, status) {
    const res = await zernoApi.updateOrderStatus(orderId, status);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
    await onRefresh();
  }

  async function handleToggleStopList(item) {
    await zernoApi.toggleMenuAvailable(item.id, !item.available);
    setMsg(`Стоп-лист обновлён: ${item.title}`);
    await onRefresh();
  }

  async function handleAddMenu(e) {
    e.preventDefault();
    await zernoApi.addMenuItem(newItem);
    setNewItem({
      title: '',
      category: 'signature',
      price: 360,
      image: './uploads/latte-hero.webp',
      description: '',
      customizable: true
    });
    setMsg('Позиция добавлена в меню Mini App');
    await onRefresh();
  }

  if (!user) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span className="eyebrow" style={{ marginBottom: 0 }}>
            <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Кабинет бариста
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
            <ArrowLeft size={14} /> В меню
          </button>
        </div>
        <h2 style={{ fontSize: '1.22rem', marginBottom: 12 }}>Вход для смены ЗЕРНО</h2>
        <form onSubmit={handleLogin} className="form">
          <div className="field">
            <label>Email</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {authError && <div className="status-msg status-msg--err">{authError}</div>}
          <button type="submit" className="btn btn--primary" disabled={authLoading}>
            {authLoading ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <span className="eyebrow" style={{ marginBottom: 2 }}>Терминал выдачи</span>
          <h2 style={{ fontSize: '1.2rem' }}>Очередь и стоп-лист</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onExit}>
            <ArrowLeft size={14} /> К витрине
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'queue' ? 'is-active' : ''}`} onClick={() => setTab('queue')}>
          Заказы ({orders.length})
        </button>
        <button type="button" className={`tab ${tab === 'stoplist' ? 'is-active' : ''}`} onClick={() => setTab('stoplist')}>
          Меню и стоп-лист ({menu.length})
        </button>
      </div>

      {msg && <div className="status-msg status-msg--ok">{msg}</div>}

      {tab === 'queue' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map((ord) => {
            const st = PICKUP_STATUS[ord.status] || PICKUP_STATUS.preparing;
            return (
              <div key={ord.id} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <strong className="mono">{ord.code} &bull; {ord.readyIn}</strong>
                  <span className={`status-pill ${st.cls}`}>{st.label}</span>
                </div>
                <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                  {ord.bar} &bull; {ord.clientName} &bull; <span className="mono">{formatRub(ord.total)}</span>
                </div>
                <div style={{ fontSize: '0.82rem' }}>
                  {ord.items.map((i) => `${i.title} x${i.qty}`).join(', ')}
                </div>
                <select
                  className="input"
                  value={ord.status}
                  onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                >
                  <option value="preparing">Готовится</option>
                  <option value="ready">Ждёт на стойке</option>
                  <option value="picked_up">Выдан</option>
                </select>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <form onSubmit={handleAddMenu} className="panel form">
            <strong style={{ fontSize: '0.94rem' }}>Добавить позицию в меню</strong>
            <input
              className="input"
              placeholder="Название (например, Матча Тоник)"
              value={newItem.title}
              onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select
                className="input"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
              >
                {MENU_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
              <input
                type="number"
                className="input mono"
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                min="50"
                required
              />
            </div>
            <button type="submit" className="btn btn--primary btn--sm">
              <Plus size={14} /> Добавить
            </button>
          </form>

          {menu.map((m) => (
            <div key={m.id} className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <strong>{m.title}</strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span className="mono">{formatRub(m.price)}</span> &bull; {m.available ? 'В продаже' : 'В стоп-листе'}
                </div>
              </div>
              <button
                type="button"
                className={`btn btn--sm ${m.available ? 'btn--outline' : 'btn--primary'}`}
                onClick={() => handleToggleStopList(m)}
              >
                {m.available ? 'В стоп' : 'Вернуть'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
