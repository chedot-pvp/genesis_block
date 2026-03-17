import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth API
export const authApi = {
  telegramAuth: (initData: string) =>
    api.post('/auth/telegram', { init_data: initData }),
  applyReferral: (userId: string, referralCode: string) =>
    api.post(`/auth/referral?user_id=${userId}&referral_code=${referralCode}`),
};

// Game API
export const gameApi = {
  getInit: (userId: string) => api.get(`/init?user_id=${userId}`),
  getBlockInfo: () => api.get('/block/info'),
  instantMine: (userId: string) => api.post(`/mine/instant?user_id=${userId}`),
};

// Miners API
export const minersApi = {
  getMiners: () => api.get('/miners'),
  buyMiner: (userId: string, minerId: string, quantity: number = 1) =>
    api.post(`/miners/buy?user_id=${userId}`, { miner_id: minerId, quantity }),
};

// Exchange API
export const exchangeApi = {
  getRate: () => api.get('/exchange/rate'),
  buyBtc: (userId: string, starsAmount: number) =>
    api.post(`/exchange/buy?user_id=${userId}`, { amount: starsAmount }),
  sellBtc: (userId: string, satoshiAmount: number) =>
    api.post(`/exchange/sell?user_id=${userId}`, { amount: satoshiAmount }),
};

// Leaderboard API
export const leaderboardApi = {
  getLeaderboard: (type: 'balance' | 'power' | 'referrals' = 'balance', limit: number = 100) =>
    api.get(`/leaderboard?type=${type}&limit=${limit}`),
};

// Referral API
export const referralApi = {
  getInfo: (userId: string) => api.get(`/referral/info?user_id=${userId}`),
  getTopReferrers: (limit: number = 10) => api.get(`/referral/top?limit=${limit}`),
};
