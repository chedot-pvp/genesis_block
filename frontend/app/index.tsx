import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../src/store/gameStore';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, fetchInit, loadSavedSession } = useGameStore();
  const [localLoading, setLocalLoading] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);

  const checkSession = useCallback(async () => {
      const savedUser = loadSavedSession();
      if (savedUser) {
        try {
          await fetchInit();
          // If still has user, navigate to main
          if (useGameStore.getState().user) {
            router.replace('/(tabs)');
            return;
          }
        } catch (e) {
          console.error('Session check failed:', e);
        }
      }
      setInitialCheck(false);
  }, [fetchInit, loadSavedSession, router]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleLogin = async () => {
    setLocalLoading(true);
    try {
      let initData = '';
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // @ts-ignore
        const tg = window.Telegram?.WebApp;
        if (tg?.initData) {
          initData = tg.initData;
        }
      }

      if (!initData) {
        Alert.alert(
          'Telegram required',
          'Open this app from Telegram to sign in securely.'
        );
        return;
      }

      await login(initData);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setLocalLoading(false);
    }
  };

  // Show loading while checking session
  if (initialCheck) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.bitcoinIcon}>
            <Text style={styles.bitcoinSymbol}>₿</Text>
          </View>
          <ActivityIndicator size="large" color="#F7931A" style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.bitcoinIcon}>
          <Text style={styles.bitcoinSymbol}>₿</Text>
        </View>
        <Text style={styles.title}>Genesis Block</Text>
        <Text style={styles.subtitle}>Bitcoin Mining Simulator</Text>
      </View>

      <View style={styles.features}>
        <View style={styles.featureItem}>
          <Ionicons name="flash" size={24} color="#F7931A" />
          <Text style={styles.featureText}>Майни BTC каждые 30 секунд</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="hardware-chip" size={24} color="#F7931A" />
          <Text style={styles.featureText}>Покупай майнеры от CPU до ASIC</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="trending-up" size={24} color="#F7931A" />
          <Text style={styles.featureText}>Наблюдай за ростом курса BTC</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#F7931A" />
          <Text style={styles.featureText}>Приглашай друзей и получай бонусы</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={handleLogin}
        disabled={localLoading || isLoading}
      >
        {localLoading || isLoading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="paper-plane" size={20} color="#000" />
            <Text style={styles.loginButtonText}>Войти через Telegram</Text>
          </>
        )}
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.disclaimer}>
        Симулятор майнинга Bitcoin. Виртуальные BTC не имеют реальной стоимости.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  bitcoinIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F7931A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  bitcoinSymbol: {
    fontSize: 60,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  features: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  featureText: {
    color: '#ccc',
    fontSize: 14,
    marginLeft: 12,
  },
  loginButton: {
    flexDirection: 'row',
    backgroundColor: '#F7931A',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  errorText: {
    color: '#ff4444',
    marginTop: 16,
    textAlign: 'center',
  },
  disclaimer: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});
