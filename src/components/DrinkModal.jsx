import React, { useEffect, useState } from 'react';
import { Coffee, Plus, X } from 'lucide-react';
import { MILK_OPTIONS, SYRUP_OPTIONS, VOLUME_OPTIONS, formatRub, resolveAssetUrl } from '../api';

export default function DrinkModal({ item, onClose, onAdd }) {
  const [volume, setVolume] = useState(VOLUME_OPTIONS[0].label);
  const [milk, setMilk] = useState(MILK_OPTIONS[0].label);
  const [syrup, setSyrup] = useState(SYRUP_OPTIONS[0].label);

  useEffect(() => {
    setVolume(VOLUME_OPTIONS[0].label);
    setMilk(MILK_OPTIONS[0].label);
    setSyrup(SYRUP_OPTIONS[0].label);
  }, [item]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const vFee = item.customizable ? VOLUME_OPTIONS.find((x) => x.label === volume)?.fee || 0 : 0;
  const mFee = item.customizable ? MILK_OPTIONS.find((x) => x.label === milk)?.fee || 0 : 0;
  const sFee = item.customizable ? SYRUP_OPTIONS.find((x) => x.label === syrup)?.fee || 0 : 0;
  const totalPrice = item.price + vFee + mFee + sFee;

  function handleConfirm() {
    onAdd(
      item,
      totalPrice,
      item.customizable ? { volume, milk, syrup } : null
    );
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={item.title}>
        <div className="modal-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Coffee size={17} color="var(--accent)" />
            <h3 style={{ fontSize: '1.08rem' }}>{item.title}</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="drink-modal-hero">
          <img src={resolveAssetUrl(item.image)} alt={item.title} draggable={false} />
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{item.description}</p>

        {item.customizable && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>Объём стакана</label>
              <div className="opt-grid">
                {VOLUME_OPTIONS.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    className={`opt-chip ${volume === v.label ? 'is-active' : ''}`}
                    onClick={() => setVolume(v.label)}
                  >
                    <span>{v.label}</span>
                    {v.fee > 0 && <small className="mono">+{v.fee} ₽</small>}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Молоко</label>
              <div className="opt-grid">
                {MILK_OPTIONS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    className={`opt-chip ${milk === m.label ? 'is-active' : ''}`}
                    onClick={() => setMilk(m.label)}
                  >
                    <span>{m.label}</span>
                    {m.fee > 0 && <small className="mono">+{m.fee} ₽</small>}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Сироп</label>
              <div className="opt-grid">
                {SYRUP_OPTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    className={`opt-chip ${syrup === s.label ? 'is-active' : ''}`}
                    onClick={() => setSyrup(s.label)}
                  >
                    <span>{s.label}</span>
                    {s.fee > 0 && <small className="mono">+{s.fee} ₽</small>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button type="button" className="btn btn--primary" onClick={handleConfirm}>
          <Plus size={16} /> Добавить за {formatRub(totalPrice)}
        </button>
      </div>
    </div>
  );
}
