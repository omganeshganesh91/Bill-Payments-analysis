const express = require('express');
const { db, findOne, update } = require('../database/init');

const router = express.Router();

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    const user = await findOne(db.users, { id: 'default' });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/me
router.put('/me', async (req, res) => {
  try {
    const existing = await findOne(db.users, { id: 'default' });
    if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

    const { name, email, monthly_budget, currency } = req.body;
    const updated = {
      ...existing,
      name: name ?? existing.name,
      email: email ?? existing.email,
      monthly_budget: monthly_budget !== undefined ? parseFloat(monthly_budget) : existing.monthly_budget,
      currency: currency ?? existing.currency,
      updated_at: new Date().toISOString(),
    };
    await update(db.users, { id: 'default' }, { $set: updated });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
