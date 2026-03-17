import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../src/store/gameStore';
import { MinerCard } from '../../src/components/MinerCard';
import { formatSatoshi, formatHashrate } from '../../src/utils/formatters';

type EraFilter = 'all' | 'cpu' | 'gpu' | 'fpga' | 'asic';

export default function MinersScreen() {
  const { user, miners, userMiners, gameState, fetchInit } = useGameStore();
  const [refreshing, setRefreshing] = useState(false);
  const [eraFilter, setEraFilter] = useState<EraFilter>('all');

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInit();
    setRefreshing(false);
  };

  const filteredMiners = miners.filter(
    (m) => eraFilter === 'all' || m.era === eraFilter
  );

  const eras: { key: EraFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Все', color: '#888' },
    { key: 'cpu', label: 'CPU', color: '#4CAF50' },
    { key: 'gpu', label: 'GPU', color: '#2196F3' },
    { key: 'fpga', label: 'FPGA', color: '#9C27B0' },
    { key: 'asic', label: 'ASIC', color: '#FF9800' },
  ];

  const totalOwned = Object.values(userMiners).reduce((sum, qty) => sum + qty, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Магазин майнеров</Text>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceText}>
            {formatSatoshi(user?.balance_satoshi || 0)}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="hardware-chip" size={20} color="#F7931A" />
          <Text style={styles.statValue}>{totalOwned}</Text>
          <Text style={styles.statLabel}>Майнеров</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="flash" size={20} color="#F7931A" />
          <Text style={styles.statValue}>{formatHashrate(user?.total_power || 0)}</Text>
          <Text style={styles.statLabel}>Хэшрейт</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="cube" size={20} color="#F7931A" />
          <Text style={styles.statValue}>#{gameState?.current_block_number || 0}</Text>
          <Text style={styles.statLabel}>Блок</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {eras.map((era) => (
          <TouchableOpacity
            key={era.key}
            style={[
              styles.filterChip,
              eraFilter === era.key && { backgroundColor: era.color },
            ]}
            onPress={() => setEraFilter(era.key)}
          >
            <Text
              style={[
                styles.filterText,
                eraFilter === era.key && styles.filterTextActive,
              ]}
            >
              {era.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.minersGrid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7931A" />
        }
      >
        {filteredMiners.map((miner) => (
          <MinerCard
            key={miner.id}
            miner={miner}
            owned={userMiners[miner.id] || 0}
            currentBlock={gameState?.current_block_number || 0}
            userBalance={user?.balance_satoshi || 0}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a14',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  balanceChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  balanceText: {
    color: '#F7931A',
    fontSize: 14,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1a1a2e',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    paddingVertical: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
  },
  filterContainer: {
    maxHeight: 50,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
  },
  filterChip: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  minersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
});
