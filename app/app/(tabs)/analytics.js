import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Animated, Dimensions, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDashboard } from '../../src/hooks/useApi';
import api from '../../src/config/api';
import { COLORS, SIZES, SHADOWS, FONTS, rs, SCREEN } from '../../src/constants/theme';

function fmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }

// ─── Animated fade in ────────────────────────────────────────
function FadeIn({ delay = 0, children }) {
  const a = useRef(new Animated.Value(0)).current;
  const s = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(a, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.timing(s, { toValue: 0, duration: 380, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: s }] }}>{children}</Animated.View>;
}

// ─── Section card ────────────────────────────────────────────
function SCard({ children, style }) {
  return <View style={[styles.scard, style]}>{children}</View>;
}

// ─── Bar chart (animated) ────────────────────────────────────
function BarChart({ data, color = COLORS.primary, height = 120 }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height + rs(36), gap: rs(4) }}>
      {data.map((d, i) => {
        const targetH = Math.max((d.total / max) * height, d.total > 0 ? rs(4) : 0);
        const anim = useRef(new Animated.Value(0)).current;
        useEffect(() => {
          Animated.timing(anim, { toValue: targetH, duration: 600, delay: i * 60, useNativeDriver: false }).start();
        }, [targetH]);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={styles.barVal}>{d.total > 0 ? (d.total >= 1000 ? `${(d.total/1000).toFixed(1)}k` : d.total.toFixed(0)) : ''}</Text>
            <Animated.View style={{ height: anim, width: '72%', backgroundColor: color, borderRadius: rs(6) }} />
            <Text style={styles.barLabel}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Health Score Ring ───────────────────────────────────────
function HealthRing({ score, grade, emoji, message }) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 5, delay: 300, useNativeDriver: true }).start();
  }, []);
  const gradeColor = { A: COLORS.success, B: COLORS.info, C: COLORS.warning, D: COLORS.warning, F: COLORS.danger, 'N/A': COLORS.textLight }[grade] || COLORS.primary;
  return (
    <View style={styles.healthRingWrap}>
      <Animated.View style={[styles.healthRing, { borderColor: gradeColor, transform: [{ scale: scaleAnim }] }]}>
        <Text style={styles.healthEmoji}>{emoji || '📊'}</Text>
        <Text style={[styles.healthScore, { color: gradeColor }]}>{score}</Text>
        <Text style={[styles.healthGrade, { color: gradeColor }]}>Grade {grade}</Text>
      </Animated.View>
      <Text style={styles.healthMsg}>{message}</Text>
    </View>
  );
}

