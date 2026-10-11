require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initializeDatabase, db, find } = require('./database/init');

const billsRouter      = require('./routes/bills');
const categoriesRouter = require('./routes/categories');
const dashboardRouter  = require('./routes/dashboard');
const usersRouter      = require('./routes/users');
const aiRouter         = require('./routes/ai');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/bills',      billsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/users',      usersRouter);
app.use('/api/ai',         aiRouter);

// ─── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart Bill Scanner API running', timestamp: new Date().toISOString() });
});

// ─── DB Admin UI — visual table viewer ────────────────────────
app.get('/admin', async (req, res) => {
  try {
    const [bills, categories, users, bill_items] = await Promise.all([
      find(db.bills),
      find(db.categories),
      find(db.users),
      find(db.bill_items),
    ]);

    const table = (title, emoji, data, cols) => {
      if (!data.length) return `<h2>${emoji} ${title} <span class="badge">0 records</span></h2><p class="empty">No records yet.</p>`;
      const headers = cols.map(c => `<th>${c}</th>`).join('');
      const rows = data.map(row =>
        `<tr>${cols.map(c => `<td>${row[c] !== undefined && row[c] !== null ? String(row[c]).substring(0, 80) : '<span class="null">—</span>'}</td>`).join('')}</tr>`
      ).join('');
      return `
        <h2>${emoji} ${title} <span class="badge">${data.length} record${data.length !== 1 ? 's' : ''}</span></h2>
        <div class="table-wrap">
          <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
        </div>`;
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Smart Bill Scanner — DB Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #0f172a; }
    header { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; padding: 24px 32px; }
    header h1 { font-size: 24px; font-weight: 800; }
    header p  { font-size: 13px; opacity: 0.75; margin-top: 4px; }
    nav { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 32px; display: flex; gap: 0; }
    nav a { padding: 14px 20px; font-size: 13px; font-weight: 600; text-decoration: none; color: #64748b; border-bottom: 3px solid transparent; }
    nav a:hover { color: #6366f1; border-bottom-color: #6366f1; }
    main { padding: 28px 32px; max-width: 1400px; }
    h2 { font-size: 18px; font-weight: 800; margin: 28px 0 12px; display: flex; align-items: center; gap: 10px; }
    .badge { background: #6366f1; color: #fff; font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 700; }
    .table-wrap { overflow-x: auto; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; }
    thead { background: #f8fafc; }
    th { padding: 11px 14px; text-align: left; font-weight: 700; color: #475569; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    tr:hover td { background: #f8fafc; }
    .null { color: #cbd5e1; }
    .empty { color: #94a3b8; font-size: 14px; padding: 16px 0; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
    .stat { background: #fff; border-radius: 12px; padding: 20px 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); flex: 1; min-width: 160px; }
    .stat-val { font-size: 32px; font-weight: 900; color: #6366f1; }
    .stat-lbl { font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 600; }
    .refresh { float: right; background: #6366f1; color: #fff; border: none; padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; }
    .api-links { background: #fff; border-radius: 12px; padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); margin-top: 28px; }
    .api-links h3 { font-size: 14px; color: #64748b; margin-bottom: 12px; font-weight: 700; text-transform: uppercase; }
    .api-links a { display: inline-block; margin: 4px 8px 4px 0; padding: 6px 14px; background: #f1f5f9; border-radius: 8px; font-size: 12px; font-weight: 600; color: #6366f1; text-decoration: none; }
    .api-links a:hover { background: #e0e7ff; }
  </style>
</head>
<body>
<header>
  <h1>🧾 Smart Bill Scanner — DB Admin</h1>
  <p>Live database viewer · Auto-updates on refresh · ${new Date().toLocaleString('en-IN')}</p>
</header>
<nav>
  <a href="/admin">📊 Overview</a>
  <a href="/api/health">❤️ Health</a>
  <a href="/api/bills">📋 Bills API</a>
  <a href="/api/categories">🗂️ Categories API</a>
  <a href="/api/dashboard/summary">📈 Dashboard API</a>
</nav>
<main>
  <a class="refresh" href="/admin">🔄 Refresh</a>

  <div class="stats">
    <div class="stat"><div class="stat-val">${bills.length}</div><div class="stat-lbl">Total Bills</div></div>
    <div class="stat"><div class="stat-val">${bills.filter(b=>b.status==='unpaid').length}</div><div class="stat-lbl">Unpaid Bills</div></div>
    <div class="stat"><div class="stat-val">${bills.filter(b=>b.status==='paid').length}</div><div class="stat-lbl">Paid Bills</div></div>
    <div class="stat"><div class="stat-val">${categories.length}</div><div class="stat-lbl">Categories</div></div>
    <div class="stat"><div class="stat-val">₹${bills.reduce((s,b)=>s+(b.total_amount||0),0).toLocaleString('en-IN',{maximumFractionDigits:0})}</div><div class="stat-lbl">Total Value</div></div>
  </div>

  ${table('Bills', '📋', bills, ['id','title','vendor','amount','tax_amount','total_amount','status','category_id','bill_date','due_date','paid_date','payment_method','created_at'])}
  ${table('Categories', '🗂️', categories, ['id','name','icon','color','budget_limit','created_at'])}
  ${table('Users', '👤', users, ['id','name','email','monthly_budget','currency','created_at','updated_at'])}
  ${table('Bill Items', '🧾', bill_items, ['id','bill_id','name','quantity','unit_price','total_price','created_at'])}

  <div class="api-links">
    <h3>🔗 Quick API Links</h3>
    <a href="/api/health" target="_blank">Health Check</a>
    <a href="/api/bills" target="_blank">GET /bills</a>
    <a href="/api/categories" target="_blank">GET /categories</a>
    <a href="/api/dashboard/summary" target="_blank">Dashboard Summary</a>
    <a href="/api/dashboard/analytics" target="_blank">Analytics</a>
    <a href="/api/users/me" target="_blank">User Profile</a>
  </div>
</main>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
  }
});

// ─── 404 + error handlers ─────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  API running      → http://localhost:${PORT}/api/health`);
    console.log(`🖥️   DB Admin UI      → http://localhost:${PORT}/admin`);
    console.log(`📋  Bills API        → http://localhost:${PORT}/api/bills`);
    console.log(`📊  Dashboard API    → http://localhost:${PORT}/api/dashboard/summary\n`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});

module.exports = app;
