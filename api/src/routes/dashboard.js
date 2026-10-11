const express = require('express');
const { db, find, findOne } = require('../database/init');

const router = express.Router();

function monthRange(year, month) {
  const start = `${year}-${String(month).padStart(2,'0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
  return { start, end };
}

function inRange(dateStr, start, end) {
  return dateStr && dateStr >= start && dateStr <= end;
}

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const now = new Date();
    const { start: monthStart, end: monthEnd } = monthRange(now.getFullYear(), now.getMonth() + 1);
    const todayStr = now.toISOString().split('T')[0];

    const allBills = await find(db.bills);
    const categories = await find(db.categories);
    const user = await findOne(db.users, { id: 'default' });

    const activeBills = allBills.filter(b => b.status !== 'cancelled');

    // This month spend
    const monthlyBills = activeBills.filter(b => inRange(b.bill_date, monthStart, monthEnd));
    const monthly_spent = monthlyBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Unpaid
    const unpaidBills = allBills.filter(b => b.status === 'unpaid');
    const unpaid_count = unpaidBills.length;
    const unpaid_total = unpaidBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Overdue
    const overdueBills = allBills.filter(b => ['unpaid','overdue'].includes(b.status) && b.due_date && b.due_date < todayStr);
    const overdue_count = overdueBills.length;
    const overdue_total = overdueBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Total bills
    const total_bills = allBills.length;

    // Upcoming (due in 7 days)
    const in7Days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0];
    const upcoming_bills = unpaidBills
      .filter(b => b.due_date && b.due_date >= todayStr && b.due_date <= in7Days)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5)
      .map(b => {
        const cat = categories.find(c => c.id === b.category_id);
        return { ...b, category_name: cat?.name, category_icon: cat?.icon, category_color: cat?.color };
      });

    // Spending by category this month
    const catMap = {};
    for (const b of monthlyBills) {
      const cat = categories.find(c => c.id === b.category_id) || { name: 'Other', icon: '📄', color: '#94a3b8' };
      const key = b.category_id || 'other';
      if (!catMap[key]) catMap[key] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0, count: 0 };
      catMap[key].total += b.total_amount || 0;
      catMap[key].count += 1;
    }
    const spending_by_category = Object.values(catMap).sort((a, b) => b.total - a.total);

    // 6-month trend
    const monthly_trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const { start, end } = monthRange(d.getFullYear(), d.getMonth() + 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const total = activeBills
        .filter(b => inRange(b.bill_date, start, end))
        .reduce((s, b) => s + (b.total_amount || 0), 0);
      monthly_trend.push({ month: label, total });
    }

    res.json({
      success: true,
      data: {
        monthly_spent, monthly_budget: user?.monthly_budget || 0,
        budget_remaining: (user?.monthly_budget || 0) - monthly_spent,
        unpaid_count, unpaid_total, overdue_count, overdue_total,
        total_bills, upcoming_bills, spending_by_category, monthly_trend,
        currency: user?.currency || 'INR'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/dashboard/analytics
router.get('/analytics', async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear());
    const allBills = await find(db.bills);
    const categories = await find(db.categories);
    const activeBills = allBills.filter(b => b.status !== 'cancelled');

    // Monthly breakdown
    const monthly_breakdown = [];
    for (let m = 1; m <= 12; m++) {
      const { start, end } = monthRange(year, m);
      const label = new Date(year, m - 1).toLocaleString('default', { month: 'short' });
      const monthBills = activeBills.filter(b => inRange(b.bill_date, start, end));
      monthly_breakdown.push({
        month: label, month_num: m,
        total: monthBills.reduce((s, b) => s + (b.total_amount || 0), 0),
        count: monthBills.length,
      });
    }

    // Top 5 categories
    const catMap = {};
    for (const b of activeBills) {
      const cat = categories.find(c => c.id === b.category_id);
      if (!cat) continue;
      if (!catMap[cat.id]) catMap[cat.id] = { name: cat.name, icon: cat.icon, color: cat.color, total: 0, count: 0 };
      catMap[cat.id].total += b.total_amount || 0;
      catMap[cat.id].count += 1;
    }
    const top_categories = Object.values(catMap).sort((a, b) => b.total - a.total).slice(0, 5);

    // Average monthly spend
    const monthTotals = monthly_breakdown.filter(m => m.total > 0).map(m => m.total);
    const avg_monthly_spend = monthTotals.length > 0 ? monthTotals.reduce((s, v) => s + v, 0) / monthTotals.length : 0;

    // Payment on-time stats
    const paidBills = allBills.filter(b => b.status === 'paid' && b.paid_date && b.due_date);
    const on_time = paidBills.filter(b => b.paid_date <= b.due_date).length;
    const late    = paidBills.filter(b => b.paid_date >  b.due_date).length;

    res.json({
      success: true,
      data: {
        year, monthly_breakdown, top_categories, avg_monthly_spend,
        payment_stats: { on_time, late, total: paidBills.length }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
