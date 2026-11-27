import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useWebInstall() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const hadController = !!navigator.serviceWorker.controller;
    let reloadScheduled = false;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') console.log('[KODUS SW] новая версия установлена, применяется сразу');
          });
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // Перезагружаем один раз за сессию и только если SW именно обновился (не первая установка).
          if (!hadController || reloadScheduled) return;
          reloadScheduled = true;
          try {
            if (sessionStorage.getItem('kodus.swReloaded')) return;
            sessionStorage.setItem('kodus.swReloaded', '1');
            window.location.reload();
          } catch { /* приватный режим — без перезагрузки */ }
        });
        void reg.update();
      } catch { /* офлайн при первом заходе — не критично */ }
    };

    void register();
    const onOnline = () => { void navigator.serviceWorker.getRegistration().then(r => r?.update()); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);
  }