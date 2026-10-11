const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_DIR = path.resolve('./src/database/data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Create datastores (one file per collection)
const db = {
  users:      new Datastore({ filename: path.join(DB_DIR, 'users.db'),      autoload: true }),
  categories: new Datastore({ filename: path.join(DB_DIR, 'categories.db'), autoload: true }),
  bills:      new Datastore({ filename: path.join(DB_DIR, 'bills.db'),      autoload: true }),
  bill_items: new Datastore({ filename: path.join(DB_DIR, 'bill_items.db'), autoload: true }),
};

// ─── Promise wrappers ─────────────────────────────────────────
const find  = (store, query = {}) => new Promise((res, rej) => store.find(query, (e, d) => e ? rej(e) : res(d)));
const findOne = (store, query)     => new Promise((res, rej) => store.findOne(query, (e, d) => e ? rej(e) : res(d)));
const insert = (store, doc)        => new Promise((res, rej) => store.insert(doc, (e, d) => e ? rej(e) : res(d)));
const update = (store, q, upd, opts = {}) => new Promise((res, rej) => store.update(q, upd, opts, (e, n) => e ? rej(e) : res(n)));
const remove = (store, q, opts = {})      => new Promise((res, rej) => store.remove(q, opts, (e, n) => e ? rej(e) : res(n)));
const count  = (store, q = {})    => new Promise((res, rej) => store.count(q, (e, n) => e ? rej(e) : res(n)));

// ─── Seed helpers ─────────────────────────────────────────────
async function seedCategories() {
  const categories = [
    { id: uuidv4(), name: 'Electricity',   icon: '⚡', color: '#f59e0b', budget_limit: 0 },
    { id: uuidv4(), name: 'Water',         icon: '💧', color: '#3b82f6', budget_limit: 0 },
    { id: uuidv4(), name: 'Grocery',       icon: '🛒', color: '#10b981', budget_limit: 0 },
    { id: uuidv4(), name: 'Rent',          icon: '🏠', color: '#8b5cf6', budget_limit: 0 },
    { id: uuidv4(), name: 'Internet',      icon: '📶', color: '#06b6d4', budget_limit: 0 },
    { id: uuidv4(), name: 'Mobile',        icon: '📱', color: '#ec4899', budget_limit: 0 },
    { id: uuidv4(), name: 'Food & Dining', icon: '🍽️', color: '#ef4444', budget_limit: 0 },
    { id: uuidv4(), name: 'Transport',     icon: '🚗', color: '#f97316', budget_limit: 0 },
    { id: uuidv4(), name: 'Medical',       icon: '🏥', color: '#14b8a6', budget_limit: 0 },
    { id: uuidv4(), name: 'Insurance',     icon: '🛡️', color: '#6366f1', budget_limit: 0 },
    { id: uuidv4(), name: 'Education',     icon: '📚', color: '#84cc16', budget_limit: 0 },
    { id: uuidv4(), name: 'Shopping',      icon: '🛍️', color: '#d946ef', budget_limit: 0 },
    { id: uuidv4(), name: 'Entertainment', icon: '🎬', color: '#f43f5e', budget_limit: 0 },
    { id: uuidv4(), name: 'Other',         icon: '📄', color: '#94a3b8', budget_limit: 0 },
  ];
  for (const cat of categories) {
    await insert(db.categories, { ...cat, created_at: new Date().toISOString() });
  }
  console.log('✅ Default categories seeded');
}

async function seedDefaultUser() {
  await insert(db.users, {
    id: 'default',
    name: 'My Account',
    email: 'user@example.com',
    monthly_budget: 30000,
    currency: 'INR',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  console.log('✅ Default user seeded');
}

// ─── Initialize ───────────────────────────────────────────────
async function initializeDatabase() {
  // Create indexes
  db.bills.ensureIndex({ fieldName: 'id', unique: true });
  db.categories.ensureIndex({ fieldName: 'id', unique: true });
  db.categories.ensureIndex({ fieldName: 'name', unique: true });
  db.users.ensureIndex({ fieldName: 'id', unique: true });
  db.bill_items.ensureIndex({ fieldName: 'id', unique: true });

  const catCount = await count(db.categories);
  if (catCount === 0) await seedCategories();

  const userCount = await count(db.users);
  if (userCount === 0) await seedDefaultUser();

  console.log('✅ Database initialized');
}

module.exports = { db, find, findOne, insert, update, remove, count, initializeDatabase };
