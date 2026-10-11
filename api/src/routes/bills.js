const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, find, findOne, insert, update, remove } = require('../database/init');

const router = express.Router();

function withCategory(bill, categories) {
  const cat = categories.find(c => c.id === bill.category_id);
  return {
    ...bill,
    category_name:  cat?.name  || null,
    category_icon:  cat?.icon  || null,
    category_color: cat?.color || null,
  };
}

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const { status, category_id, search, from_date, to_date, sort = 'created_at', order = 'DESC', page = 1, limit = 20 } = req.query;

    let bills = await find(db.bills);
    const categories = await find(db.categories);

    if (status)      bills = bills.filter(b => b.status === status);
    if (category_id) bills = bills.filter(b => b.category_id === category_id);
    if (from_date)   bills = bills.filter(b => b.bill_date >= from_date);
    if (to_date)     bills = bills.filter(b => b.bill_date <= to_date);
    if (search) {
      const s = search.toLowerCase();
      bills = bills.filter(b =>
        (b.title  || '').toLowerCase().includes(s) ||
        (b.vendor || '').toLowerCase().includes(s) ||
        (b.notes  || '').toLowerCase().includes(s)
      );
    }

    // Sort
    bills.sort((a, b) => {
      const va = a[sort] || '';
      const vb = b[sort] || '';
      return order.toUpperCase() === 'ASC' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    // Paginate
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paged = bills.slice(offset, offset + parseInt(limit));
    const result = paged.map(b => withCategory(b, categories));

    res.json({ success: true, data: result, page: parseInt(page), limit: parseInt(limit), total: bills.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bills/:id
router.get('/:id', async (req, res) => {
  try {
    const bill = await findOne(db.bills, { id: req.params.id });
    if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });

    const categories = await find(db.categories);
    const items      = await find(db.bill_items, { bill_id: req.params.id });

    res.json({ success: true, data: { ...withCategory(bill, categories), items } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bills
router.post('/', async (req, res) => {
  try {
    const {
      category_id, title, vendor, amount = 0, tax_amount = 0,
      bill_date, due_date, status = 'unpaid', payment_method,
      notes, image_uri, scanned_text, is_recurring = 0,
      recurrence, tags = [], items = []
    } = req.body;

    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

    const id = uuidv4();
    const now = new Date().toISOString();
    const total_amount = parseFloat(amount) + parseFloat(tax_amount);

    const doc = {
      id, category_id, title, vendor,
      amount: parseFloat(amount), tax_amount: parseFloat(tax_amount), total_amount,
      bill_date, due_date, paid_date: null, status, payment_method,
      notes, image_uri, scanned_text,
      is_recurring: is_recurring ? 1 : 0, recurrence,
      tags: Array.isArray(tags) ? tags : [],
      created_at: now, updated_at: now,
    };

    const newBill = await insert(db.bills, doc);

    if (items.length > 0) {
      for (const item of items) {
        await insert(db.bill_items, {
          id: uuidv4(), bill_id: id,
          name: item.name, quantity: item.quantity || 1,
          unit_price: item.unit_price || 0, total_price: item.total_price || 0,
          created_at: now,
        });
      }
    }

    res.status(201).json({ success: true, data: newBill });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/bills/:id
router.put('/:id', async (req, res) => {
  try {
    const existing = await findOne(db.bills, { id: req.params.id });
    if (!existing) return res.status(404).json({ success: false, error: 'Bill not found' });

    const { category_id, title, vendor, amount, tax_amount, bill_date, due_date, paid_date,
            status, payment_method, notes, image_uri, scanned_text, is_recurring, recurrence, tags } = req.body;

    const updated_amount = amount !== undefined ? parseFloat(amount) : existing.amount;
    const updated_tax    = tax_amount !== undefined ? parseFloat(tax_amount) : existing.tax_amount;

    const updated = {
      ...existing,
      category_id:    category_id    ?? existing.category_id,
      title:          title          ?? existing.title,
      vendor:         vendor         ?? existing.vendor,
      amount:         updated_amount,
      tax_amount:     updated_tax,
      total_amount:   updated_amount + updated_tax,
      bill_date:      bill_date      ?? existing.bill_date,
      due_date:       due_date       ?? existing.due_date,
      paid_date:      paid_date      ?? existing.paid_date,
      status:         status         ?? existing.status,
      payment_method: payment_method ?? existing.payment_method,
      notes:          notes          ?? existing.notes,
      image_uri:      image_uri      ?? existing.image_uri,
      scanned_text:   scanned_text   ?? existing.scanned_text,
      is_recurring:   is_recurring   ?? existing.is_recurring,
      recurrence:     recurrence     ?? existing.recurrence,
      tags:           tags           ?? existing.tags,
      updated_at:     new Date().toISOString(),
    };

    await update(db.bills, { id: req.params.id }, { $set: updated });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bills/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, paid_date } = req.body;
    const valid = ['unpaid', 'paid', 'overdue', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });

    await update(db.bills, { id: req.params.id }, {
      $set: {
        status,
        paid_date: paid_date || (status === 'paid' ? new Date().toISOString() : null),
        updated_at: new Date().toISOString(),
      }
    });
    res.json({ success: true, message: `Bill marked as ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bills/:id
router.delete('/:id', async (req, res) => {
  try {
    const bill = await findOne(db.bills, { id: req.params.id });
    if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });
    await remove(db.bills, { id: req.params.id });
    await remove(db.bill_items, { bill_id: req.params.id }, { multi: true });
    res.json({ success: true, message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
