import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Animated, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDashboard } from '../../src/hooks/useApi';
import { COLORS, SIZES, SHADOWS, FONTS, rs, rf, SCREEN } from '../../src/constants/theme';

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

// ─── Animated fade-in wrapper ────────────────────────────────
function FadeIn({ delay = 0, children }) {
  const anim = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(anim,  { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 420, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Pulse animation for overdue ────────────────────────────
function PulseView({ color, children }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: anim }] }}>{children}</Animated.View>
  );
}

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ label, value, color, emoji, delay = 0, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const press  = () => { Animated.sequence([Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }), Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true })]).start(); if (onPress) onPress(); };
  return (
    <FadeIn delay={delay}>
      <TouchableOpacity onPress={press} activeOpacity={1}>
        <Animated.View style={[styles.statCard, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.statIconBg, { backgroundColor: color + '18' }]}>
            <Text style={styles.statEmoji}>{emoji}</Text>
          </View>
          <Text style={[styles.statValue, { color }]}>{value}</Text>
          <Text style={styles.statLabel}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    </FadeIn>
  );
}

// ─── Budget Ring ─────────────────────────────────────────────
function BudgetProgress({ spent, budget, currency = 'INR' }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const color = pct > 90 ? COLORS.danger : pct > 70 ? COLORS.warning : COLORS.success;
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 900, delay: 300, useNativeDriver: false }).start();
  }, [pct]);
  const animWidth = widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.budgetBox}>
      <View style={styles.budgetRow}>
        <Text style={styles.budgetLabel}>💳 Monthly Budget</Text>
        <Text style={[styles.budgetPct, { color }]}>{pct.toFixed(0)}%</Text>
      </View>
      <View style={styles.budgetAmounts}>
        <Text style={styles.budgetSpent}>{formatCurrency(spent)}</Text>
        <Text style={styles.budgetOf}>of {formatCurrency(budget)}</Text>
      </View>
      <View style={styles.progressBg}>
        <Animated.View style={[styles.progressFill, { width: animWidth, backgroundColor: color }]} />
      </View>
      <Text style={styles.budgetRemaining}>
        {pct < 100 ? `${formatCurrency(budget - spent)} remaining` : '⚠️ Budget exceeded!'}
      </Text>
    </View>
  );
}

