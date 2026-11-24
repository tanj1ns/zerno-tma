import React, { useEffect, useState } from 'react';

export function getCookie(name) {
  const safeName = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${safeName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name, value, maxAgeSec = 31536000) {
  const sec = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(String(value))}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${sec}`;
}

export function deleteCookie(name) {
  const sec = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${sec}`;
}

function readConsent(prefix) {
  const ck = getCookie(`${prefix}_cookie_consent`);
  if (ck === 'all' || ck === 'essential') return ck;
  try {
    const ls = localStorage.getItem(`${prefix}_cookie_consent`);
    return ls === 'all' || ls === 'essential' ? ls : '';
  } catch {
    return '';
  }
}

export default function CookieBanner({ prefix = 'zerno', forceOpen = false, onCloseForce, onOpenPrivacy, bottomOffset = false }) {
  const [savedConsent, setSavedConsent] = useState(() => readConsent(prefix));

  useEffect(() => {
    if (forceOpen) setSavedConsent('');
  }, [forceOpen]);

  if (!forceOpen && savedConsent) return null;

  function choose(mode) {
    const clean = mode === 'all' ? 'all' : 'essential';
    setCookie(`${prefix}_cookie_consent`, clean);
    try {
      localStorage.setItem(`${prefix}_cookie_consent`, clean);
    } catch {}
    if (clean === 'all') {
      setCookie(`${prefix}_prefs`, '1', 15552000);
    } else {
      deleteCookie(`${prefix}_prefs`);
    }
    setSavedConsent(clean);
    onCloseForce?.();
  }

  return (
    <aside
      className={`cookie-banner ${bottomOffset ? 'is-raised' : ''}`}
      role="region"
      aria-label="Уведомление об использовании файлов cookie"
    >
      <div className="cookie-banner__inner">
        <p className="cookie-banner__text">
          Мы используем файлы cookie (<span className="mono">HttpOnly</span>-сессия, тема и настройки заказа) согласно{' '}
          <button type="button" className="link-inline" onClick={onOpenPrivacy}>
            политике 152-ФЗ
          </button>.
        </p>
        <div className="cookie-banner__actions">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => choose('essential')}>
            Только необходимые
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => choose('all')}>
            Принять все
          </button>
        </div>
      </div>
    </aside>
  );
}
