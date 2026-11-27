// services/webPush.ts
import { client } from './kodusService';

// Публичный VAPID-ключ из `web-push generate-vapid-keys`
export const VAPID_PUBLIC_KEY =
  'BI9BXxzVUAiexv2uktYuCwQiXf22oh-kb3mRMdanOhHVFjsKvJO09XM7ZzPvikQPwn28sTwxRRMqrUgTu_luT1c';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function b64(bytes: ArrayBuffer | null): string | null {
  if (!bytes) return null;
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export async function subscribePush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[WebPush] Push API не поддерживается');
    return false;
  }

  if (typeof window === 'undefined' || !window.isSecureContext) {
    console.warn('[WebPush] Push работает только по HTTPS или на localhost');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const { data: session } = await client().auth.getSession();
    if (!session.session) return false;

    const p256dh = b64(sub.getKey('p256dh'));
    const auth = b64(sub.getKey('auth'));

    const { error } = await client()
      .from('kodus_push_subscriptions')
      .upsert(
        {
          user_id: session.session.user.id,
          endpoint: sub.endpoint,
          keys_p256dh: p256dh,
          keys_auth: auth,
          user_agent: navigator.userAgent,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    if (error) {
      console.error('[WebPush] Ошибка сохранения подписки:', error);
      return false;
    }

    console.log('[WebPush] Подписка сохранена:', sub.endpoint);
    return true;
  } catch (e) {
    console.error('[WebPush] Ошибка подписки:', e);
    return false;
  }
}

export async function unsubscribePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await client().from('kodus_push_subscriptions').delete().eq('endpoint', endpoint);
  } catch (e) {
    console.error('[WebPush] Ошибка отписки:', e);
  }
}