import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import api from '../../src/config/api';
import { COLORS, SIZES, SHADOWS } from '../../src/constants/theme';

export default function ProfileScreen() {
  const [user, setUser] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data);
      setForm(res.data);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  const handleSave = async () => {
    if (!form.name) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put('/users/me', {
        name: form.name,
        email: form.email,
        monthly_budget: parseFloat(form.monthly_budget) || 0,
        currency: form.currency || 'INR',
      });
      setUser(res.data);
      setEditing(false);
      Alert.alert('✅ Saved', 'Profile updated successfully');
    } catch (err) {
      Alert.alert('Error', err.message);
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

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'My Account'}</Text>
        <Text style={styles.userEmail}>{user?.email || ''}</Text>
      </View>

      {/* Settings Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>⚙️ Account Settings</Text>
          {!editing ? (
            <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setForm(user); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="Your name"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.name}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={v => set('email', v)}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.fieldValue}>{user?.email || '—'}</Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Monthly Budget (₹)</Text>
          {editing ? (
            <TextInput
              style={styles.input}
              value={String(form.monthly_budget || '')}
              onChangeText={v => set('monthly_budget', v)}
              keyboardType="numeric"
              placeholder="e.g. 30000"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.fieldValue}>
              ₹{Number(user?.monthly_budget || 0).toLocaleString('en-IN')}
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Currency</Text>
          {editing ? (
            <View style={styles.chipRow}>
              {['INR', 'USD', 'EUR', 'GBP'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, form.currency === c && styles.chipActive]}
                  onPress={() => set('currency', c)}
                >
                  <Text style={[styles.chipText, form.currency === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.fieldValue}>{user?.currency || 'INR'}</Text>
          )}
        </View>

        {editing && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>💾 Save Changes</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* About Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ℹ️ About</Text>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>App Version</Text>
          <Text style={styles.aboutValue}>1.0.0</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Database</Text>
          <Text style={styles.aboutValue}>SQLite (Local)</Text>
        </View>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Privacy</Text>
          <Text style={styles.aboutValue}>On-Device Storage</Text>
        </View>
      </View>

      {/* Features list */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>✨ Features</Text>
        {[
          '📷 Bill scanning with OCR',
          '💰 Automatic data extraction',
          '📊 Spending analytics & insights',
          '⏰ Due date reminders',
          '🗂️ Category management',
          '📈 Monthly trend tracking',
          '🧾 Receipt & bill archive',
        ].map((f, i) => (
          <Text key={i} style={styles.featureItem}>{f}</Text>
        ))}
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  header: {
    backgroundColor: COLORS.primary, alignItems: 'center',
    paddingTop: 54, paddingBottom: 28, paddingHorizontal: SIZES.md,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', marginBottom: 12,
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: '800' },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  card: {
    backgroundColor: COLORS.card, borderRadius: SIZES.radius, padding: SIZES.md,
    margin: SIZES.md, marginBottom: 0, ...SHADOWS.small,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  editBtn: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  editBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  cancelBtn: { backgroundColor: COLORS.borderLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  cancelBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },

  fieldGroup: { marginBottom: SIZES.md },
  label: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase' },
  fieldValue: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  input: {
    backgroundColor: COLORS.background, borderRadius: SIZES.radiusSm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border,
  },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  saveBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 24,
    alignItems: 'center', marginTop: SIZES.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  aboutLabel: { fontSize: 14, color: COLORS.textSecondary },
  aboutValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  featureItem: { fontSize: 14, color: COLORS.text, paddingVertical: 5, lineHeight: 22 },
});
