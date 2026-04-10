import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const TOKEN_STORAGE_KEY = 'genesis_token';
const USER_STORAGE_KEY = 'genesis_user';

const resolveApiBaseUrl = () => {
  const fromEnv = BACKEND_URL.trim();
  if (fromEnv) {
    return `${fromEnv.replace(/\/+$/, '')}/api/v2`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v2`;
  }
  return 'http://localhost:8085/api/v2';
};

const clearWebSession = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
};

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearWebSession();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  telegramAuth: (initData: string) =>
    api.post('/auth/telegram', { init_data: initData }),
  applyReferral: (referralCode: string) =>
    api.post('/auth/referral', { referral_code: referralCode }),
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
