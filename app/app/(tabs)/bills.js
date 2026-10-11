import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useBills, useCategories } from '../../src/hooks/useApi';
import { COLORS, SIZES, SHADOWS } from '../../src/constants/theme';

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_FILTERS = [
  { key: '', label: 'All', emoji: '📋' },
  { key: 'unpaid', label: 'Unpaid', emoji: '⏳' },
  { key: 'paid', label: 'Paid', emoji: '✅' },
  { key: 'overdue', label: 'Overdue', emoji: '🚨' },
];

const STATUS_COLORS = {
  paid: COLORS.secondary,
  unpaid: COLORS.warning,
  overdue: COLORS.danger,
  cancelled: COLORS.textLight,
};

function BillCard({ bill, onPress, onMarkPaid }) {
  const statusColor = STATUS_COLORS[bill.status] || COLORS.textLight;
  return (
    <TouchableOpacity style={styles.billCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.billIcon, { backgroundColor: (bill.category_color || COLORS.primary) + '22' }]}>
        <Text style={styles.billEmoji}>{bill.category_icon || '📄'}</Text>
      </View>
      <View style={styles.billInfo}>
        <Text style={styles.billTitle} numberOfLines={1}>{bill.title}</Text>
        <Text style={styles.billMeta}>
          {bill.vendor || bill.category_name || 'Uncategorized'} · {formatDate(bill.bill_date)}
        </Text>
        {bill.due_date && bill.status === 'unpaid' && (
          <Text style={styles.billDue}>Due {formatDate(bill.due_date)}</Text>
        )}
      </View>
      <View style={styles.billRight}>
        <Text style={styles.billAmount}>{formatCurrency(bill.total_amount)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{bill.status}</Text>
        </View>
        {bill.status === 'unpaid' && (
          <TouchableOpacity
            style={styles.payBtn}
            onPress={(e) => { e.stopPropagation(); onMarkPaid(bill.id); }}
          >
            <Text style={styles.payBtnText}>Pay</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter, onAdd }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🧾</Text>
      <Text style={styles.emptyTitle}>
        {filter ? `No ${filter} bills` : 'No bills yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {filter ? `You have no ${filter} bills right now` : 'Add your first bill by scanning or manually entering it'}
      </Text>
      {!filter && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAdd}>
          <Text style={styles.emptyBtnText}>+ Add Bill</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function BillsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState(params.status || '');
  const [activeCat, setActiveCat] = useState('');
  const [sortBy, setSortBy] = useState('created_at');

  const { bills, loading, fetchBills, markPaid } = useBills();
  const { categories, fetchCategories } = useCategories();

  const load = useCallback(() => {
    fetchBills({
      status: activeStatus || undefined,
      category_id: activeCat || undefined,
      search: search || undefined,
      sort: sortBy,
      order: 'DESC',
    });
  }, [activeStatus, activeCat, search, sortBy]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleMarkPaid = useCallback(async (id) => {
    Alert.alert('Mark as Paid', 'Mark this bill as paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid', onPress: async () => {
          try {
            await markPaid(id);
            load();
          } catch (err) {
            Alert.alert('Error', err.message);
          }
        }
      },
    ]);
  }, [markPaid, load]);

  const totalAmount = bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 My Bills</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/bill/add')}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search bills, vendors..."
            placeholderTextColor={COLORS.textLight}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filters */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, activeStatus === f.key && styles.filterChipActive]}
            onPress={() => setActiveStatus(f.key)}
          >
            <Text style={styles.filterEmoji}>{f.emoji}</Text>
            <Text style={[styles.filterLabel, activeStatus === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary bar */}
      {bills.length > 0 && (
        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>{bills.length} bill{bills.length !== 1 ? 's' : ''}</Text>
          <Text style={styles.summaryTotal}>{formatCurrency(totalAmount)}</Text>
        </View>
      )}

      {/* Bills List */}
      <FlatList
        data={bills}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BillCard
            bill={item}
            onPress={() => router.push(`/bill/${item.id}`)}
            onMarkPaid={handleMarkPaid}
          />
        )}
        contentContainerStyle={[styles.listContent, bills.length === 0 && { flex: 1 }]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
          ) : (
            <EmptyState filter={activeStatus} onAdd={() => router.push('/bill/add')} />
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, paddingTop: 54, paddingBottom: 16, paddingHorizontal: SIZES.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  searchRow: { paddingHorizontal: SIZES.md, paddingTop: SIZES.md },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: SIZES.radiusSm, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: COLORS.text },
  clearSearch: { fontSize: 14, color: COLORS.textLight, padding: 4 },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, gap: 8,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  filterEmoji: { fontSize: 13 },
  filterLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterLabelActive: { color: COLORS.primary },

  summaryBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SIZES.md, paddingBottom: 8,
  },
  summaryText: { fontSize: 13, color: COLORS.textSecondary },
  summaryTotal: { fontSize: 14, fontWeight: '800', color: COLORS.text },

  listContent: { paddingHorizontal: SIZES.md, paddingBottom: 24 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  // Bill Card
  billCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: SIZES.radius, padding: SIZES.md, marginBottom: 10,
    ...SHADOWS.small, gap: 12,
  },
  billIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  billEmoji: { fontSize: 22 },
  billInfo: { flex: 1 },
  billTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  billMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  billDue: { fontSize: 11, color: COLORS.warning, marginTop: 2, fontWeight: '600' },
  billRight: { alignItems: 'flex-end', gap: 4 },
  billAmount: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  payBtn: {
    backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  payBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Empty State
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60, paddingHorizontal: SIZES.lg },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  emptyBtn: {
    marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
