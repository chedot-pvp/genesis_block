import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../src/store/gameStore';
import { leaderboardApi } from '../../src/api/client';
import { formatSatoshi, formatHashrate } from '../../src/utils/formatters';

type LeaderboardType = 'balance' | 'power' | 'referrals';

interface LeaderboardUser {
  rank: number;
  telegram_id: number;
  username: string;
  first_name: string;
  balance_satoshi: number;
  total_power: number;
  total_referrals: number;
  referral_earnings: number;
}

export default function LeaderboardScreen() {
  const { user } = useGameStore();
  const [type, setType] = useState<LeaderboardType>('balance');
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await leaderboardApi.getLeaderboard(type, 100);
      setLeaderboard(response.data);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    setRefreshing(false);
  };

  const tabs: { key: LeaderboardType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'balance', label: 'Баланс', icon: 'wallet' },
    { key: 'power', label: 'Хэшрейт', icon: 'flash' },
    { key: 'referrals', label: 'Рефералы', icon: 'people' },
  ];

  const getValue = (item: LeaderboardUser) => {
    switch (type) {
      case 'balance':
        return formatSatoshi(item.balance_satoshi);
      case 'power':
        return formatHashrate(item.total_power);
      case 'referrals':
        return `${item.total_referrals} друзей`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return '#FFD700';
      case 2:
        return '#C0C0C0';
      case 3:
        return '#CD7F32';
      default:
        return '#888';
    }
  };

  const renderItem = ({ item }: { item: LeaderboardUser }) => {
    const isCurrentUser = user?.telegram_id === item.telegram_id;

    return (
      <View style={[styles.leaderItem, isCurrentUser && styles.leaderItemCurrent]}>
        <View style={styles.rankContainer}>
          {item.rank <= 3 ? (
            <Ionicons name="trophy" size={24} color={getRankColor(item.rank)} />
          ) : (
            <Text style={styles.rankText}>#{item.rank}</Text>
          )}
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, isCurrentUser && styles.userNameCurrent]}>
            {item.first_name || item.username || `Player ${item.telegram_id}`}
            {isCurrentUser && ' (Вы)'}
          </Text>
          <Text style={styles.userHandle}>
            @{item.username || 'anonymous'}
          </Text>
        </View>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>{getValue(item)}</Text>
        </View>
      </View>
    );
  };

  const userRank = leaderboard.findIndex((l) => l.telegram_id === user?.telegram_id) + 1;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Рейтинг</Text>

      {userRank > 0 && (
        <View style={styles.userRankCard}>
          <Text style={styles.userRankLabel}>Ваша позиция</Text>
          <View style={styles.userRankRow}>
            <Ionicons name={userRank <= 3 ? 'trophy' : 'medal'} size={24} color={getRankColor(userRank)} />
            <Text style={styles.userRankValue}>#{userRank}</Text>
            <Text style={styles.userRankOf}>из {leaderboard.length}</Text>
          </View>
        </View>
      )}

      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, type === tab.key && styles.tabActive]}
            onPress={() => setType(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={type === tab.key ? '#000' : '#888'}
            />
            <Text style={[styles.tabText, type === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.telegram_id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7931A" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={48} color="#444" />
            <Text style={styles.emptyText}>
              {loading ? 'Загрузка...' : 'Пока нет данных'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userRankCard: {
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F7931A',
  },
  userRankLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  userRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userRankValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  userRankOf: {
    color: '#888',
    fontSize: 14,
    marginLeft: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#F7931A',
  },
  tabText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  tabTextActive: {
    color: '#000',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  leaderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  leaderItemCurrent: {
    borderWidth: 1,
    borderColor: '#F7931A',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  userNameCurrent: {
    color: '#F7931A',
  },
  userHandle: {
    color: '#666',
    fontSize: 12,
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  valueText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
});
