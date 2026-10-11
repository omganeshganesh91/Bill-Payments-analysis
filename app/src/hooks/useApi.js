import { useState, useCallback } from 'react';
import api from '../config/api';

// ─── Bills API ────────────────────────────────────────────────

export function useBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchBills = useCallback(async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/bills', { params });
      setBills(res.data);
      return res.data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createBill = useCallback(async (data) => {
    const res = await api.post('/bills', data);
    return res.data;
  }, []);

  const updateBill = useCallback(async (id, data) => {
    const res = await api.put(`/bills/${id}`, data);
    return res.data;
  }, []);

  const markPaid = useCallback(async (id) => {
    await api.patch(`/bills/${id}/status`, {
      status: 'paid',
      paid_date: new Date().toISOString()
    });
  }, []);

  const deleteBill = useCallback(async (id) => {
    await api.delete(`/bills/${id}`);
  }, []);

  const getBill = useCallback(async (id) => {
    const res = await api.get(`/bills/${id}`);
    return res.data;
  }, []);

  return { bills, loading, error, fetchBills, createBill, updateBill, markPaid, deleteBill, getBill };
}

// ─── Dashboard API ────────────────────────────────────────────

export function useDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/dashboard/summary');
      setSummary(res.data);
      return res.data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async (year) => {
    const res = await api.get('/dashboard/analytics', { params: { year } });
    return res.data;
  }, []);

  return { summary, loading, error, fetchSummary, fetchAnalytics };
}

// ─── Categories API ───────────────────────────────────────────

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  return { categories, loading, fetchCategories };
}
