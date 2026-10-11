const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, find, findOne, insert, update, remove } = require('../database/init');

const router = express.Router();

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await find(db.categories);
    // Sort by name
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // Attach bill count and total_spent for each category
    const bills = await find(db.bills);
    const result = categories.map(cat => {
      const catBills = bills.filter(b => b.category_id === cat.id);
      return {
        ...cat,
        bill_count: catBills.length,
        total_spent: catBills.reduce((s, b) => s + (b.total_amount || 0), 0),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const cat = await findOne(db.categories, { id: req.params.id });
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });
    res.json({ success: true, data: cat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/categories
router.post('/', async (req, res) => {
  try {
    const { name, icon = '📄', color = '#6366f1', budget_limit = 0 } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });

    const existing = await findOne(db.categories, { name });
    if (existing) return res.status(400).json({ success: false, error: 'Category name already exists' });

    const doc = { id: uuidv4(), name, icon, color, budget_limit, created_at: new Date().toISOString() };
    const newCat = await insert(db.categories, doc);
    res.status(201).json({ success: true, data: newCat });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/categories/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await findOne(db.categories, { id: req.params.id });
    if (!existing) return res.status(404).json({ success: false, error: 'Category not found' });

    const { name, icon, color, budget_limit } = req.body;
    const updated = {
      ...existing,
      name: name ?? existing.name,
      icon: icon ?? existing.icon,
      color: color ?? existing.color,
      budget_limit: budget_limit ?? existing.budget_limit,
    };
    await update(db.categories, { id: req.params.id }, { $set: updated });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', async (req, res) => {
  try {
    const cat = await findOne(db.categories, { id: req.params.id });
    if (!cat) return res.status(404).json({ success: false, error: 'Category not found' });
    await remove(db.categories, { id: req.params.id });
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
