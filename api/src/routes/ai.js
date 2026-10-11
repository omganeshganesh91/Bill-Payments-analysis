const express = require('express');
const { db, find, findOne } = require('../database/init');

const router = express.Router();

// ─── helpers ──────────────────────────────────────────────────
function monthKey(dateStr) {
  return dateStr ? dateStr.substring(0, 7) : null; // "2025-03"
}
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split('T')[0].substring(0, 7);
}
function todayStr() { return new Date().toISOString().split('T')[0]; }

// ─── 1. Bill DNA — category auto-detect from title/vendor ─────
router.post('/bill-dna', async (req, res) => {
  try {
    const { title = '', vendor = '', amount = 0 } = req.body;
    const text = `${title} ${vendor}`.toLowerCase();
    const categories = await find(db.categories);

    const rules = [
      { keywords: ['electricity','bescom','mseb','tneb','power','current bill','units'], name: 'Electricity' },
      { keywords: ['water','bwssb','jal','municipal water'],                            name: 'Water' },
      { keywords: ['grocery','supermarket','big bazaar','dmart','reliance fresh','kirana','vegetables'], name: 'Grocery' },
      { keywords: ['rent','house rent','flat rent','pg rent','landlord'],               name: 'Rent' },
      { keywords: ['internet','broadband','airtel fiber','jio fiber','bsnl broadband'], name: 'Internet' },
      { keywords: ['mobile','recharge','airtel','jio','vodafone','bsnl','sim'],         name: 'Mobile' },
      { keywords: ['restaurant','food','zomato','swiggy','dining','hotel','cafe'],      name: 'Food & Dining' },
      { keywords: ['petrol','fuel','cab','uber','ola','auto','bus','metro','transport'], name: 'Transport' },
      { keywords: ['hospital','clinic','pharmacy','medicine','doctor','medical','health'], name: 'Medical' },
      { keywords: ['insurance','policy','premium','lic','term plan'],                  name: 'Insurance' },
      { keywords: ['school','college','tuition','coaching','education','fees'],        name: 'Education' },
      { keywords: ['amazon','flipkart','shopping','mall','purchase','clothes'],        name: 'Shopping' },
      { keywords: ['netflix','hotstar','prime','spotify','movie','entertainment'],     name: 'Entertainment' },
    ];

    let matched = null;
    for (const rule of rules) {
      if (rule.keywords.some(k => text.includes(k))) {
        matched = categories.find(c => c.name === rule.name);
        break;
      }
    }

    // If no keyword match, learn from past bills with same vendor
    if (!matched) {
      const pastBills = await find(db.bills);
      const vendorBills = pastBills.filter(b =>
        b.vendor && vendor && b.vendor.toLowerCase().includes(vendor.toLowerCase().split(' ')[0])
        && b.category_id
      );
      if (vendorBills.length > 0) {
        const freq = {};
        for (const b of vendorBills) freq[b.category_id] = (freq[b.category_id] || 0) + 1;
        const topCatId = Object.entries(freq).sort((a,b) => b[1]-a[1])[0][0];
        matched = categories.find(c => c.id === topCatId);
      }
    }

    res.json({
      success: true,
      data: {
        suggested_category: matched || categories.find(c => c.name === 'Other'),
        confidence: matched ? (matched.name === 'Other' ? 60 : 92) : 50,
        method: matched ? 'keyword_match' : 'default',
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 2. Anomaly Detection ─────────────────────────────────────
router.get('/anomalies', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const anomalies = [];

    // Group bills by category
    const byCat = {};
    for (const b of bills) {
      if (!b.category_id || !b.bill_date || b.status === 'cancelled') continue;
      if (!byCat[b.category_id]) byCat[b.category_id] = [];
      byCat[b.category_id].push(b);
    }

    const categories = await find(db.categories);

    for (const [catId, catBills] of Object.entries(byCat)) {
      if (catBills.length < 2) continue;
      const cat = categories.find(c => c.id === catId);
      catBills.sort((a, b) => b.bill_date.localeCompare(a.bill_date));
      const latest = catBills[0];
      const previous = catBills.slice(1, 4);
      const avgPrev = previous.reduce((s, b) => s + b.total_amount, 0) / previous.length;

      if (avgPrev > 0) {
        const changePct = ((latest.total_amount - avgPrev) / avgPrev) * 100;
        if (changePct > 30) {
          anomalies.push({
            type: 'spike',
            severity: changePct > 60 ? 'high' : 'medium',
            category: cat?.name || 'Unknown',
            category_icon: cat?.icon || '📄',
            category_color: cat?.color || '#6366f1',
            bill_id: latest.id,
            bill_title: latest.title,
            current_amount: latest.total_amount,
            avg_amount: Math.round(avgPrev),
            change_pct: Math.round(changePct),
            message: `${cat?.icon} ${cat?.name} bill jumped ${Math.round(changePct)}% — ₹${Math.round(avgPrev).toLocaleString('en-IN')} avg vs ₹${latest.total_amount.toLocaleString('en-IN')} now`,
          });
        }
      }

      // Duplicate detection — same amount within 7 days
      for (let i = 0; i < catBills.length - 1; i++) {
        const a = catBills[i], b = catBills[i+1];
        const daysDiff = Math.abs(new Date(a.bill_date) - new Date(b.bill_date)) / 86400000;
        if (daysDiff <= 7 && Math.abs(a.total_amount - b.total_amount) < 1) {
          anomalies.push({
            type: 'duplicate',
            severity: 'high',
            category: cat?.name,
            category_icon: cat?.icon,
            bill_id: a.id,
            bill_title: a.title,
            current_amount: a.total_amount,
            message: `⚠️ Possible duplicate: "${a.title}" — same amount ₹${a.total_amount} appears twice within 7 days`,
          });
        }
      }
    }

    res.json({ success: true, data: anomalies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 3. Negotiation Coach ─────────────────────────────────────
router.get('/negotiation-coach', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const categories = await find(db.categories);
    const tips = [];

    // Bills with 6+ months of history — good for negotiation
    const negotiableCategories = ['Internet', 'Mobile', 'Insurance', 'Entertainment'];
    for (const catName of negotiableCategories) {
      const cat = categories.find(c => c.name === catName);
      if (!cat) continue;
      const catBills = bills.filter(b => b.category_id === cat.id && b.status !== 'cancelled');
      if (catBills.length >= 3) {
        const totalSpent = catBills.reduce((s, b) => s + b.total_amount, 0);
        const months = catBills.length;
        const scripts = {
          'Internet':      `"Hi, I've been your customer for ${months}+ months and spent ₹${totalSpent.toLocaleString('en-IN')} with you. I'm considering switching to a competitor who's offering a better deal. Can you offer me a retention discount or an upgrade at the same price?"`,
          'Mobile':        `"I've been on this plan for ${months} months. I see you have better plans for new customers. As a loyal customer, can you match that pricing for me?"`,
          'Insurance':     `"My policy is up for renewal. I've had no claims in ${months} months. Can you review my premium and offer a no-claim bonus discount?"`,
          'Entertainment': `"I've been a subscriber for ${months} months. I noticed you offer lower prices in annual plans. Can you switch me or offer a discount?"`,
        };
        tips.push({
          category: catName,
          category_icon: cat.icon,
          category_color: cat.color,
          months_tracked: months,
          total_spent: totalSpent,
          avg_monthly: Math.round(totalSpent / months),
          potential_saving_pct: 15,
          potential_saving_amount: Math.round((totalSpent / months) * 0.15),
          success_rate: catName === 'Internet' ? 73 : catName === 'Mobile' ? 68 : 55,
          script: scripts[catName],
          best_time: 'Call between 10 AM – 12 PM on weekdays for best results',
        });
      }
    }

    res.json({ success: true, data: tips });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 4. Predictive Forecasting ────────────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const categories = await find(db.categories);
    const forecasts = [];
    const now = new Date();

    // For each category with enough history, forecast next 3 months
    const byCat = {};
    for (const b of bills) {
      if (!b.category_id || !b.bill_date || b.status === 'cancelled') continue;
      if (!byCat[b.category_id]) byCat[b.category_id] = [];
      byCat[b.category_id].push(b);
    }

    for (const [catId, catBills] of Object.entries(byCat)) {
      if (catBills.length < 2) continue;
      const cat = categories.find(c => c.id === catId);
      const avg = catBills.reduce((s, b) => s + b.total_amount, 0) / catBills.length;
      const sorted = [...catBills].sort((a,b) => a.bill_date.localeCompare(b.bill_date));
      const recent3 = sorted.slice(-3).map(b => b.total_amount);
      const trend = recent3.length > 1 ? recent3[recent3.length-1] - recent3[0] : 0;
      const forecast1 = Math.max(0, Math.round(avg + trend * 0.3));

      const months = [];
      for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push({
          month: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
          predicted_amount: Math.max(0, Math.round(forecast1 + (trend * 0.1 * i))),
        });
      }

      forecasts.push({
        category: cat?.name,
        category_icon: cat?.icon,
        category_color: cat?.color,
        historical_avg: Math.round(avg),
        trend: trend > 50 ? 'rising' : trend < -50 ? 'falling' : 'stable',
        trend_pct: avg > 0 ? Math.round((trend / avg) * 100) : 0,
        next_3_months: months,
      });
    }

    // Total forecast
    const totalForecast = forecasts.length > 0
      ? forecasts.reduce((s, f) => s + (f.next_3_months[0]?.predicted_amount || 0), 0)
      : 0;

    res.json({ success: true, data: { forecasts, total_next_month: totalForecast } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 5. Bill Health Score ─────────────────────────────────────
router.get('/health-score', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const user  = await findOne(db.users, { id: 'default' });
    if (!bills.length) {
      return res.json({ success: true, data: { score: 0, grade: 'N/A', message: 'Add some bills to get your score', breakdown: [] } });
    }

    const today = todayStr();
    const nowDate = new Date();
    const monthStart = `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}-01`;

    // Factor 1: On-time payment rate (40 pts)
    const paidBills = bills.filter(b => b.status === 'paid' && b.due_date && b.paid_date);
    const onTime    = paidBills.filter(b => b.paid_date <= b.due_date).length;
    const onTimeRate = paidBills.length > 0 ? onTime / paidBills.length : 0;
    const onTimeScore = Math.round(onTimeRate * 40);

    // Factor 2: Budget adherence (30 pts)
    const budget = user?.monthly_budget || 0;
    const monthSpend = bills
      .filter(b => b.bill_date >= monthStart && b.status !== 'cancelled')
      .reduce((s, b) => s + b.total_amount, 0);
    const budgetScore = budget > 0
      ? Math.round(Math.max(0, (1 - Math.max(0, monthSpend - budget) / budget)) * 30)
      : 15; // neutral if no budget set

    // Factor 3: No overdue bills (20 pts)
    const overdue = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled' && b.due_date && b.due_date < today).length;
    const overdueScore = Math.max(0, 20 - overdue * 5);

    // Factor 4: Tracking consistency (10 pts) — more bills tracked = better
    const consistencyScore = Math.min(10, bills.length);

    const totalScore = onTimeScore + budgetScore + overdueScore + consistencyScore;
    const grade = totalScore >= 85 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 55 ? 'C' : totalScore >= 40 ? 'D' : 'F';
    const emoji = { A: '🏆', B: '⭐', C: '📈', D: '⚠️', F: '🚨' }[grade];

    const tips = {
      A: 'Excellent! You have outstanding bill management. Keep it up!',
      B: 'Good job! A few improvements can get you to A grade.',
      C: 'Average. Focus on paying bills on time to improve your score.',
      D: 'Needs work. You have overdue bills — pay them to improve.',
      F: 'Critical. Multiple overdue bills detected. Act immediately.',
    };

    res.json({
      success: true,
      data: {
        score: totalScore,
        grade,
        emoji,
        message: tips[grade],
        breakdown: [
          { label: 'On-Time Payments', score: onTimeScore, max: 40, detail: `${onTime}/${paidBills.length} paid on time` },
          { label: 'Budget Adherence', score: budgetScore, max: 30, detail: budget > 0 ? `₹${Math.round(monthSpend).toLocaleString('en-IN')} of ₹${budget.toLocaleString('en-IN')} budget` : 'Set a budget to improve this score' },
          { label: 'No Overdue Bills', score: overdueScore, max: 20, detail: overdue === 0 ? 'No overdue bills 🎉' : `${overdue} overdue bill${overdue > 1 ? 's' : ''}` },
          { label: 'Tracking Streak',  score: consistencyScore, max: 10, detail: `${bills.length} bills tracked` },
        ],
        streak: onTime,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 6. Tax Buckets ───────────────────────────────────────────
router.get('/tax-buckets', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const categories = await find(db.categories);
    const year = parseInt(req.query.year || new Date().getFullYear());

    const taxRules = {
      'Medical':   { section: '80D', label: 'Medical Insurance / Health', deductible: true, limit: 25000 },
      'Education': { section: '80E', label: 'Education Loan Interest',    deductible: true, limit: null },
      'Rent':      { section: 'HRA', label: 'House Rent Allowance',       deductible: true, limit: null },
      'Insurance': { section: '80C', label: 'Life Insurance Premium',     deductible: true, limit: 150000 },
    };

    const buckets = {};
    for (const b of bills) {
      if (!b.bill_date || !b.bill_date.startsWith(String(year))) continue;
      const cat = categories.find(c => c.id === b.category_id);
      if (!cat) continue;
      const rule = taxRules[cat.name];
      if (!rule) continue;

      if (!buckets[cat.name]) {
        buckets[cat.name] = { ...rule, category: cat.name, icon: cat.icon, color: cat.color, bills: [], total: 0 };
      }
      buckets[cat.name].bills.push({ id: b.id, title: b.title, amount: b.total_amount, date: b.bill_date });
      buckets[cat.name].total += b.total_amount;
    }

    const result = Object.values(buckets).map(b => ({
      ...b,
      eligible_amount: b.limit ? Math.min(b.total, b.limit) : b.total,
      over_limit: b.limit ? Math.max(0, b.total - b.limit) : 0,
    }));

    const totalDeductible = result.reduce((s, b) => s + b.eligible_amount, 0);

    res.json({ success: true, data: { buckets: result, total_deductible: totalDeductible, year } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 7. Warranty Tracker ─────────────────────────────────────
router.get('/warranties', async (req, res) => {
  try {
    const bills = await find(db.bills);
    const today = new Date();

    // Bills tagged with warranty info (tags array contains 'warranty')
    const warrantyBills = bills.filter(b =>
      Array.isArray(b.tags) && b.tags.some(t => typeof t === 'string' && t.toLowerCase().includes('warranty'))
      || (b.notes && b.notes.toLowerCase().includes('warranty'))
    );

    const warranties = warrantyBills.map(b => {
      // Try to extract warranty months from notes e.g. "warranty:12" or "1 year warranty"
      const monthsMatch = b.notes?.match(/(\d+)\s*(?:year|yr)/i);
      const months = monthsMatch ? parseInt(monthsMatch[1]) * 12 : 12;
      const purchaseDate = new Date(b.bill_date || b.created_at);
      const expiryDate   = new Date(purchaseDate);
      expiryDate.setMonth(expiryDate.getMonth() + months);
      const daysLeft = Math.ceil((expiryDate - today) / 86400000);

      return {
        bill_id: b.id,
        product: b.title,
        vendor: b.vendor,
        purchase_date: b.bill_date,
        expiry_date: expiryDate.toISOString().split('T')[0],
        warranty_months: months,
        days_left: daysLeft,
        status: daysLeft < 0 ? 'expired' : daysLeft <= 30 ? 'expiring_soon' : 'active',
        amount: b.total_amount,
      };
    });

    warranties.sort((a, b) => a.days_left - b.days_left);

    res.json({ success: true, data: warranties });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── 8. Family Split ─────────────────────────────────────────
router.post('/split', async (req, res) => {
  try {
    const { bill_id, members } = req.body;
    if (!bill_id || !members || members.length === 0) {
      return res.status(400).json({ success: false, error: 'bill_id and members required' });
    }
    const bill = await findOne(db.bills, { id: bill_id });
    if (!bill) return res.status(404).json({ success: false, error: 'Bill not found' });

    const perPerson = bill.total_amount / members.length;
    const splits = members.map(name => ({
      name,
      amount: Math.round(perPerson * 100) / 100,
      upi_link: `upi://pay?pa=user@upi&pn=${encodeURIComponent(name)}&am=${perPerson.toFixed(2)}&cu=INR&tn=${encodeURIComponent(bill.title)}`,
    }));

    res.json({
      success: true,
      data: { bill_title: bill.title, total: bill.total_amount, per_person: Math.round(perPerson), splits }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
