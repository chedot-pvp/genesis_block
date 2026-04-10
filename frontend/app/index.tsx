import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../src/store/gameStore';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, fetchInit, loadSavedSession } = useGameStore();
  const [localLoading, setLocalLoading] = useState(false);
  const [initialCheck, setInitialCheck] = useState(true);
  const [loginStatus, setLoginStatus] = useState<string>('');

  const ensureTelegramSdk = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    // @ts-ignore
    if (window.Telegram?.WebApp) return;

    const existing = document.querySelector('script[data-telegram-webapp="1"]');
    if (existing) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      script.setAttribute('data-telegram-webapp', '1');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Telegram WebApp SDK'));
      document.head.appendChild(script);
    });
  }, []);

  const getTelegramInitData = useCallback(async (): Promise<string> => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
    await ensureTelegramSdk();
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (!tg) return '';

    try {
      tg.ready?.();
      tg.expand?.();
    } catch (e) {
      console.warn('Telegram WebApp ready/expand failed:', e);
    }

    // In some clients initData is not populated immediately.
    for (let i = 0; i < 10; i += 1) {
      if (tg.initData && tg.initData.length > 0) {
        return tg.initData;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Fallback: Telegram may pass data in URL hash/query.
    try {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const queryParams = new URLSearchParams(window.location.search);
      const fromHash = hashParams.get('tgWebAppData');
      const fromQuery = queryParams.get('tgWebAppData');
      const raw = fromHash || fromQuery || '';
      if (raw) {
        return decodeURIComponent(raw);
      }
    } catch (e) {
      console.warn('Failed to parse tgWebAppData fallback:', e);
    }
    return '';
  }, [ensureTelegramSdk]);

  const checkSession = useCallback(async () => {
      // In Telegram WebApp we always refresh auth from current initData.
      const initData = await getTelegramInitData();
      if (initData) {
        try {
          await login(initData);
          router.replace('/(tabs)');
          return;
        } catch (e) {
          console.error('Telegram session refresh failed:', e);
          setInitialCheck(false);
          return;
        }
      }

      const savedUser = loadSavedSession();
      if (savedUser) {
        try {
          await fetchInit();
          if (useGameStore.getState().user) {
            router.replace('/(tabs)');
            return;
          }
        } catch (e) {
          console.error('Session check failed:', e);
        }
      }
      setInitialCheck(false);
  }, [fetchInit, getTelegramInitData, loadSavedSession, login, router]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const handleLogin = useCallback(async () => {
    setLocalLoading(true);
    setLoginStatus('');
    try {
      setLoginStatus('Получаем данные Telegram...');
      const initData = await getTelegramInitData();

      if (!initData) {
        setLoginStatus('Telegram initData не найден. Закройте и заново откройте Mini App из бота.');
        return;
      }

      setLoginStatus('Выполняем вход...');
      await login(initData);
      setLoginStatus('');
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Login error:', err);
      const message = err?.response?.data?.detail || err?.message || 'Не удалось войти через Telegram';
      setLoginStatus(message);
    } finally {
      setLocalLoading(false);
    }
  }, [getTelegramInitData, login, router]);

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
      {!!loginStatus && <Text style={styles.errorText}>{loginStatus}</Text>}

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
