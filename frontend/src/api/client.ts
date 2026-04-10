import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TOKEN_STORAGE_KEY = 'genesis_token';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v2`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth API
export const authApi = {
  telegramAuth: (initData: string) =>
    api.post('/auth/telegram', { init_data: initData }),
  applyReferral: (referralCode: string) =>
    api.post(`/auth/referral?referral_code=${encodeURIComponent(referralCode)}`),
};

// Game API
export const gameApi = {
  getInit: () => api.get('/init'),
  getBlockInfo: () => api.get('/block/info'),
  instantMine: () => api.post('/mine/instant'),
};

// Miners API
export const minersApi = {
  getMiners: () => api.get('/miners'),
  buyMiner: (minerId: string, quantity: number = 1) =>
    api.post('/miners/buy', { miner_id: minerId, quantity }),
};

// Exchange API
export const exchangeApi = {
  getRate: () => api.get('/exchange/rate'),
  buyBtc: (starsAmount: number) =>
    api.post('/exchange/buy', { amount: starsAmount }),
  sellBtc: (satoshiAmount: number) =>
    api.post('/exchange/sell', { amount: satoshiAmount }),
};

// Leaderboard API
export const leaderboardApi = {
  getLeaderboard: (type: 'balance' | 'power' | 'referrals' = 'balance', limit: number = 100) =>
    api.get(`/leaderboard?type=${type}&limit=${limit}`),
};

// Referral API
export const referralApi = {
  getInfo: () => api.get('/referral/info'),
  getTopReferrers: (limit: number = 10) => api.get(`/referral/top?limit=${limit}`),
};
