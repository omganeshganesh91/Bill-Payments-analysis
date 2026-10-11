import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useRef, useEffect } from 'react';
import { COLORS, rs, FONTS, SHADOWS } from '../../src/constants/theme';

function TabIcon({ emoji, label, focused }) {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.88)).current;
  const opacAnim  = useRef(new Animated.Value(focused ? 1  : 0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: focused ? 1 : 0.88, useNativeDriver: true, friction: 5 }),
      Animated.timing(opacAnim,  { toValue: focused ? 1 : 0.5, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={[styles.tabIcon, { transform: [{ scale: scaleAnim }], opacity: opacAnim }]}>
      {focused && <View style={styles.tabActiveBg} />}
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiActive]}>{emoji}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </Animated.View>
  );
}

function ScanTabIcon({ focused }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.scanButton, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.scanEmoji}>📷</Text>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="index"     options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home"     focused={focused} /> }} />
      <Tabs.Screen name="bills"     options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📋" label="Bills"    focused={focused} /> }} />
      <Tabs.Screen name="scanner"   options={{ tabBarIcon: ({ focused }) => <ScanTabIcon focused={focused} /> }} />
      <Tabs.Screen name="analytics" options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Insights" focused={focused} /> }} />
      <Tabs.Screen name="profile"   options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile"  focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0,
    height: Platform.OS === 'ios' ? rs(84) : rs(70),
    paddingBottom: Platform.OS === 'ios' ? rs(20) : rs(8),
    paddingTop: rs(6),
    elevation: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  tabIcon: {
    alignItems: 'center', justifyContent: 'center',
    gap: rs(3), paddingTop: rs(4), minWidth: rs(56),
  },
  tabActiveBg: {
    position: 'absolute', top: -rs(4),
    width: rs(48), height: rs(48), borderRadius: rs(14),
    backgroundColor: COLORS.primaryLight,
  },
  tabEmoji:      { fontSize: rs(24), zIndex: 1 },
  tabEmojiActive: { fontSize: rs(26) },
  tabLabel:      { fontSize: rs(10), color: COLORS.textLight, fontWeight: '600', zIndex: 1 },
  tabLabelActive: { color: COLORS.primary, fontWeight: '800' },

  scanButton: {
    width: rs(60), height: rs(60), borderRadius: rs(20),
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: rs(18),
    ...SHADOWS.lg,
  },
  scanEmoji: { fontSize: rs(28) },
});