// ─── Upcoming Bill Card ──────────────────────────────────────
function UpcomingCard({ bill, onPress }) {
  const days = daysUntil(bill.due_date);
  const urgent = days !== null && days <= 2;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
  const onPressOut = () => Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
      <Animated.View style={[styles.upcomingCard, urgent && styles.upcomingUrgentCard, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.upcomingIcon, { backgroundColor: (bill.category_color || COLORS.primary) + '20' }]}>
          <Text style={{ fontSize: rs(26) }}>{bill.category_icon || '📄'}</Text>
        </View>
        <View style={styles.upcomingInfo}>
          <Text style={styles.upcomingTitle} numberOfLines={1}>{bill.title}</Text>
          <Text style={styles.upcomingVendor}>{bill.vendor || bill.category_name || 'Uncategorized'}</Text>
        </View>
        <View style={styles.upcomingRight}>
          <Text style={styles.upcomingAmount}>{formatCurrency(bill.total_amount)}</Text>
          <View style={[styles.dueBadge, { backgroundColor: urgent ? COLORS.dangerLight : COLORS.warningLight }]}>
            <Text style={[styles.dueText, { color: urgent ? COLORS.danger : COLORS.warning }]}>
              {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : days !== null ? `${days}d` : formatDate(bill.due_date)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Quick Action Button ─────────────────────────────────────
function QuickAction({ emoji, label, color, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.90, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, friction: 3 }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1} style={styles.quickActionWrap}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
        <View style={[styles.quickIconBg, { backgroundColor: color + '18' }]}>
          <Text style={{ fontSize: rs(28) }}>{emoji}</Text>
        </View>
        <Text style={styles.quickLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ─────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { summary, loading, fetchSummary } = useDashboard();
  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchSummary();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const d = summary || {};
  const maxCatTotal = d.spending_by_category?.length
    ? Math.max(...d.spending_by_category.map(c => c.total), 1)
    : 1;

  if (loading && !summary) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading your finances...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSummary} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Good day! 👋</Text>
            <Text style={styles.headerSub}>Your financial overview</Text>
          </View>
          <TouchableOpacity style={styles.addBtnHeader} onPress={() => router.push('/bill/add')}>
            <Text style={styles.addBtnText}>＋ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Budget inside header */}
        {d.monthly_budget > 0 && (
          <BudgetProgress spent={d.monthly_spent} budget={d.monthly_budget} />
        )}
      </Animated.View>

      {/* ── Overdue Alert ── */}
      {d.overdue_count > 0 && (
        <FadeIn delay={100}>
          <PulseView>
            <TouchableOpacity
              style={styles.overdueAlert}
              onPress={() => router.push('/(tabs)/bills?status=overdue')}
              activeOpacity={0.85}
            >
              <Text style={styles.overdueAlertEmoji}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.overdueAlertTitle}>{d.overdue_count} Overdue Bill{d.overdue_count > 1 ? 's' : ''}</Text>
                <Text style={styles.overdueAlertSub}>{formatCurrency(d.overdue_total)} needs immediate payment</Text>
              </View>
              <Text style={styles.overdueAlertArrow}>→</Text>
            </TouchableOpacity>
          </PulseView>
        </FadeIn>
      )}

      {/* ── Stats Grid ── */}
      <View style={styles.statsGrid}>
        <StatCard emoji="💰" label="This Month"  value={formatCurrency(d.monthly_spent)}       color={COLORS.primary}  delay={150} />
        <StatCard emoji="⏳" label="Unpaid"       value={String(d.unpaid_count  || 0)}           color={COLORS.warning}  delay={200} onPress={() => router.push('/(tabs)/bills?status=unpaid')} />
        <StatCard emoji="📋" label="Total Bills"  value={String(d.total_bills   || 0)}           color={COLORS.info}     delay={250} onPress={() => router.push('/(tabs)/bills')} />
        <StatCard emoji="✅" label="Paid"          value={String((d.total_bills || 0) - (d.unpaid_count || 0) - (d.overdue_count || 0))} color={COLORS.success} delay={300} />
      </View>

      {/* ── Quick Actions ── */}
      <FadeIn delay={350}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <QuickAction emoji="📷" label="Scan Bill"   color={COLORS.primary} onPress={() => router.push('/(tabs)/scanner')} />
            <QuickAction emoji="✏️" label="Add Manual"  color={COLORS.warning} onPress={() => router.push('/bill/add')} />
            <QuickAction emoji="📊" label="Analytics"   color={COLORS.info}    onPress={() => router.push('/(tabs)/analytics')} />
            <QuickAction emoji="🧾" label="All Bills"   color={COLORS.success} onPress={() => router.push('/(tabs)/bills')} />
          </View>
        </View>
      </FadeIn>

      {/* ── Due Soon ── */}
      {d.upcoming_bills?.length > 0 && (
        <FadeIn delay={400}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⏰ Due Soon</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/bills?status=unpaid')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            {d.upcoming_bills.map((bill, i) => (
              <UpcomingCard
                key={bill.id}
                bill={bill}
                onPress={() => router.push(`/bill/${bill.id}`)}
              />
            ))}
          </View>
        </FadeIn>
      )}

      {/* ── Spending Breakdown ── */}
      {d.spending_by_category?.length > 0 && (
        <FadeIn delay={450}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📊 This Month</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                <Text style={styles.seeAll}>Full report →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {d.spending_by_category.slice(0, 5).map((cat, i) => {
                const pct = maxCatTotal > 0 ? (cat.total / maxCatTotal) * 100 : 0;
                const barAnim = useRef(new Animated.Value(0)).current;
                useEffect(() => {
                  Animated.timing(barAnim, { toValue: pct, duration: 700, delay: 500 + i * 80, useNativeDriver: false }).start();
                }, [pct]);
                const animWidth = barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
                return (
                  <View key={i} style={[styles.catRow, i < 4 && styles.catRowBorder]}>
                    <Text style={{ fontSize: rs(22), width: rs(32), textAlign: 'center' }}>{cat.icon || '📄'}</Text>
                    <View style={{ flex: 1, marginLeft: rs(10) }}>
                      <View style={styles.catRowTop}>
                        <Text style={styles.catName}>{cat.name || 'Other'}</Text>
                        <Text style={styles.catAmount}>{formatCurrency(cat.total)}</Text>
                      </View>
                      <View style={styles.catBarBg}>
                        <Animated.View style={[styles.catBarFill, { width: animWidth, backgroundColor: cat.color || COLORS.primary }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </FadeIn>
      )}

      {/* ── Empty State ── */}
      {!d.total_bills && (
        <FadeIn delay={300}>
          <View style={styles.emptyState}>
            <Text style={{ fontSize: rs(64) }}>🧾</Text>
            <Text style={styles.emptyTitle}>No bills yet!</Text>
            <Text style={styles.emptySub}>Scan or add your first bill to start tracking your finances.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/(tabs)/scanner')}>
              <Text style={styles.emptyBtnText}>📷 Scan First Bill</Text>
            </TouchableOpacity>
          </View>
        </FadeIn>
      )}

      <View style={{ height: rs(32) }} />
    </ScrollView>
  );
}

const CARD_W = (SCREEN.W - rs(16) * 2 - rs(10)) / 2;

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: COLORS.background },
  content:     { paddingBottom: rs(24) },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: rs(12), color: COLORS.textSecondary, fontSize: FONTS.md },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? rs(54) : rs(44),
    paddingBottom: rs(24),
    paddingHorizontal: rs(20),
    borderBottomLeftRadius:  rs(28),
    borderBottomRightRadius: rs(28),
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: rs(16) },
  greeting:   { fontSize: FONTS.xxl, fontWeight: '900', color: '#fff' },
  headerSub:  { fontSize: FONTS.sm,  color: 'rgba(255,255,255,0.75)', marginTop: rs(2) },
  addBtnHeader: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: rs(16), paddingVertical: rs(8),
    borderRadius: rs(20), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.sm },

  // Budget
  budgetBox: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: rs(16), padding: rs(14) },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetLabel: { fontSize: FONTS.sm, color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  budgetPct:   { fontSize: FONTS.sm, fontWeight: '900' },
  budgetAmounts: { flexDirection: 'row', alignItems: 'baseline', gap: rs(6), marginTop: rs(4), marginBottom: rs(8) },
  budgetSpent: { fontSize: FONTS.xl,  color: '#fff', fontWeight: '900' },
  budgetOf:    { fontSize: FONTS.sm,  color: 'rgba(255,255,255,0.65)', fontWeight: '600' },
  progressBg:  { height: rs(8), backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: rs(4), overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: rs(4) },
  budgetRemaining: { fontSize: FONTS.xs, color: 'rgba(255,255,255,0.7)', marginTop: rs(4), fontWeight: '600' },

  // Overdue alert
  overdueAlert: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    marginHorizontal: rs(16), marginTop: rs(14),
    borderRadius: rs(16), padding: rs(14),
    borderWidth: 1.5, borderColor: COLORS.danger + '44', gap: rs(10),
    ...SHADOWS.md,
  },
  overdueAlertEmoji: { fontSize: rs(28) },
  overdueAlertTitle: { fontSize: FONTS.md,  fontWeight: '800', color: COLORS.danger },
  overdueAlertSub:   { fontSize: FONTS.xs,  color: COLORS.danger, opacity: 0.75, marginTop: rs(2) },
  overdueAlertArrow: { fontSize: FONTS.lg,  color: COLORS.danger, fontWeight: '700' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: rs(12), marginTop: rs(14), gap: rs(10),
  },
  statCard: {
    width: CARD_W, backgroundColor: COLORS.card,
    borderRadius: rs(18), padding: rs(16),
    alignItems: 'flex-start', ...SHADOWS.sm,
  },
  statIconBg: { width: rs(48), height: rs(48), borderRadius: rs(14), alignItems: 'center', justifyContent: 'center', marginBottom: rs(10) },
  statEmoji:  { fontSize: rs(26) },
  statValue:  { fontSize: FONTS.xl, fontWeight: '900' },
  statLabel:  { fontSize: FONTS.xs,  color: COLORS.textSecondary, fontWeight: '600', marginTop: rs(2) },

  // Quick actions
  section:       { paddingHorizontal: rs(16), marginTop: rs(20) },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: rs(12) },
  sectionTitle:  { fontSize: FONTS.lg, fontWeight: '800', color: COLORS.text },
  seeAll:        { fontSize: FONTS.sm, color: COLORS.primary, fontWeight: '700' },
  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickActionWrap: { flex: 1, alignItems: 'center' },
  quickIconBg: {
    width: rs(64), height: rs(64), borderRadius: rs(20),
    alignItems: 'center', justifyContent: 'center', marginBottom: rs(6),
    ...SHADOWS.sm,
    backgroundColor: '#fff',
  },
  quickLabel: { fontSize: FONTS.xs, color: COLORS.textSecondary, fontWeight: '700', textAlign: 'center' },

  // Upcoming cards
  upcomingCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderRadius: rs(16),
    padding: rs(14), marginBottom: rs(10),
    ...SHADOWS.sm, gap: rs(12),
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  upcomingUrgentCard: { borderColor: COLORS.danger + '44', backgroundColor: COLORS.dangerLight },
  upcomingIcon: { width: rs(52), height: rs(52), borderRadius: rs(16), alignItems: 'center', justifyContent: 'center' },
  upcomingInfo: { flex: 1 },
  upcomingTitle:  { fontSize: FONTS.md,  fontWeight: '800', color: COLORS.text },
  upcomingVendor: { fontSize: FONTS.xs,  color: COLORS.textSecondary, marginTop: rs(2) },
  upcomingRight:  { alignItems: 'flex-end', gap: rs(4) },
  upcomingAmount: { fontSize: FONTS.md,  fontWeight: '900', color: COLORS.text },
  dueBadge:  { paddingHorizontal: rs(8), paddingVertical: rs(3), borderRadius: rs(10) },
  dueText:   { fontSize: FONTS.xs, fontWeight: '800' },

  // Category breakdown
  card: {
    backgroundColor: COLORS.card, borderRadius: rs(18), padding: rs(16), ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  catRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: rs(10) },
  catRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  catRowTop:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(6) },
  catName:      { fontSize: FONTS.sm,  fontWeight: '700', color: COLORS.text },
  catAmount:    { fontSize: FONTS.sm,  fontWeight: '800', color: COLORS.text },
  catBarBg:     { height: rs(5), backgroundColor: COLORS.borderLight, borderRadius: rs(3), overflow: 'hidden' },
  catBarFill:   { height: '100%', borderRadius: rs(3) },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: rs(48), paddingHorizontal: rs(32) },
  emptyTitle: { fontSize: FONTS.xl, fontWeight: '900', color: COLORS.text, marginTop: rs(16) },
  emptySub:   { fontSize: FONTS.md, color: COLORS.textSecondary, textAlign: 'center', marginTop: rs(8), lineHeight: rs(22) },
  emptyBtn:   { marginTop: rs(24), backgroundColor: COLORS.primary, paddingHorizontal: rs(28), paddingVertical: rs(14), borderRadius: rs(28), ...SHADOWS.lg },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: FONTS.md },
});
