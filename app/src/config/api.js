import axios from 'axios';
import { Platform } from 'react-native';

// ─── Auto-detect correct API URL ─────────────────────────────
// Web browser (Expo web)  → localhost
// Android Emulator        → 10.0.2.2  (maps to host machine)
// iOS Simulator           → localhost
// Physical device         → your LAN IP (set DEVICE_IP below)
const DEVICE_LAN_IP = '192.168.1.23'; // ← update if your IP changes

function getBaseURL() {
  if (Platform.OS === 'web') {
    // Running in browser — use same host
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      return `http://${host}:3000/api`;
    }
    return 'http://localhost:3000/api';
  }
  if (Platform.OS === 'android') {
    // Android emulator routes 10.0.2.2 → host machine localhost
    return `http://10.0.2.2:3000/api`;
  }
  // iOS simulator or physical device
  return `http://${DEVICE_LAN_IP}:3000/api`;
}

const BASE_URL = getBaseURL();
console.log('[API] Base URL:', BASE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'Network error — is the API server running?';
    console.warn('[API Error]', error.config?.url, message);
    return Promise.reject(new Error(message));
  }
);

export default api;
export { BASE_URL };
