// hooks/useConnectionStatus.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as api from '@/services/kodusService';

export type ConnectionStatus = 'online' | 'connecting' | 'offline';

const NETWORK_MARKERS = [
  'failed to fetch', 'network request failed', 'load failed', 'fetch failed',
  'internet_disconnected', 'networkerror', 'network timed out', 'aborted', 'timeout'
];

const isNetworkError = (msg: string) => {
  const lower = msg.toLowerCase();
  return NETWORK_MARKERS.some(m => lower.includes(m));
};

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const alive = useRef(true);
  const busy = useRef(false);

  const probe = useCallback(async () => {
    if (busy.current || !alive.current) return;
    busy.current = true;

    try {
      // 1. Для Web PWA сначала проверяем нативный статус браузера
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine) {
        if (alive.current) setStatus('offline');
        return;
      }

      // 2. Лёгкая проверка связи с сервером через сессию (не зависит от RLS таблиц)
      const { error } = await api.client().auth.getSession();

      if (!alive.current) return;

      if (error) {
        // Если ошибка сетевая — значит офлайн. Если другая (например, токены) — сервер доступен.
        const lost = isNetworkError(error.message);
        setStatus(lost ? 'offline' : 'online');
      } else {
        setStatus('online');
      }
    } catch (e) {
      if (alive.current) {
        const msg = e instanceof Error ? e.message : '';
        setStatus(isNetworkError(msg) ? 'offline' : 'connecting');
      }
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void probe();

    const onOnline = () => void probe();
    const onOffline = () => { if (alive.current) setStatus('offline'); };

    // Слушатели событий браузера (работают только в Web)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }

    // Периодическая проверка каждые 10 секунд
    const timer = setInterval(() => {
      const isWebActive = Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'visible';
      if (isWebActive) {
        void probe();
      }
    }, 10000);

    return () => {
      alive.current = false;
      clearInterval(timer);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, [probe]);

  return status;
}