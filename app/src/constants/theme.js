import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Responsive scale — base width 390 (iPhone 14)
const scale   = W / 390;
const vscale  = H / 844;
export const rs  = (size) => Math.round(size * scale);           // responsive
export const rvs = (size) => Math.round(size * vscale);          // vertical
export const rf  = (size) => Math.round(size * Math.min(scale, 1.2)); // font cap

export const SCREEN = { W, H };

export const COLORS = {
  // Brand
  primary:       '#6366f1',
  primaryDark:   '#4f46e5',
  primaryLight:  '#eef2ff',
  primaryMid:    '#c7d2fe',

  // Semantic
  success:       '#10b981',
  successLight:  '#d1fae5',
  warning:       '#f59e0b',
  warningLight:  '#fef9c3',
  danger:        '#ef4444',
  dangerLight:   '#fee2e2',
  info:          '#3b82f6',
  infoLight:     '#dbeafe',

  // Neutrals
  background:    '#f8fafc',
  card:          '#ffffff',
  cardAlt:       '#f1f5f9',
  border:        '#e2e8f0',
  borderLight:   '#f1f5f9',

  // Text
  text:          '#0f172a',
  textSecondary: '#475569',
  textLight:     '#94a3b8',
  textInverse:   '#ffffff',

  // Gradients (for LinearGradient — use as arrays)
  gradPrimary:   ['#6366f1', '#818cf8'],
  gradSuccess:   ['#10b981', '#34d399'],
  gradWarm:      ['#f59e0b', '#fbbf24'],
  gradDanger:    ['#ef4444', '#f87171'],
};

export const FONTS = {
  xs:   rf(11),
  sm:   rf(13),
  md:   rf(15),
  lg:   rf(17),
  xl:   rf(20),
  xxl:  rf(26),
  xxxl: rf(32),
};

export const SIZES = {
  xs:       rs(4),
  sm:       rs(8),
  md:       rs(16),
  lg:       rs(24),
  xl:       rs(32),
  xxl:      rs(48),
  radius:   rs(16),
  radiusSm: rs(10),
  radiusLg: rs(24),
  radiusXl: rs(32),
  icon:     rs(28),   // standard icon size
  iconLg:   rs(40),   // large icon
  iconXl:   rs(56),   // hero icon
  avatar:   rs(52),
};

export const SHADOWS = {
  sm: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  colored: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  }),
};
