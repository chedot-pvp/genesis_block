import { create } from 'zustand';
import { authApi, gameApi, minersApi } from '../api/client';

export interface User {
  id: string;
  telegram_id: number;
  username: string;
  first_name: string;
  photo_url?: string;
  total_power: number;
  balance_satoshi: number;
  balance_stars: number;
  referral_code: string;
  total_referrals: number;
  referral_earnings: number;
  speed_boost: number;
}

export interface GameState {
  current_block_number: number;
  total_mined_satoshi: number;
  current_epoch: number;
  block_reward_satoshi: number;
  total_network_power: number;
}

export interface Miner {
  id: string;
  name: string;
  era: string;
  power_hash_per_second: number;
  price_satoshi: number;
  unlock_block: number;
  historical_fact: string;
}

export interface ExchangeRate {
  btc_per_star: number;
  satoshi_per_star: number;
  stars_per_btc: number;
  epoch: number;
}

// Simple localStorage wrapper for web, returns null for native
const storage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
};
const TOKEN_KEY = 'genesis_token';

interface GameStore {
  user: User | null;
  gameState: GameState | null;
  miners: Miner[];
  userMiners: Record<string, number>;
  exchangeRate: ExchangeRate | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (initData: string) => Promise<void>;
  fetchInit: () => Promise<void>;
  buyMiner: (minerId: string, quantity?: number) => Promise<boolean>;
  instantMine: () => Promise<number>;
  refreshBlockInfo: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  logout: () => void;
  loadSavedSession: () => User | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  user: null,
  gameState: null,
  miners: [],
  userMiners: {},
  exchangeRate: null,
  isLoading: false,
  error: null,

  loadSavedSession: () => {
    try {
      const saved = storage.getItem('genesis_user');
      const token = storage.getItem(TOKEN_KEY);
      if (!token) {
        storage.removeItem('genesis_user');
        return null;
      }
      if (saved) {
        const user = JSON.parse(saved);
        set({ user });
        return user;
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
    return null;
  },

  login: async (initData: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.telegramAuth(initData);
      const { user, token } = response.data;
      if (!token) {
        throw new Error('Missing authentication token');
      }
      
      // Save to storage
      storage.setItem('genesis_user', JSON.stringify(user));
      storage.setItem(TOKEN_KEY, token);
      set({ user });
      
      // Fetch full init data
      const initResponse = await gameApi.getInit();
      const data = initResponse.data;
      
      // Update storage with full user data
      storage.setItem('genesis_user', JSON.stringify(data.user));
      
      set({
        user: data.user,
        gameState: data.game_state,
        miners: data.miners,
        userMiners: data.user_miners,
        exchangeRate: data.exchange_rate,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message || 'Login failed', isLoading: false });
      throw error;
    }
  },

  fetchInit: async () => {
    const { user } = get();
    if (!user) return;
    
    set({ isLoading: true });
    try {
      const response = await gameApi.getInit();
      const data = response.data;
      
      // Update storage
      storage.setItem('genesis_user', JSON.stringify(data.user));
      
      set({
        user: data.user,
        gameState: data.game_state,
        miners: data.miners,
        userMiners: data.user_miners,
        exchangeRate: data.exchange_rate,
        isLoading: false,
      });
    } catch (error: any) {
      // If session invalid, logout
      if (error.response?.status === 404 || error.response?.status === 401) {
        storage.removeItem('genesis_user');
        storage.removeItem(TOKEN_KEY);
        set({ user: null, gameState: null, miners: [], userMiners: {}, exchangeRate: null, isLoading: false });
      } else {
        set({ error: error.message, isLoading: false });
      }
    }
  },

  buyMiner: async (minerId: string, quantity: number = 1) => {
    const { user } = get();
    if (!user) return false;
    
    try {
      const response = await minersApi.buyMiner(minerId, quantity);
      const { user: updatedUser, user_miners } = response.data;
      storage.setItem('genesis_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, userMiners: user_miners });
      return true;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Purchase failed' });
      return false;
    }
  },

  instantMine: async () => {
    const { user } = get();
    if (!user) return 0;
    
    try {
      const response = await gameApi.instantMine();
      const { reward, user: updatedUser } = response.data;
      storage.setItem('genesis_user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return reward;
    } catch (error: any) {
      set({ error: error.response?.data?.detail || 'Mining failed' });
      return 0;
    }
  },

  refreshBlockInfo: async () => {
    try {
      const response = await gameApi.getBlockInfo();
      set({ gameState: response.data, exchangeRate: response.data.exchange_rate });
    } catch (error: any) {
      console.error('Failed to refresh block info:', error);
    }
  },

  setUser: (user: User) => {
    storage.setItem('genesis_user', JSON.stringify(user));
    set({ user });
  },
  clearError: () => set({ error: null }),
  logout: () => {
    storage.removeItem('genesis_user');
    storage.removeItem(TOKEN_KEY);
    set({ 
      user: null, 
      gameState: null, 
      miners: [], 
      userMiners: {}, 
      exchangeRate: null 
    });
  },
}));
