import { create } from 'zustand';
import { authApi, gameApi, minersApi, exchangeApi, leaderboardApi, referralApi } from '../api/client';

export interface User {
  id: string;
  telegram_id: number;
  username: string;
  first_name: string;
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
}

export const useGameStore = create<GameStore>((set, get) => ({
  user: null,
  gameState: null,
  miners: [],
  userMiners: {},
  exchangeRate: null,
  isLoading: false,
  error: null,

  login: async (initData: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.telegramAuth(initData);
      const { user, token } = response.data;
      set({ user });
      
      // Fetch full init data
      const initResponse = await gameApi.getInit(user.id);
      const data = initResponse.data;
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
      const response = await gameApi.getInit(user.id);
      const data = response.data;
      set({
        user: data.user,
        gameState: data.game_state,
        miners: data.miners,
        userMiners: data.user_miners,
        exchangeRate: data.exchange_rate,
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  buyMiner: async (minerId: string, quantity: number = 1) => {
    const { user } = get();
    if (!user) return false;
    
    try {
      const response = await minersApi.buyMiner(user.id, minerId, quantity);
      const { user: updatedUser, user_miners } = response.data;
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
      const response = await gameApi.instantMine(user.id);
      const { reward, user: updatedUser } = response.data;
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

  setUser: (user: User) => set({ user }),
  clearError: () => set({ error: null }),
}));
