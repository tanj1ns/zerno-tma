'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'zerno.db');

const DEFAULT_ADMIN_SCRYPT =
  '00332279144d859aed34222ba5a186ab:62d6b7393244b9bb78ae035780d70a127fef6bde677347bc494141dd5419d1de0698ee1f7b4ee2dd579ba71f3325985d364d2b7da68cfe25ab44d18837cd908a';

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      image TEXT NOT NULL,
      customizable INTEGER NOT NULL DEFAULT 1,
      available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS coffee_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      bonus_used INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      bar TEXT NOT NULL,
      ready_in TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'preparing',
      created_at TEXT NOT NULL
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const now = new Date().toISOString();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@zerno-coffee.ru').trim().toLowerCase();
  const adminHash = process.env.ADMIN_PASSWORD ? hashPassword(process.env.ADMIN_PASSWORD) : DEFAULT_ADMIN_SCRYPT;

  if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
    db.prepare('INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)').run(
      'Шеф-бариста ЗЕРНО',
      adminEmail,
      adminHash,
      'admin',
      now
    );
  }

  if (db.prepare('SELECT COUNT(*) AS cnt FROM menu_items').get().cnt === 0) {
    const stmt = db.prepare(
      'INSERT INTO menu_items (category, title, description, price, image, customizable, available, sort_order) VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
    );
    stmt.run('coffee', 'Флэт Уайт', 'Двойной эспрессо на бразильской арабике и тонко взбитое молоко.', 320, '/uploads/latte-hero.webp', 1, 1);
    stmt.run('coffee', 'Капучино Классик', 'Сбалансированная текстура молока с орехово-карамельным профилем зерна.', 290, '/uploads/latte-hero.webp', 1, 2);
    stmt.run('signature', 'Раф Солёная Карамель', 'Сливки 11%, морская соль и домашняя карамель собственной варки.', 390, '/uploads/latte-hero.webp', 1, 3);
    stmt.run('signature', 'Фильтр V60 Эфиопия', 'Чистая чашка ручного пролива с нотами бергамота, персика и жасмина.', 310, '/uploads/beans-pack.webp', 0, 4);
    stmt.run('pastry', 'Круассан на сливочном масле', 'Слоёная выпечка утреннего замеса 82,5% жирности с хрустящей корочкой.', 240, '/uploads/latte-hero.webp', 0, 5);
    stmt.run('beans', 'Зерно Эфиопия Сидамо 250 г', 'Светлая обжарка под фильтр и воронку, урожай 2026 года, цельное зерно.', 1150, '/uploads/beans-pack.webp', 0, 6);
  }

  if (db.prepare('SELECT COUNT(*) AS cnt FROM coffee_orders').get().cnt === 0) {
    const stmt = db.prepare(
      `INSERT INTO coffee_orders (code, items_json, subtotal, bonus_used, total, bar, ready_in, client_name, client_phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(
      'ZRN-412',
      JSON.stringify([{ itemId: 1, title: 'Флэт Уайт (350 мл, Овсяное)', qty: 1, price: 440 }]),
      440,
      0,
      440,
      'Покровка, 19',
      'Через 5 мин',
      'Антон К.',
      '+7 (916) 334-10-92',
      'ready',
      now
    );
    stmt.run(
      'ZRN-415',
      JSON.stringify([
        { itemId: 4, title: 'Фильтр V60 Эфиопия', qty: 1, price: 310 },
        { itemId: 5, title: 'Круассан на сливочном масле', qty: 1, price: 240 }
      ]),
      550,
      110,
      440,
      'Большая Никитская, 24',
      'Через 10 мин',
      'Лена С.',
      '+7 (926) 802-44-15',
      'preparing',
      now
    );
  }
}

module.exports = { initDatabase };
