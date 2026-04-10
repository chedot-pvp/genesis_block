import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useGameStore } from '../../src/store/gameStore';
import { formatSatoshi, formatHashrate, formatNumber } from '../../src/utils/formatters';

export default function MiningScreen() {
  const router = useRouter();
  const { user, gameState, exchangeRate, instantMine, refreshBlockInfo, fetchInit, logout } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);
  const [miningReward, setMiningReward] = useState<number | null>(null);
  const [timeToBlock, setTimeToBlock] = useState(30);
  const [showMenu, setShowMenu] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, rotateAnim]);

  const refreshBlockInfoSafe = useCallback(() => {
    void refreshBlockInfo();
  }, [refreshBlockInfo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeToBlock((prev) => {
        if (prev <= 1) {
          refreshBlockInfoSafe();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    const blockRefresh = setInterval(() => {
      refreshBlockInfoSafe();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(blockRefresh);
    };
  }, [refreshBlockInfoSafe]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInit();
    setRefreshing(false);
  };

  const handleMine = async () => {
    const reward = await instantMine();
    if (reward > 0) {
      setMiningReward(reward);
      setTimeout(() => setMiningReward(null), 2000);
    }
  };

  const handleLogout = () => {
    logout();
    setShowMenu(false);
    router.replace('/');
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const blocksUntilHalving = gameState
    ? ((gameState.current_epoch + 1) * 210000) - gameState.current_block_number
    : 0;

  const progress = gameState
    ? ((gameState.total_mined_satoshi / 2_100_000_000_000_000) * 100).toFixed(4)
    : '0';

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (user?.first_name) {
      return user.first_name.charAt(0).toUpperCase();
    }
    if (user?.username) {
      return user.username.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7931A" />
        }
      >
        <View style={styles.header}>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Баланс</Text>
            <Text style={styles.balanceValue}>
              {formatSatoshi(user?.balance_satoshi || 0)}
            </Text>
          </View>
          
          {/* User Avatar */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => setShowMenu(!showMenu)}
          >
            {user?.photo_url ? (
              <Image 
                source={{ uri: user.photo_url }} 
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.onlineIndicator} />
          </TouchableOpacity>
        </View>

        {/* Dropdown Menu */}
        {showMenu && (
          <View style={styles.dropdownMenu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuUsername}>
                {user?.first_name || user?.username || 'Player'}
              </Text>
              <Text style={styles.menuHashrate}>
                {formatHashrate(user?.total_power || 0)}
              </Text>
            </View>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
              <Text style={styles.menuItemTextRed}>Выйти</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Hashrate Badge */}
        <View style={styles.hashrateBadgeRow}>
          <View style={styles.hashrateContainer}>
            <Ionicons name="flash" size={16} color="#F7931A" />
            <Text style={styles.hashrateValue}>
              {formatHashrate(user?.total_power || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.miningSection}>
          <Animated.View style={[styles.miningCircle, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.mineButton} onPress={handleMine} activeOpacity={0.7}>
              <Animated.View style={{ transform: [{ rotate: spin }] }}>
                <Ionicons name="hardware-chip" size={60} color="#F7931A" />
              </Animated.View>
              <Text style={styles.mineButtonText}>МАЙНИТЬ</Text>
            </TouchableOpacity>
          </Animated.View>

          {miningReward !== null && (
            <Animated.View style={styles.rewardPopup}>
              <Text style={styles.rewardText}>+{miningReward} sat</Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.blockInfoCard}>
          <View style={styles.blockInfoRow}>
            <View style={styles.blockInfoItem}>
              <Text style={styles.blockInfoLabel}>Блок</Text>
              <Text style={styles.blockInfoValue}>
                #{formatNumber(gameState?.current_block_number || 0)}
              </Text>
            </View>
            <View style={styles.blockInfoItem}>
              <Text style={styles.blockInfoLabel}>До блока</Text>
              <Text style={styles.blockInfoValue}>{timeToBlock}с</Text>
            </View>
            <View style={styles.blockInfoItem}>
              <Text style={styles.blockInfoLabel}>Эпоха</Text>
              <Text style={styles.blockInfoValue}>{gameState?.current_epoch || 0}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.blockInfoRow}>
            <View style={styles.blockInfoItem}>
              <Text style={styles.blockInfoLabel}>Награда за блок</Text>
              <Text style={styles.blockInfoValue}>
                {formatSatoshi(gameState?.block_reward_satoshi || 0)}
              </Text>
            </View>
            <View style={styles.blockInfoItem}>
              <Text style={styles.blockInfoLabel}>До халвинга</Text>
              <Text style={styles.blockInfoValue}>{formatNumber(blocksUntilHalving)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Сеть</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="globe" size={20} color="#666" />
              <Text style={styles.statLabel}>Общий хэшрейт</Text>
              <Text style={styles.statValue}>
                {formatHashrate(gameState?.total_network_power || 0)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="pie-chart" size={20} color="#666" />
              <Text style={styles.statLabel}>Ваша доля</Text>
              <Text style={styles.statValue}>
                {gameState && user
                  ? ((user.total_power / Math.max(gameState.total_network_power, 1)) * 100).toFixed(4)
                  : '0'}%
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Добыто: {progress}% от 21M BTC</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(parseFloat(progress), 100)}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.exchangeCard}>
          <View style={styles.exchangeRow}>
            <Text style={styles.exchangeLabel}>Курс BTC/Stars</Text>
            <Text style={styles.exchangeValue}>
              1 Star = {formatSatoshi(exchangeRate?.satoshi_per_star || 0)}
            </Text>
          </View>
          <Text style={styles.exchangeHint}>
            Курс вырастет в 2 раза после халвинга!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceContainer: {
    flex: 1,
  },
  balanceLabel: {
    color: '#888',
    fontSize: 12,
  },
  balanceValue: {
    color: '#F7931A',
    fontSize: 28,
    fontWeight: 'bold',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F7931A',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#F7931A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#F7931A',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#0a0a14',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 70,
    right: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 8,
    minWidth: 180,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#2a2a4e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  menuHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  menuUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuHashrate: {
    color: '#F7931A',
    fontSize: 12,
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  menuItemTextRed: {
    color: '#ff4444',
    fontSize: 14,
    marginLeft: 8,
  },
  hashrateBadgeRow: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  hashrateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hashrateValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  miningSection: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  miningCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F7931A',
    shadowColor: '#F7931A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  mineButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mineButtonText: {
    color: '#F7931A',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  rewardPopup: {
    position: 'absolute',
    top: 20,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rewardText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  blockInfoCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  blockInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  blockInfoItem: {
    alignItems: 'center',
  },
  blockInfoLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  blockInfoValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#2a2a4e',
    marginVertical: 12,
  },
  statsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#0f0f1a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F7931A',
    borderRadius: 4,
  },
  exchangeCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
  },
  exchangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exchangeLabel: {
    color: '#888',
    fontSize: 14,
  },
  exchangeValue: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exchangeHint: {
    color: '#666',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
