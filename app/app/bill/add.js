import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBills, useCategories } from '../../src/hooks/useApi';
import { COLORS, SIZES, SHADOWS } from '../../src/constants/theme';

export default function AddBillScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEdit = Boolean(params.edit);

  const { createBill, updateBill, getBill } = useBills();
  const { categories, fetchCategories } = useCategories();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [form, setForm] = useState({
    title: '',
    vendor: '',
    amount: '',
    tax_amount: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    paid_date: '',
    category_id: '',
    status: 'unpaid',
    payment_method: '',
    notes: '',
    is_recurring: false,
    recurrence: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  useEffect(() => {
    fetchCategories();
    if (isEdit && params.edit) {
      getBill(params.edit).then(data => {
        if (data) {
          setForm({
            title: data.title || '',
            vendor: data.vendor || '',
            amount: String(data.amount || ''),
            tax_amount: String(data.tax_amount || ''),
            bill_date: data.bill_date || new Date().toISOString().split('T')[0],
            due_date: data.due_date || '',
            paid_date: data.paid_date || '',
            category_id: data.category_id || '',
            status: data.status || 'unpaid',
            payment_method: data.payment_method || '',
            notes: data.notes || '',
            is_recurring: Boolean(data.is_recurring),
            recurrence: data.recurrence || '',
          });
        }
        setLoading(false);
      });
    }
  }, []);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }
    if (!form.amount || isNaN(parseFloat(form.amount))) {
      Alert.alert('Validation', 'Please enter a valid amount');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        tax_amount: parseFloat(form.tax_amount || 0),
        is_recurring: form.is_recurring ? 1 : 0,
      };

      if (isEdit) {
        await updateBill(params.edit, payload);
        Alert.alert('✅ Updated', 'Bill updated successfully', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      } else {
        const newBill = await createBill(payload);
        Alert.alert('✅ Saved', 'Bill added successfully', [
          { text: 'View Bills', onPress: () => router.push('/(tabs)/bills') },
          { text: 'Add Another', onPress: () => {
            setForm({ title: '', vendor: '', amount: '', tax_amount: '', bill_date: new Date().toISOString().split('T')[0], due_date: '', paid_date: '', category_id: '', status: 'unpaid', payment_method: '', notes: '', is_recurring: false, recurrence: '' });
          }},
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.pageTitle}>{isEdit ? '✏️ Edit Bill' : '➕ Add New Bill'}</Text>

      {/* Basic Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={v => set('title', v)}
            placeholder="e.g. Electricity Bill March 2025"
            placeholderTextColor={COLORS.textLight}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Vendor / Provider</Text>
          <TextInput
            style={styles.input}
            value={form.vendor}
            onChangeText={v => set('vendor', v)}
            placeholder="e.g. BESCOM, Big Bazaar"
            placeholderTextColor={COLORS.textLight}
          />
        </View>
      </View>

      {/* Amount */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amount</Text>
        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Amount (₹) *</Text>
            <TextInput
              style={styles.input}
              value={form.amount}
              onChangeText={v => set('amount', v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Tax / GST (₹)</Text>
            <TextInput
              style={styles.input}
              value={form.tax_amount}
              onChangeText={v => set('tax_amount', v)}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>
        {form.amount && form.tax_amount ? (
          <View style={styles.totalPreview}>
            <Text style={styles.totalPreviewText}>
              Total: ₹{(parseFloat(form.amount || 0) + parseFloat(form.tax_amount || 0)).toLocaleString('en-IN')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Dates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dates</Text>
        <View style={styles.row}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Bill Date</Text>
            <TextInput
              style={styles.input}
              value={form.bill_date}
              onChangeText={v => set('bill_date', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.label}>Due Date</Text>
            <TextInput
              style={styles.input}
              value={form.due_date}
              onChangeText={v => set('due_date', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>
      </View>

      {/* Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, form.category_id === cat.id && styles.catChipActive]}
              onPress={() => set('category_id', cat.id === form.category_id ? '' : cat.id)}
            >
              <Text style={styles.catChipEmoji}>{cat.icon}</Text>
              <Text style={[styles.catChipText, form.category_id === cat.id && styles.catChipTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.statusRow}>
          {['unpaid', 'paid', 'cancelled'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.statusChip, form.status === s && styles.statusChipActive]}
              onPress={() => set('status', s)}
            >
              <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>
                {s === 'unpaid' ? '⏳' : s === 'paid' ? '✅' : '❌'} {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {form.status === 'paid' && (
          <View style={[styles.fieldGroup, { marginTop: 12 }]}>
            <Text style={styles.label}>Paid Date</Text>
            <TextInput
              style={styles.input}
              value={form.paid_date}
              onChangeText={v => set('paid_date', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        )}
      </View>

      {/* Payment Method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['Cash', 'UPI', 'Card', 'Net Banking', 'Cheque', 'Auto-Debit'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.catChip, form.payment_method === m && styles.catChipActive]}
              onPress={() => set('payment_method', m === form.payment_method ? '' : m)}
            >
              <Text style={[styles.catChipText, form.payment_method === m && styles.catChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Recurring */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => set('is_recurring', !form.is_recurring)}
        >
          <View>
            <Text style={styles.toggleLabel}>🔄 Recurring Bill</Text>
            <Text style={styles.toggleSubtext}>Does this bill repeat monthly/yearly?</Text>
          </View>
          <View style={[styles.toggle, form.is_recurring && styles.toggleOn]}>
            <View style={[styles.toggleThumb, form.is_recurring && styles.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
        {form.is_recurring && (
          <View style={[styles.fieldGroup, { marginTop: 12 }]}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.statusRow}>
              {['Monthly', 'Quarterly', 'Yearly'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.catChip, form.recurrence === r && styles.catChipActive]}
                  onPress={() => set('recurrence', r)}
                >
                  <Text style={[styles.catChipText, form.recurrence === r && styles.catChipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={form.notes}
          onChangeText={v => set('notes', v)}
          placeholder="Additional notes..."
          placeholderTextColor={COLORS.textLight}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.submitBtnText}>{isEdit ? '💾 Update Bill' : '💾 Save Bill'}</Text>
        }
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SIZES.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  pageTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: SIZES.md },

  section: {
    backgroundColor: COLORS.card, borderRadius: SIZES.radius, padding: SIZES.md,
    marginBottom: SIZES.md, ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, marginBottom: SIZES.md, textTransform: 'uppercase' },
  fieldGroup: { marginBottom: SIZES.sm },
  row: { flexDirection: 'row', gap: SIZES.sm },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusSm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  textarea: { height: 80, textAlignVertical: 'top' },

  totalPreview: {
    backgroundColor: COLORS.primaryLight, padding: 10, borderRadius: SIZES.radiusSm, alignItems: 'center',
  },
  totalPreviewText: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },

  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.background, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1.5, borderColor: COLORS.border, marginRight: 8,
  },
  catChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catChipEmoji: { fontSize: 14 },
  catChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  catChipTextActive: { color: COLORS.primary },

  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  statusChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  statusChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'capitalize' },
  statusChipTextActive: { color: COLORS.primary },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  toggleSubtext: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  toggle: {
    width: 48, height: 26, borderRadius: 13, backgroundColor: COLORS.border,
    justifyContent: 'center', padding: 2,
  },
  toggleOn: { backgroundColor: COLORS.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', ...SHADOWS.small },
  toggleThumbOn: { alignSelf: 'flex-end' },

  submitBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 28,
    alignItems: 'center', ...SHADOWS.medium,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 17 },
});
