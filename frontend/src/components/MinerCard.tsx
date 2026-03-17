import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Miner, useGameStore } from '../store/gameStore';
import { formatSatoshi, formatHashrate, getEraColor } from '../utils/formatters';

interface MinerCardProps {
  miner: Miner;
  owned: number;
  currentBlock: number;
  userBalance: number;
}

const formatBlockNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(0)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

export const MinerCard: React.FC<MinerCardProps> = ({
  miner,
  owned,
  currentBlock,
  userBalance,
}) => {
  const { buyMiner, clearError } = useGameStore();
  const isUnlocked = currentBlock >= miner.unlock_block;
  const canAfford = userBalance >= miner.price_satoshi;
  const isFree = miner.price_satoshi === 0;

  const handleBuy = async () => {
    if (!isUnlocked) {
      Alert.alert(
        'Заблокировано',
        `Этот майнер откроется на блоке ${miner.unlock_block.toLocaleString()}`
      );
      return;
    }

    if (!canAfford && !isFree) {
      Alert.alert('Недостаточно средств', 'У вас недостаточно BTC для покупки');
      return;
    }

    const success = await buyMiner(miner.id);
    if (success) {
      Alert.alert(miner.name, miner.historical_fact);
    }
  };

  const handleInfo = () => {
    Alert.alert(miner.name, miner.historical_fact);
  };

  return (
    <View style={[styles.card, !isUnlocked && styles.locked]}>
      <View style={[styles.eraBadge, { backgroundColor: getEraColor(miner.era) }]}>
        <Text style={styles.eraText}>{miner.era.toUpperCase()}</Text>
      </View>

      <TouchableOpacity style={styles.infoButton} onPress={handleInfo}>
        <Ionicons name="information-circle-outline" size={20} color="#888" />
      </TouchableOpacity>

      <View style={styles.iconContainer}>
        <Ionicons
          name={miner.era === 'cpu' ? 'hardware-chip' : miner.era === 'gpu' ? 'tv' : 'server'}
          size={40}
          color={isUnlocked ? getEraColor(miner.era) : '#555'}
        />
      </View>

      <Text style={[styles.name, !isUnlocked && styles.lockedText]} numberOfLines={1}>
        {miner.name}
      </Text>

      <View style={styles.statsRow}>
        <Ionicons name="flash" size={14} color="#F7931A" />
        <Text style={styles.statText}>{formatHashrate(miner.power_hash_per_second)}</Text>
      </View>

      {owned > 0 && (
        <View style={styles.ownedBadge}>
          <Text style={styles.ownedText}>x{owned}</Text>
        </View>
      )}

      {!isUnlocked ? (
        <View style={styles.lockOverlay}>
          <Ionicons name="lock-closed" size={24} color="#888" />
          <Text style={styles.unlockText}>Блок {formatBlockNumber(miner.unlock_block)}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.buyButton,
            !canAfford && !isFree && styles.buyButtonDisabled,
          ]}
          onPress={handleBuy}
          disabled={!canAfford && !isFree}
        >
          <Text style={styles.buyButtonText}>
            {isFree ? 'БЕСПЛАТНО' : formatSatoshi(miner.price_satoshi)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 12,
    margin: 6,
    width: '46%',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#2a2a4e',
  },
  locked: {
    opacity: 0.6,
  },
  eraBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  eraText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  infoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0f0f1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  name: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  lockedText: {
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statText: {
    color: '#aaa',
    fontSize: 11,
    marginLeft: 4,
  },
  ownedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#F7931A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ownedText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lockOverlay: {
    alignItems: 'center',
    marginTop: 4,
  },
  unlockText: {
    color: '#666',
    fontSize: 10,
    marginTop: 2,
  },
  buyButton: {
    backgroundColor: '#F7931A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
    width: '100%',
  },
  buyButtonDisabled: {
    backgroundColor: '#444',
  },
  buyButtonText: {
    color: '#000',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