// ─── Anomaly Card ─────────────────────────────────────────────
function AnomalyCard({ item, onPress }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <TouchableOpacity
      onPressIn={() => Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start()}
      onPress={onPress}
      activeOpacity={1}
    >
      <Animated.View style={[styles.anomalyCard, item.severity === 'high' && styles.anomalyHigh, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.anomalySeverityDot, { backgroundColor: item.severity === 'high' ? COLORS.danger : COLORS.warning }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.anomalyMsg}>{item.message}</Text>
          {item.change_pct && (
            <Text style={[styles.anomalyPct, { color: COLORS.danger }]}>+{item.change_pct}% increase detected</Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Negotiation Tip Card ────────────────────────────────────
function NegotiationCard({ tip }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.negCard, { borderLeftColor: tip.category_color || COLORS.primary }]}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.88}
    >
      <View style={styles.negHeader}>
        <View style={styles.negLeft}>
          <Text style={{ fontSize: rs(24) }}>{tip.category_icon}</Text>
          <View style={{ marginLeft: rs(10) }}>
            <Text style={styles.negTitle}>{tip.category}</Text>
            <Text style={styles.negSaving}>Save ~{fmt(tip.potential_saving_amount)}/mo · {tip.success_rate}% success rate</Text>
          </View>
        </View>
        <Text style={styles.negExpand}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded && (
        <View style={styles.negScript}>
          <Text style={styles.negScriptLabel}>📞 What to say:</Text>
          <Text style={styles.negScriptText}>{tip.script}</Text>
          <Text style={[styles.negScriptLabel, { marginTop: rs(8) }]}>⏰ {tip.best_time}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Forecast Card ───────────────────────────────────────────
function ForecastCard({ item }) {
  const trendColor = item.trend === 'rising' ? COLORS.danger : item.trend === 'falling' ? COLORS.success : COLORS.info;
  const trendEmoji = item.trend === 'rising' ? '📈' : item.trend === 'falling' ? '📉' : '➡️';
  return (
    <View style={styles.forecastCard}>
      <View style={styles.forecastHeader}>
        <Text style={{ fontSize: rs(22) }}>{item.category_icon}</Text>
        <View style={{ flex: 1, marginLeft: rs(10) }}>
          <Text style={styles.forecastCat}>{item.category}</Text>
          <View style={styles.forecastTrend}>
            <Text style={{ fontSize: rs(14) }}>{trendEmoji}</Text>
            <Text style={[styles.forecastTrendText, { color: trendColor }]}>
              {item.trend} {item.trend_pct !== 0 ? `(${Math.abs(item.trend_pct)}%)` : ''}
            </Text>
          </View>
        </View>
        <Text style={styles.forecastAvg}>{fmt(item.historical_avg)}<Text style={styles.forecastAvgSub}>/mo avg</Text></Text>
      </View>
      <View style={styles.forecastMonths}>
        {item.next_3_months?.map((m, i) => (
          <View key={i} style={[styles.forecastMonth, { backgroundColor: COLORS.primary + (i === 0 ? 'ff' : i === 1 ? 'aa' : '66') }]}>
            <Text style={styles.forecastMonthAmt}>{fmt(m.predicted_amount)}</Text>
            <Text style={styles.forecastMonthLabel}>{m.month.split(' ')[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Tax Bucket Card ─────────────────────────────────────────
function TaxCard({ bucket }) {
  const pct = bucket.limit ? Math.min((bucket.total / bucket.limit) * 100, 100) : 100;
  return (
    <View style={styles.taxCard}>
      <View style={styles.taxHeader}>
        <Text style={{ fontSize: rs(22) }}>{bucket.icon}</Text>
        <View style={{ flex: 1, marginLeft: rs(10) }}>
          <Text style={styles.taxLabel}>{bucket.label}</Text>
          <Text style={styles.taxSection}>Section {bucket.section}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.taxAmount}>{fmt(bucket.eligible_amount)}</Text>
          <Text style={styles.taxDeductible}>deductible</Text>
        </View>
      </View>
      {bucket.limit && (
        <View style={styles.taxBarBg}>
          <View style={[styles.taxBarFill, { width: `${pct}%`, backgroundColor: pct > 90 ? COLORS.warning : COLORS.success }]} />
        </View>
      )}
      <Text style={styles.taxBills}>{bucket.bills?.length || 0} bills · {bucket.limit ? `Limit ₹${(bucket.limit/1000).toFixed(0)}k` : 'No limit'}</Text>
    </View>
  );
}

// ─── Warranty Card ───────────────────────────────────────────
function WarrantyCard({ item }) {
  const statusColor = item.status === 'expired' ? COLORS.textLight : item.status === 'expiring_soon' ? COLORS.warning : COLORS.success;
  const statusEmoji = item.status === 'expired' ? '❌' : item.status === 'expiring_soon' ? '⚠️' : '✅';
  return (
    <View style={styles.warrantyCard}>
      <Text style={{ fontSize: rs(22) }}>{statusEmoji}</Text>
      <View style={{ flex: 1, marginLeft: rs(10) }}>
        <Text style={styles.warrantyProduct}>{item.product}</Text>
        <Text style={styles.warrantyExpiry}>Expires {item.expiry_date}</Text>
      </View>
      <View style={[styles.warrantyBadge, { backgroundColor: statusColor + '20' }]}>
        <Text style={[styles.warrantyBadgeText, { color: statusColor }]}>
          {item.days_left > 0 ? `${item.days_left}d left` : 'Expired'}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Analytics Screen ───────────────────────────────────
export default function AnalyticsScreen() {
  const router = useRouter();
  const { summary, loading, fetchSummary } = useDashboard();
  const [healthData, setHealthData]     = useState(null);
  const [anomalies,  setAnomalies]      = useState([]);
  const [negotiation, setNegotiation]   = useState([]);
  const [forecast,    setForecast]      = useState(null);
  const [taxBuckets,  setTaxBuckets]    = useState(null);
  const [warranties,  setWarranties]    = useState([]);
  const [aiLoading,   setAiLoading]     = useState(false);
  const [activeTab,   setActiveTab]     = useState('overview');

  const loadAll = useCallback(async () => {
    fetchSummary();
    setAiLoading(true);
    try {
      const [h, a, n, f, t, w] = await Promise.all([
        api.get('/ai/health-score'),
        api.get('/ai/anomalies'),
        api.get('/ai/negotiation-coach'),
        api.get('/ai/forecast'),
        api.get('/ai/tax-buckets'),
        api.get('/ai/warranties'),
      ]);
      if (h.success) setHealthData(h.data);
      if (a.success) setAnomalies(a.data);
      if (n.success) setNegotiation(n.data);
      if (f.success) setForecast(f.data);
      if (t.success) setTaxBuckets(t.data);
      if (w.success) setWarranties(w.data);
    } catch (e) {
      console.log('AI load error:', e.message);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, []);

  const TABS = [
    { key: 'overview',     label: '📊 Overview' },
    { key: 'health',       label: '❤️ Health' },
    { key: 'anomalies',    label: '🚨 Alerts' },
    { key: 'coach',        label: '💡 Coach' },
    { key: 'forecast',     label: '🔮 Forecast' },
    { key: 'tax',          label: '🧾 Tax' },
    { key: 'warranty',     label: '🛡️ Warranty' },
  ];

  const d = summary || {};
  const isLoading = loading || aiLoading;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Analytics</Text>
        <Text style={styles.headerSub}>10 AI-powered financial insights</Text>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsRow}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading && !summary ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Running AI analysis...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadAll} tintColor={COLORS.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <>
              {/* Quick stats */}
              <FadeIn delay={0}>
                <View style={styles.statsRow}>
                  {[
                    { label: 'This Month', val: fmt(d.monthly_spent), color: COLORS.primary, emoji: '💰' },
                    { label: 'Unpaid',     val: String(d.unpaid_count  || 0), color: COLORS.warning, emoji: '⏳' },
                    { label: 'Overdue',    val: String(d.overdue_count || 0), color: COLORS.danger,  emoji: '🚨' },
                    { label: 'Total',      val: String(d.total_bills   || 0), color: COLORS.info,    emoji: '📋' },
                  ].map((s, i) => (
                    <View key={i} style={[styles.miniStat, { borderTopColor: s.color }]}>
                      <Text style={{ fontSize: rs(18) }}>{s.emoji}</Text>
                      <Text style={[styles.miniStatVal, { color: s.color }]}>{s.val}</Text>
                      <Text style={styles.miniStatLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </FadeIn>

              {/* 6-month trend */}
              {d.monthly_trend?.length > 0 && (
                <FadeIn delay={100}>
                  <SCard>
                    <Text style={styles.cardTitle}>📈 6-Month Spending Trend</Text>
                    <BarChart data={d.monthly_trend} color={COLORS.primary} />
                  </SCard>
                </FadeIn>
              )}

              {/* Category breakdown */}
              {d.spending_by_category?.length > 0 && (
                <FadeIn delay={200}>
                  <SCard>
                    <Text style={styles.cardTitle}>🗂️ Spending by Category</Text>
                    {d.spending_by_category.map((cat, i) => {
                      const max = Math.max(...d.spending_by_category.map(c => c.total), 1);
                      const pct = (cat.total / max) * 100;
                      const barAnim = useRef(new Animated.Value(0)).current;
                      useEffect(() => {
                        Animated.timing(barAnim, { toValue: pct, duration: 600, delay: 300 + i*70, useNativeDriver: false }).start();
                      }, [pct]);
                      const w = barAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
                      return (
                        <View key={i} style={[styles.catRow, i < d.spending_by_category.length-1 && styles.catBorder]}>
                          <Text style={{ fontSize: rs(20), width: rs(28) }}>{cat.icon}</Text>
                          <View style={{ flex: 1, marginLeft: rs(10) }}>
                            <View style={styles.catTop}><Text style={styles.catName}>{cat.name}</Text><Text style={styles.catAmt}>{fmt(cat.total)}</Text></View>
                            <View style={styles.catBarBg}><Animated.View style={[styles.catBarFill, { width: w, backgroundColor: cat.color || COLORS.primary }]} /></View>
                          </View>
                        </View>
                      );
                    })}
                  </SCard>
                </FadeIn>
              )}

              {/* Health score mini */}
              {healthData && (
                <FadeIn delay={300}>
                  <TouchableOpacity onPress={() => setActiveTab('health')}>
                    <SCard style={styles.healthMini}>
                      <View style={styles.healthMiniLeft}>
                        <Text style={styles.healthMiniScore}>{healthData.emoji} {healthData.score}/100</Text>
                        <Text style={styles.healthMiniGrade}>Grade {healthData.grade} — {healthData.message}</Text>
                      </View>
                      <Text style={styles.healthMiniArrow}>→</Text>
                    </SCard>
                  </TouchableOpacity>
                </FadeIn>
              )}

              {/* Anomaly alert mini */}
              {anomalies.length > 0 && (
                <FadeIn delay={350}>
                  <TouchableOpacity onPress={() => setActiveTab('anomalies')}>
                    <SCard style={{ backgroundColor: COLORS.dangerLight, borderWidth: 1.5, borderColor: COLORS.danger + '33' }}>
                      <Text style={[styles.cardTitle, { color: COLORS.danger }]}>🚨 {anomalies.length} Anomaly Alert{anomalies.length > 1 ? 's' : ''} Detected</Text>
                      <Text style={{ fontSize: FONTS.sm, color: COLORS.danger, opacity: 0.75 }}>Tap to see suspicious bill activity →</Text>
                    </SCard>
                  </TouchableOpacity>
                </FadeIn>
              )}
            </>
          )}

          {/* ── HEALTH SCORE TAB ── */}
          {activeTab === 'health' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>❤️ Bill Health Score</Text>
                {healthData ? (
                  <>
                    <HealthRing score={healthData.score} grade={healthData.grade} emoji={healthData.emoji} message={healthData.message} />
                    {healthData.breakdown?.map((b, i) => {
                      const pct = (b.score / b.max) * 100;
                      const anim = useRef(new Animated.Value(0)).current;
                      useEffect(() => { Animated.timing(anim, { toValue: pct, duration: 700, delay: i * 120, useNativeDriver: false }).start(); }, [pct]);
                      const w = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
                      const color = pct >= 75 ? COLORS.success : pct >= 50 ? COLORS.warning : COLORS.danger;
                      return (
                        <View key={i} style={styles.breakdownRow}>
                          <View style={styles.breakdownTop}>
                            <Text style={styles.breakdownLabel}>{b.label}</Text>
                            <Text style={[styles.breakdownScore, { color }]}>{b.score}/{b.max}</Text>
                          </View>
                          <View style={styles.breakdownBarBg}><Animated.View style={[styles.breakdownBarFill, { width: w, backgroundColor: color }]} /></View>
                          <Text style={styles.breakdownDetail}>{b.detail}</Text>
                        </View>
                      );
                    })}
                    {healthData.streak > 0 && (
                      <View style={styles.streakBox}>
                        <Text style={styles.streakEmoji}>🔥</Text>
                        <Text style={styles.streakText}>{healthData.streak} bills paid on time — keep the streak!</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyTabText}>Add bills to calculate your health score</Text>
                )}
              </SCard>
            </FadeIn>
          )}

          {/* ── ANOMALIES TAB ── */}
          {activeTab === 'anomalies' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>🚨 Anomaly Alerts</Text>
                <Text style={styles.cardSubtitle}>AI monitors for unusual spending spikes and duplicate charges</Text>
                {anomalies.length === 0 ? (
                  <View style={styles.emptyTabBox}>
                    <Text style={{ fontSize: rs(40) }}>✅</Text>
                    <Text style={styles.emptyTabText}>No anomalies detected! Your bills look normal.</Text>
                  </View>
                ) : (
                  anomalies.map((a, i) => (
                    <AnomalyCard
                      key={i}
                      item={a}
                      onPress={() => a.bill_id && router.push(`/bill/${a.bill_id}`)}
                    />
                  ))
                )}
              </SCard>
            </FadeIn>
          )}

          {/* ── NEGOTIATION COACH TAB ── */}
          {activeTab === 'coach' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>💡 Negotiation Coach</Text>
                <Text style={styles.cardSubtitle}>AI tells you exactly what to say to reduce your bills</Text>
                {negotiation.length === 0 ? (
                  <View style={styles.emptyTabBox}>
                    <Text style={{ fontSize: rs(40) }}>📱</Text>
                    <Text style={styles.emptyTabText}>Track 3+ months of Internet, Mobile, or Insurance bills to get negotiation scripts.</Text>
                  </View>
                ) : (
                  negotiation.map((tip, i) => <NegotiationCard key={i} tip={tip} />)
                )}
              </SCard>
            </FadeIn>
          )}

          {/* ── FORECAST TAB ── */}
          {activeTab === 'forecast' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>🔮 Predictive Forecast</Text>
                <Text style={styles.cardSubtitle}>AI predicts next 3 months based on your spending history</Text>
                {forecast?.forecasts?.length > 0 ? (
                  <>
                    {forecast.total_next_month > 0 && (
                      <View style={styles.forecastTotalBox}>
                        <Text style={styles.forecastTotalLabel}>Predicted Next Month Total</Text>
                        <Text style={styles.forecastTotalAmt}>{fmt(forecast.total_next_month)}</Text>
                      </View>
                    )}
                    {forecast.forecasts.map((f, i) => <ForecastCard key={i} item={f} />)}
                  </>
                ) : (
                  <View style={styles.emptyTabBox}>
                    <Text style={{ fontSize: rs(40) }}>🔮</Text>
                    <Text style={styles.emptyTabText}>Add more bills to unlock spending forecasts.</Text>
                  </View>
                )}
              </SCard>
            </FadeIn>
          )}

          {/* ── TAX BUCKETS TAB ── */}
          {activeTab === 'tax' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>🧾 Tax Bucket Auto-Sort</Text>
                <Text style={styles.cardSubtitle}>AI auto-tags your tax-deductible bills for filing</Text>
                {taxBuckets?.buckets?.length > 0 ? (
                  <>
                    <View style={styles.taxTotalBox}>
                      <Text style={styles.taxTotalLabel}>Total Deductible This Year</Text>
                      <Text style={styles.taxTotalAmt}>{fmt(taxBuckets.total_deductible)}</Text>
                    </View>
                    {taxBuckets.buckets.map((b, i) => <TaxCard key={i} bucket={b} />)}
                  </>
                ) : (
                  <View style={styles.emptyTabBox}>
                    <Text style={{ fontSize: rs(40) }}>📂</Text>
                    <Text style={styles.emptyTabText}>Add Medical, Rent, Insurance, or Education bills to auto-sort them for tax filing.</Text>
                  </View>
                )}
              </SCard>
            </FadeIn>
          )}

          {/* ── WARRANTY TAB ── */}
          {activeTab === 'warranty' && (
            <FadeIn>
              <SCard>
                <Text style={styles.cardTitle}>🛡️ Warranty Tracker</Text>
                <Text style={styles.cardSubtitle}>Bills tagged with "warranty" appear here automatically</Text>
                {warranties.length === 0 ? (
                  <View style={styles.emptyTabBox}>
                    <Text style={{ fontSize: rs(40) }}>🛡️</Text>
                    <Text style={styles.emptyTabText}>When adding electronics bills, add the #warranty tag and note the warranty period (e.g. "1 year warranty") to track it here.</Text>
                  </View>
                ) : (
                  warranties.map((w, i) => <WarrantyCard key={i} item={w} />)
                )}
              </SCard>
            </FadeIn>
          )}

          <View style={{ height: rs(32) }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: COLORS.background },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: rs(12), color: COLORS.textSecondary, fontSize: FONTS.sm },
  content:     { padding: rs(16) },

  header: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? rs(54) : rs(44),
    paddingBottom: rs(18),
    paddingHorizontal: rs(20),
  },
  headerTitle: { fontSize: FONTS.xxl, fontWeight: '900', color: '#fff' },
  headerSub:   { fontSize: FONTS.xs,  color: 'rgba(255,255,255,0.7)', marginTop: rs(2) },

  // Tabs
  tabsRow:     { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, flexGrow: 0 },
  tabsContent: { paddingHorizontal: rs(12), paddingVertical: rs(8), gap: rs(6) },
  tab:         { paddingHorizontal: rs(14), paddingVertical: rs(8), borderRadius: rs(20), backgroundColor: COLORS.background },
  tabActive:   { backgroundColor: COLORS.primary },
  tabText:     { fontSize: FONTS.xs, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: '#fff' },

  // Section card
  scard: {
    backgroundColor: COLORS.card, borderRadius: rs(18), padding: rs(16),
    marginBottom: rs(14), ...SHADOWS.sm,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardTitle:    { fontSize: FONTS.md, fontWeight: '800', color: COLORS.text, marginBottom: rs(4) },
  cardSubtitle: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginBottom: rs(14) },

  // Stats row
  statsRow: { flexDirection: 'row', gap: rs(8), marginBottom: rs(14) },
  miniStat: {
    flex: 1, backgroundColor: COLORS.card, borderRadius: rs(14), padding: rs(12),
    alignItems: 'center', borderTopWidth: 3, ...SHADOWS.sm,
  },
  miniStatVal:   { fontSize: FONTS.lg, fontWeight: '900', marginTop: rs(4) },
  miniStatLabel: { fontSize: rs(9),    color: COLORS.textSecondary, fontWeight: '700', marginTop: rs(2) },

  // Bar chart
  barVal:   { fontSize: rs(9), color: COLORS.textSecondary, fontWeight: '700', marginBottom: rs(2) },
  barLabel: { fontSize: rs(10), color: COLORS.textSecondary, marginTop: rs(4), fontWeight: '600' },

  // Category rows
  catRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: rs(10) },
  catBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  catTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(5) },
  catName:  { fontSize: FONTS.sm,  fontWeight: '700', color: COLORS.text },
  catAmt:   { fontSize: FONTS.sm,  fontWeight: '800', color: COLORS.text },
  catBarBg: { height: rs(5), backgroundColor: COLORS.borderLight, borderRadius: rs(3), overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: rs(3) },

  // Health mini
  healthMini:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primaryLight },
  healthMiniLeft: { flex: 1 },
  healthMiniScore: { fontSize: FONTS.lg, fontWeight: '900', color: COLORS.primary },
  healthMiniGrade: { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: rs(2) },
  healthMiniArrow: { fontSize: rs(22), color: COLORS.primary, fontWeight: '700' },

  // Health ring
  healthRingWrap: { alignItems: 'center', marginVertical: rs(16) },
  healthRing: {
    width: rs(140), height: rs(140), borderRadius: rs(70),
    borderWidth: rs(8), alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', ...SHADOWS.md,
  },
  healthEmoji: { fontSize: rs(28) },
  healthScore: { fontSize: rs(32), fontWeight: '900', marginTop: rs(2) },
  healthGrade: { fontSize: FONTS.sm, fontWeight: '800' },
  healthMsg:   { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center', marginTop: rs(8), paddingHorizontal: rs(16) },

  // Breakdown
  breakdownRow:   { marginBottom: rs(14) },
  breakdownTop:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: rs(5) },
  breakdownLabel: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.text },
  breakdownScore: { fontSize: FONTS.sm, fontWeight: '800' },
  breakdownBarBg: { height: rs(8), backgroundColor: COLORS.borderLight, borderRadius: rs(4), overflow: 'hidden', marginBottom: rs(3) },
  breakdownBarFill: { height: '100%', borderRadius: rs(4) },
  breakdownDetail: { fontSize: FONTS.xs, color: COLORS.textSecondary },
  streakBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.warningLight, borderRadius: rs(12), padding: rs(12), gap: rs(10), marginTop: rs(8) },
  streakEmoji: { fontSize: rs(24) },
  streakText:  { fontSize: FONTS.sm, color: COLORS.warning, fontWeight: '700', flex: 1 },

  // Anomaly
  anomalyCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: rs(10),
    backgroundColor: COLORS.warningLight, borderRadius: rs(12), padding: rs(12), marginBottom: rs(8),
  },
  anomalyHigh:         { backgroundColor: COLORS.dangerLight },
  anomalySeverityDot:  { width: rs(10), height: rs(10), borderRadius: rs(5), marginTop: rs(4) },
  anomalyMsg:          { fontSize: FONTS.sm, color: COLORS.text, fontWeight: '600', lineHeight: rs(20) },
  anomalyPct:          { fontSize: FONTS.xs, fontWeight: '700', marginTop: rs(2) },

  // Negotiation
  negCard: {
    borderLeftWidth: rs(4), backgroundColor: COLORS.card, borderRadius: rs(12),
    padding: rs(14), marginBottom: rs(10), ...SHADOWS.sm,
  },
  negHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  negLeft:    { flexDirection: 'row', alignItems: 'center', flex: 1 },
  negTitle:   { fontSize: FONTS.md, fontWeight: '800', color: COLORS.text },
  negSaving:  { fontSize: FONTS.xs, color: COLORS.success, fontWeight: '700', marginTop: rs(2) },
  negExpand:  { fontSize: FONTS.sm, color: COLORS.textSecondary },
  negScript:  { marginTop: rs(12), backgroundColor: COLORS.background, borderRadius: rs(10), padding: rs(12) },
  negScriptLabel: { fontSize: FONTS.xs, fontWeight: '800', color: COLORS.textSecondary, textTransform: 'uppercase' },
  negScriptText:  { fontSize: FONTS.sm, color: COLORS.text, marginTop: rs(6), lineHeight: rs(20), fontStyle: 'italic' },

  // Forecast
  forecastTotalBox: { backgroundColor: COLORS.primaryLight, borderRadius: rs(12), padding: rs(14), alignItems: 'center', marginBottom: rs(14) },
  forecastTotalLabel: { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '700' },
  forecastTotalAmt:   { fontSize: rs(28), fontWeight: '900', color: COLORS.primary, marginTop: rs(4) },
  forecastCard: { backgroundColor: COLORS.background, borderRadius: rs(12), padding: rs(12), marginBottom: rs(10), borderWidth: 1, borderColor: COLORS.borderLight },
  forecastHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: rs(10) },
  forecastCat:    { fontSize: FONTS.sm, fontWeight: '800', color: COLORS.text },
  forecastTrend:  { flexDirection: 'row', alignItems: 'center', gap: rs(4), marginTop: rs(2) },
  forecastTrendText: { fontSize: FONTS.xs, fontWeight: '700', textTransform: 'capitalize' },
  forecastAvg:    { fontSize: FONTS.sm, fontWeight: '800', color: COLORS.text },
  forecastAvgSub: { fontSize: rs(10), color: COLORS.textSecondary, fontWeight: '500' },
  forecastMonths: { flexDirection: 'row', gap: rs(6) },
  forecastMonth:  { flex: 1, borderRadius: rs(10), padding: rs(8), alignItems: 'center' },
  forecastMonthAmt:   { fontSize: FONTS.xs, fontWeight: '800', color: '#fff' },
  forecastMonthLabel: { fontSize: rs(9), color: 'rgba(255,255,255,0.8)', marginTop: rs(2) },

  // Tax
  taxTotalBox: { backgroundColor: COLORS.successLight, borderRadius: rs(12), padding: rs(14), alignItems: 'center', marginBottom: rs(14) },
  taxTotalLabel: { fontSize: FONTS.xs, color: COLORS.success, fontWeight: '700' },
  taxTotalAmt:   { fontSize: rs(28), fontWeight: '900', color: COLORS.success, marginTop: rs(4) },
  taxCard: { backgroundColor: COLORS.background, borderRadius: rs(12), padding: rs(12), marginBottom: rs(8), borderWidth: 1, borderColor: COLORS.borderLight },
  taxHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: rs(8) },
  taxLabel:      { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.text },
  taxSection:    { fontSize: FONTS.xs, color: COLORS.primary, fontWeight: '700' },
  taxAmount:     { fontSize: FONTS.md, fontWeight: '900', color: COLORS.success },
  taxDeductible: { fontSize: rs(9),   color: COLORS.success, fontWeight: '600' },
  taxBarBg:      { height: rs(5), backgroundColor: COLORS.borderLight, borderRadius: rs(3), overflow: 'hidden', marginBottom: rs(4) },
  taxBarFill:    { height: '100%', borderRadius: rs(3) },
  taxBills:      { fontSize: FONTS.xs, color: COLORS.textSecondary },

  // Warranty
  warrantyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background,
    borderRadius: rs(12), padding: rs(12), marginBottom: rs(8),
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  warrantyProduct: { fontSize: FONTS.sm, fontWeight: '700', color: COLORS.text },
  warrantyExpiry:  { fontSize: FONTS.xs, color: COLORS.textSecondary, marginTop: rs(2) },
  warrantyBadge:   { paddingHorizontal: rs(10), paddingVertical: rs(4), borderRadius: rs(10) },
  warrantyBadgeText: { fontSize: FONTS.xs, fontWeight: '800' },

  // Empty states
  emptyTabBox:  { alignItems: 'center', paddingVertical: rs(28), gap: rs(10) },
  emptyTabText: { fontSize: FONTS.sm, color: COLORS.textSecondary, textAlign: 'center', lineHeight: rs(20) },
});
