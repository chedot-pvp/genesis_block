import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../../src/store/gameStore';
import { formatSatoshi } from '../../src/utils/formatters';
import { exchangeApi } from '../../src/api/client';

type ExchangeTab = 'buy' | 'sell';

export default function ExchangeScreen() {
  const { user, exchangeRate, gameState, fetchInit, setUser } = useGameStore();
  const [tab, setTab] = useState<ExchangeTab>('buy');
  const [amount, setAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInit();
    setRefreshing(false);
  };

  const calculateResult = () => {
    const numAmount = parseInt(amount) || 0;
    if (!exchangeRate || numAmount <= 0) return 0;

    if (tab === 'buy') {
      return numAmount * exchangeRate.satoshi_per_star;
    } else {
      return Math.floor(numAmount / exchangeRate.satoshi_per_star);
    }
  };

  const handleExchange = async () => {
    if (!user || !amount) return;

    const numAmount = parseInt(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'buy') {
        if (numAmount > (user.balance_stars || 0)) {
          Alert.alert('Ошибка', 'Недостаточно Stars');
          return;
        }
        const response = await exchangeApi.buyBtc(user.id, numAmount);
        setUser(response.data.user);
        Alert.alert('Успех', `Вы получили ${formatSatoshi(calculateResult())}`);
      } else {
        if (numAmount > (user.balance_satoshi || 0)) {
          Alert.alert('Ошибка', 'Недостаточно BTC');
          return;
        }
        const response = await exchangeApi.sellBtc(user.id, numAmount);
        setUser(response.data.user);
        Alert.alert('Успех', `Вы получили ${calculateResult()} Stars`);
      }
      setAmount('');
    } catch (error: any) {
      Alert.alert('Ошибка', error.response?.data?.detail || 'Обмен не удался');
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = () => {
    if (tab === 'buy') {
      setAmount(String(user?.balance_stars || 0));
    } else {
      setAmount(String(user?.balance_satoshi || 0));
    }
  };

  const epochInfo = [
    { epoch: 0, rate: '10,000 BTC', block: '0 - 210,000' },
    { epoch: 1, rate: '5,000 BTC', block: '210,001 - 420,000' },
    { epoch: 2, rate: '2,500 BTC', block: '420,001 - 630,000' },
    { epoch: 3, rate: '1,250 BTC', block: '630,001 - 840,000' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7931A" />
          }
        >
          <Text style={styles.title}>Обменник</Text>

          <View style={styles.rateCard}>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Текущий курс (Эпоха {exchangeRate?.epoch || 0})</Text>
              <Text style={styles.rateValue}>
                1 Star = {formatSatoshi(exchangeRate?.satoshi_per_star || 0)}
              </Text>
            </View>
            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.balanceText}>{user?.balance_stars || 0} Stars</Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={styles.btcIcon}>₿</Text>
                <Text style={styles.balanceText}>{formatSatoshi(user?.balance_satoshi || 0)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, tab === 'buy' && styles.tabActive]}
              onPress={() => setTab('buy')}
            >
              <Text style={[styles.tabText, tab === 'buy' && styles.tabTextActive]}>
                Купить BTC
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'sell' && styles.tabActive]}
              onPress={() => setTab('sell')}
            >
              <Text style={[styles.tabText, tab === 'sell' && styles.tabTextActive]}>
                Продать BTC
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formLabel}>
              {tab === 'buy' ? 'Количество Stars' : 'Количество сатоши'}
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#555"
              />
              <TouchableOpacity style={styles.maxButton} onPress={setMaxAmount}>
                <Text style={styles.maxButtonText}>MAX</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.resultRow}>
              <Ionicons name="arrow-down" size={24} color="#F7931A" />
            </View>

            <Text style={styles.formLabel}>Вы получите</Text>
            <View style={styles.resultBox}>
              <Text style={styles.resultValue}>
                {tab === 'buy'
                  ? formatSatoshi(calculateResult())
                  : `${calculateResult()} Stars`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.exchangeButton, loading && styles.exchangeButtonDisabled]}
              onPress={handleExchange}
              disabled={loading || !amount}
            >
              <Text style={styles.exchangeButtonText}>
                {loading ? 'Обработка...' : tab === 'buy' ? 'Купить BTC' : 'Продать BTC'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleCard}>
            <Text style={styles.scheduleTitle}>График курса по эпохам</Text>
            <Text style={styles.scheduleHint}>
              Курс растёт в 2 раза после каждого халвинга!
            </Text>
            {epochInfo.map((info) => (
              <View
                key={info.epoch}
                style={[
                  styles.scheduleRow,
                  gameState?.current_epoch === info.epoch && styles.scheduleRowActive,
                ]}
              >
                <View style={styles.scheduleEpoch}>
                  <Text style={styles.scheduleEpochText}>Эпоха {info.epoch}</Text>
                  {gameState?.current_epoch === info.epoch && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>Сейчас</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.scheduleRate}>1 Star = {info.rate}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  rateCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  rateRow: {
    marginBottom: 12,
  },
  rateLabel: {
    color: '#888',
    fontSize: 12,
  },
  rateValue: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
  },
  btcIcon: {
    color: '#F7931A',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#F7931A',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000',
  },
  formCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  maxButton: {
    backgroundColor: '#F7931A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  maxButtonText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  resultBox: {
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  resultValue: {
    color: '#4CAF50',
    fontSize: 24,
    fontWeight: 'bold',
  },
  exchangeButton: {
    backgroundColor: '#F7931A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  exchangeButtonDisabled: {
    backgroundColor: '#555',
  },
  exchangeButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scheduleCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
  },
  scheduleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scheduleHint: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  scheduleRowActive: {
    backgroundColor: '#2a2a4e',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  scheduleEpoch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleEpochText: {
    color: '#fff',
    fontSize: 14,
  },
  currentBadge: {
    backgroundColor: '#F7931A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  currentBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  scheduleRate: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },
});
