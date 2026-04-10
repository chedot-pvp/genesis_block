import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useGameStore } from '../../src/store/gameStore';
import { referralApi } from '../../src/api/client';
import { formatSatoshi, formatHashrate } from '../../src/utils/formatters';

interface Referral {
  username: string;
  first_name: string;
  total_power: number;
  created_at: string;
}

interface ReferralInfo {
  referral_code: string;
  total_referrals: number;
  referral_earnings: number;
  referrals: Referral[];
}

export default function FriendsScreen() {
  const { user } = useGameStore();
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchReferralInfo = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const response = await referralApi.getInfo();
      setReferralInfo(response.data);
    } catch (error) {
      console.error('Failed to fetch referral info:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReferralInfo();
  }, [fetchReferralInfo]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReferralInfo();
    setRefreshing(false);
  };

  const referralLink = `https://t.me/GenesisBlockBot?start=${referralInfo?.referral_code || ''}`;

  const copyLink = async () => {
    await Clipboard.setStringAsync(referralLink);
    Alert.alert('Скопировано!', 'Реферальная ссылка скопирована в буфер обмена');
  };

  const shareLink = async () => {
    try {
      await Share.share({
        message: `Присоединяйся к Genesis Block - симулятору майнинга Bitcoin!\n\nМайни BTC, покупай майнеры и соревнуйся с друзьями!\n\n${referralLink}`,
        title: 'Genesis Block',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const bonuses = [
    {
      icon: 'gift',
      title: 'Бонус за регистрацию',
      description: '100,000 сатоши за каждого друга',
      color: '#F7931A',
    },
    {
      icon: 'trending-up',
      title: 'Пассивный доход',
      description: '3% от дохода друзей',
      color: '#4CAF50',
    },
    {
      icon: 'trophy',
      title: 'Еженедельный рейтинг',
      description: 'Бустеры скорости для топ-рефереров',
      color: '#9C27B0',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7931A" />
        }
      >
        <Text style={styles.title}>Друзья</Text>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={28} color="#F7931A" />
            <Text style={styles.statValue}>{referralInfo?.total_referrals || 0}</Text>
            <Text style={styles.statLabel}>Приглашено</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.btcIcon}>₿</Text>
            <Text style={styles.statValue}>
              {formatSatoshi(referralInfo?.referral_earnings || 0)}
            </Text>
            <Text style={styles.statLabel}>Заработано</Text>
          </View>
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.linkTitle}>Ваша реферальная ссылка</Text>
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>
              {referralLink}
            </Text>
          </View>
          <View style={styles.linkButtons}>
            <TouchableOpacity style={styles.linkButton} onPress={copyLink}>
              <Ionicons name="copy" size={20} color="#000" />
              <Text style={styles.linkButtonText}>Копировать</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.linkButton, styles.linkButtonShare]}
              onPress={shareLink}
            >
              <Ionicons name="share-social" size={20} color="#fff" />
              <Text style={[styles.linkButtonText, styles.linkButtonTextShare]}>
                Поделиться
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bonusesCard}>
          <Text style={styles.bonusesTitle}>Бонусы за друзей</Text>
          {bonuses.map((bonus, index) => (
            <View key={index} style={styles.bonusItem}>
              <View style={[styles.bonusIcon, { backgroundColor: bonus.color + '20' }]}>
                <Ionicons name={bonus.icon as any} size={24} color={bonus.color} />
              </View>
              <View style={styles.bonusInfo}>
                <Text style={styles.bonusTitle}>{bonus.title}</Text>
                <Text style={styles.bonusDescription}>{bonus.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.friendsCard}>
          <Text style={styles.friendsTitle}>Ваши друзья</Text>
          {referralInfo?.referrals && referralInfo.referrals.length > 0 ? (
            referralInfo.referrals.map((friend, index) => (
              <View key={index} style={styles.friendItem}>
                <View style={styles.friendAvatar}>
                  <Ionicons name="person" size={20} color="#888" />
                </View>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>
                    {friend.first_name || friend.username || 'Anonymous'}
                  </Text>
                  <Text style={styles.friendPower}>
                    {formatHashrate(friend.total_power)}
                  </Text>
                </View>
                <View style={styles.friendEarning}>
                  <Text style={styles.friendEarningText}>+3%</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyFriends}>
              <Ionicons name="people-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>
                {loading ? 'Загрузка...' : 'Пока нет приглашённых друзей'}
              </Text>
              <Text style={styles.emptyHint}>
                Поделитесь ссылкой и получайте бонусы!
              </Text>
            </View>
          )}
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
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2a4e',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  btcIcon: {
    color: '#F7931A',
    fontSize: 28,
    fontWeight: 'bold',
  },
  linkCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  linkTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  linkBox: {
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  linkText: {
    color: '#888',
    fontSize: 12,
  },
  linkButtons: {
    flexDirection: 'row',
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7931A',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
  },
  linkButtonShare: {
    backgroundColor: '#2196F3',
    marginRight: 0,
    marginLeft: 8,
  },
  linkButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  linkButtonTextShare: {
    color: '#fff',
  },
  bonusesCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bonusesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  bonusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bonusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bonusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  bonusTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  bonusDescription: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  friendsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
  },
  friendsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a2a4e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  friendPower: {
    color: '#888',
    fontSize: 12,
  },
  friendEarning: {
    backgroundColor: '#4CAF5020',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  friendEarningText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyFriends: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
  emptyHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
});
