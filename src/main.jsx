import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/main.css';

document.addEventListener('contextmenu', (e) => {
  if (e.target && e.target.closest && e.target.closest('img, .hero-banner, .menu-card__media')) {
    e.preventDefault();
  }
});
document.addEventListener('dragstart', (e) => {
  if (e.target && e.target.closest && e.target.closest('img, .hero-banner, .menu-card__media')) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
