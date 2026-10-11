import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useBills } from '../../src/hooks/useApi';
import { COLORS, SIZES, SHADOWS } from '../../src/constants/theme';

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntilDue(dueDate) {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
}

const STATUS_COLORS = {
  paid: COLORS.secondary,
  unpaid: COLORS.warning,
  overdue: COLORS.danger,
  cancelled: COLORS.textLight,
};

function InfoRow({ label, value, valueColor }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { getBill, markPaid, deleteBill } = useBills();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getBill(id);
      setBill(data);
    } catch (err) {
      Alert.alert('Error', err.message, [{ text: 'Go Back', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const handleMarkPaid = async () => {
    if (bill.status === 'paid') return;
    Alert.alert('Mark as Paid', `Mark "${bill.title}" as paid today?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Paid', onPress: async () => {
          setActing(true);
          try {
            await markPaid(id);
            await load();
          } catch (err) {
            Alert.alert('Error', err.message);
          } finally {
            setActing(false);
          }
        }
      }
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Bill', 'This action cannot be undone. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setActing(true);
          try {
            await deleteBill(id);
            router.back();
          } catch (err) {
            Alert.alert('Error', err.message);
            setActing(false);
          }
        }
      }
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading bill...</Text>
      </View>
    );
  }

  if (!bill) return null;

  const statusColor = STATUS_COLORS[bill.status] || COLORS.textLight;
  const daysLeft = daysUntilDue(bill.due_date);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Top Hero Card */}
      <View style={[styles.heroCard, { borderTopColor: bill.category_color || COLORS.primary }]}>
        <View style={[styles.heroIcon, { backgroundColor: (bill.category_color || COLORS.primary) + '22' }]}>
          <Text style={styles.heroEmoji}>{bill.category_icon || '📄'}</Text>
        </View>
        <Text style={styles.heroTitle}>{bill.title}</Text>
        {bill.vendor && <Text style={styles.heroVendor}>{bill.vendor}</Text>}
        <Text style={styles.heroAmount}>{formatCurrency(bill.total_amount)}</Text>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{bill.status.toUpperCase()}</Text>
        </View>

        {/* Due date alert */}
        {bill.status === 'unpaid' && daysLeft !== null && (
          <View style={[styles.dueAlert, {
            backgroundColor: daysLeft <= 0 ? COLORS.dangerLight : daysLeft <= 3 ? COLORS.warningLight : COLORS.infoLight
          }]}>
            <Text style={[styles.dueAlertText, {
              color: daysLeft <= 0 ? COLORS.danger : daysLeft <= 3 ? COLORS.warning : COLORS.info
            }]}>
              {daysLeft <= 0 ? '🚨 Overdue!' : daysLeft === 1 ? '⚠️ Due Tomorrow!' : daysLeft <= 3 ? `⏰ Due in ${daysLeft} days` : `📅 Due in ${daysLeft} days`}
            </Text>
          </View>
        )}
      </View>

      {/* Amount Breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Amount Breakdown</Text>
        <InfoRow label="Base Amount" value={formatCurrency(bill.amount)} />
        {bill.tax_amount > 0 && (
          <InfoRow label="Tax / GST" value={formatCurrency(bill.tax_amount)} />
        )}
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { fontWeight: '700', color: COLORS.text }]}>Total Amount</Text>
          <Text style={[styles.infoValue, { fontSize: 18, fontWeight: '800', color: COLORS.primary }]}>
            {formatCurrency(bill.total_amount)}
          </Text>
        </View>
      </View>

      {/* Bill Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Bill Information</Text>
        <InfoRow label="Category" value={`${bill.category_icon || ''} ${bill.category_name || 'Uncategorized'}`} />
        <InfoRow label="Bill Date" value={formatDate(bill.bill_date)} />
        {bill.due_date && (
          <InfoRow
            label="Due Date"
            value={formatDate(bill.due_date)}
            valueColor={daysLeft !== null && daysLeft <= 3 ? COLORS.warning : undefined}
          />
        )}
        {bill.paid_date && (
          <InfoRow label="Paid On" value={formatDate(bill.paid_date)} valueColor={COLORS.secondary} />
        )}
        {bill.payment_method && (
          <InfoRow label="Payment Method" value={bill.payment_method} />
        )}
        {bill.is_recurring ? (
          <InfoRow label="Recurring" value={bill.recurrence || 'Yes'} />
        ) : null}
      </View>

      {/* Line Items */}
      {bill.items?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧾 Line Items</Text>
          {bill.items.map((item, i) => (
            <View key={item.id} style={[styles.itemRow, i < bill.items.length - 1 && styles.itemRowBorder]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.quantity > 1 && (
                  <Text style={styles.itemQty}>x{item.quantity} @ ₹{item.unit_price}</Text>
                )}
              </View>
              <Text style={styles.itemPrice}>{formatCurrency(item.total_price)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Notes */}
      {bill.notes ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📝 Notes</Text>
          <Text style={styles.notesText}>{bill.notes}</Text>
        </View>
      ) : null}

      {/* Tags */}
      {bill.tags?.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏷️ Tags</Text>
          <View style={styles.tagsRow}>
            {bill.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsCard}>
        {bill.status !== 'paid' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.payBtn, acting && styles.btnDisabled]}
            onPress={handleMarkPaid}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.payBtnText}>✅ Mark as Paid</Text>
            }
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionBtn, styles.editBtn]}
          onPress={() => router.push(`/bill/add?edit=${id}`)}
        >
          <Text style={styles.editBtnText}>✏️ Edit Bill</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.deleteBtn]}
          onPress={handleDelete}
          disabled={acting}
        >
          <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Metadata */}
      <Text style={styles.metaText}>
        Added {formatDate(bill.created_at)} · Last updated {formatDate(bill.updated_at)}
      </Text>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SIZES.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },

  card: {
    backgroundColor: COLORS.card, borderRadius: SIZES.radius,
    padding: SIZES.md, marginBottom: SIZES.md, ...SHADOWS.small,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary, marginBottom: SIZES.sm, textTransform: 'uppercase' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SIZES.sm },

  // Hero
  heroCard: {
    backgroundColor: COLORS.card, borderRadius: SIZES.radius, padding: SIZES.lg,
    marginBottom: SIZES.md, alignItems: 'center', ...SHADOWS.medium,
    borderTopWidth: 4,
  },
  heroIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  heroVendor: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  heroAmount: { fontSize: 36, fontWeight: '900', color: COLORS.text, marginVertical: 12 },
  statusBadge: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5,
  },
  statusText: { fontSize: 12, fontWeight: '800' },
  dueAlert: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  dueAlertText: { fontSize: 13, fontWeight: '700' },

  // Info rows
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },

  // Items
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemQty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  notesText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  tagText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },

  // Actions
  actionsCard: { gap: SIZES.sm, marginBottom: SIZES.md },
  actionBtn: { borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  payBtn: { backgroundColor: COLORS.secondary },
  payBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  editBtn: { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.primary },
  editBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  deleteBtn: { backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.danger },
  deleteBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },

  metaText: { textAlign: 'center', fontSize: 11, color: COLORS.textLight },
});
