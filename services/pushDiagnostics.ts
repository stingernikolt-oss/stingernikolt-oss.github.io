// services/pushDiagnostics.ts
// Пошаговая диагностика цепочки push: браузер → SW → подписка → БД → Edge Function → FCM.
import { Platform } from 'react-native';
import { client } from './kodusService';
import { VAPID_PUBLIC_KEY, subscribePush, unsubscribePush } from './webPush';

const SUPABASE_URL = 'https://slxuizwvssbltffoulzp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZKeuBix0nqz8vzomILUkEQ_4vpftHMx';

export type PushLogLevel = 'info' | 'ok' | 'warn' | 'error';
export interface PushLogEntry { id: number; time: string; level: PushLogLevel; text: string }
export type PushLogger = (level: PushLogLevel, text: string) => void;

const secret = () => (process.env.EXPO_PUBLIC_PUSH_TRIGGER_SECRET ?? '').trim();

function bufToB64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}: таймаут ${ms} мс`)), ms)),
  ]);
}

async function callFunction(payload: unknown): Promise<{ status: number; data: any; text: string }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${secret()}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* не JSON */ }
  return { status: res.status, data, text };
}

function explainStatus(status: number, data: any, log: PushLogger) {
  if (status === 404) log('error', '404 → функция send-push НЕ задеплоена в проект. Задеплой её (Dashboard → Edge Functions или supabase functions deploy).');
  else if (status === 401) log('error', '401 → TRIGGER_SECRET в секретах функции не совпадает с EXPO_PUBLIC_PUSH_TRIGGER_SECRET (или не задан).');
  else if (status === 500 && data?.error?.includes('VAPID')) log('error', '500 → VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY не заданы в секретах функции.');
  else if (status === 500) log('error', `500 → ${data?.error ?? 'внутренняя ошибка'} ${data?.details ?? ''}`);
}

async function getSubscription(log: PushLogger) {
  const reg = await withTimeout(navigator.serviceWorker.ready, 7000, 'serviceWorker.ready');
  const sub = await reg.pushManager.getSubscription();
  if (!sub) { log('warn', 'Подписки pushManager нет. Включи тумблер Push или нажми «Пересоздать подписку».'); return null; }
  log('ok', `Подписка браузера есть: …${sub.endpoint.slice(-24)}`);
  const key = (sub.options as PushSubscriptionOptions & { applicationServerKey?: ArrayBuffer | null }).applicationServerKey;
  if (key) {
    const used = bufToB64Url(key);
    if (used === VAPID_PUBLIC_KEY) log('ok', 'applicationServerKey подписки совпадает с VAPID_PUBLIC_KEY клиента.');
    else log('error', 'Подписка создана с ДРУГИМ VAPID-ключом! Нажми «Пересоздать подписку» и убедись, что секреты функции = ключу клиента.');
  }
  return sub;
}

async function checkDb(log: PushLogger, uid: string, endpoint: string | null) {
  if (endpoint) {
    const { data: row, error } = await client()
      .from('kodus_push_subscriptions').select('id,user_id,endpoint').eq('endpoint', endpoint).maybeSingle();
    if (error) log('error', `БД: ошибка чтения по endpoint (RLS?): ${error.message}`);
    else if (!row) log('warn', 'БД: строки с этим endpoint НЕТ. Либо запись не сохранилась (RLS), либо endpoint перезаписан другим аккаунтом в этом же браузере. Нажми «Пересохранить в БД».');
    else if (row.user_id !== uid) log('error', `БД: endpoint привязан к ЧУЖОМУ user_id (${row.user_id}). Это случай «два аккаунта в одном браузере». Нажми «Пересохранить в БД» под нужным аккаунтом.`);
    else log('ok', 'БД: endpoint привязан к текущему аккаунту. ✔');
  }
  const { data: mine, error: e2 } = await client()
    .from('kodus_push_subscriptions').select('id,endpoint').eq('user_id', uid);
  if (e2) log('error', `БД: ошибка чтения своих подписок: ${e2.message}`);
  else log('info', `БД: подписок текущего аккаунта: ${mine?.length ?? 0}`);
}

export async function runPushDiagnostics(log: PushLogger): Promise<void> {
  log('info', '— Проверка цепочки —');
  if (Platform.OS !== 'web') { log('error', 'Диагностика push доступна только в web-версии.'); return; }
  log('info', `secureContext=${window.isSecureContext}, serviceWorker=${'serviceWorker' in navigator}, PushManager=${'PushManager' in window}, permission=${Notification.permission}`);
  if (!window.isSecureContext) { log('error', 'Нужен HTTPS или localhost.'); return; }
  if (Notification.permission !== 'granted') { log('error', 'Разрешение уведомлений не granted.'); return; }

  const reg = await navigator.serviceWorker.getRegistration('/');
  log(reg?.active ? 'ok' : 'warn', `SW: ${reg?.active ? `active, script=${reg.active.scriptURL}` : 'нет активной регистрации'}`);

  const sub = await getSubscription(log);
  const { data: { session } } = await client().auth.getSession();
  if (!session) { log('error', 'Нет сессии Supabase — войди в аккаунт.'); return; }
  log('ok', `Сессия: user_id=${session.user.id}`);
  await checkDb(log, session.user.id, sub?.endpoint ?? null);

  const s = secret();
  if (!s) { log('error', 'EXPO_PUBLIC_PUSH_TRIGGER_SECRET пуст. Добавь в .env и перезапусти expo с -c.'); return; }
  log('ok', `Секрет вызова задан (длина ${s.length}).`);

  try {
    const { status, data } = await callFunction({ ping: true });
    if (status === 200 && data?.pong) {
      log('ok', 'Функция задеплоена и секрет верный (ping ok).');
      log(data.vapid_configured ? 'ok' : 'error', `VAPID в секретах: ${data.vapid_configured ? 'задан' : 'НЕ задан'}`);
      if (data.vapid_public_prefix) {
        const match = data.vapid_public_prefix === VAPID_PUBLIC_KEY.slice(0, 16);
        log(match ? 'ok' : 'error', `VAPID public функции ${match ? 'совпадает' : 'НЕ совпадает'} с клиентом (${data.vapid_public_prefix}… vs ${VAPID_PUBLIC_KEY.slice(0, 16)}…)`);
      }
    } else explainStatus(status, data, log);
  } catch (e) {
    log('error', `Сеть/CORS: ${e instanceof Error ? e.message : e}. Обычно значит функция не задеплоена или неверный URL.`);
  }
  log('info', '— Проверка завершена. Если всё ✔, жми «Тестовый пуш себе». —');
}

export async function sendTestPush(log: PushLogger): Promise<void> {
  log('info', '— Тестовый пуш себе —');
  const { data: { session } } = await client().auth.getSession();
  if (!session) { log('error', 'Нет сессии.'); return; }
  if (!secret()) { log('error', 'Секрет вызова пуст.'); return; }
  try {
    const { status, data, text } = await callFunction({ test_user_id: session.user.id });
    if (status !== 200) { explainStatus(status, data, log); log('error', `Ответ: ${text.slice(0, 300)}`); return; }
    if (data?.reason === 'no_subscriptions') { log('error', 'Функция не нашла подписок твоего аккаунта в БД. Нажми «Пересохранить в БД» и повтори.'); return; }
    log('info', `Подписок в БД: ${data?.subscriptions ?? 0}`);
    for (const r of data?.results ?? []) {
      if (r.ok) log('ok', `FCM принял пуш …${r.endpoint_tail} (statusCode ${r.statusCode}). Жди уведомление.`);
      else {
        log('error', `FCM отклонил …${r.endpoint_tail}: statusCode=${r.statusCode} ${r.error ?? ''} ${r.body ?? ''}`);
        if (r.statusCode === 403) log('error', '403 = VAPID-ключ функции не совпадает с ключом подписки. Исправь секреты и «Пересоздать подписку».');
        if (r.statusCode === 404 || r.statusCode === 410) log('warn', 'Подписка мертва — «Пересоздать подписку».');
      }
    }
    if ((data?.results ?? []).every((r: any) => r.ok)) log('ok', 'Цепочка до FCM работает. Если уведомления нет — проверь Windows «Фокусировка внимания» и разрешения сайта в Chrome.');
  } catch (e) {
    log('error', `Сеть/CORS: ${e instanceof Error ? e.message : e}`);
  }
}

export async function resaveSubscription(log: PushLogger): Promise<void> {
  log('info', '— Пересохранение подписки в БД —');
  const ok = await subscribePush();
  log(ok ? 'ok' : 'error', ok ? 'subscribePush/upsert выполнен.' : 'subscribePush вернул false (смотри консоль).');
  const { data: { session } } = await client().auth.getSession();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (session) await checkDb(log, session.user.id, sub?.endpoint ?? null);
}

export async function recreateSubscription(log: PushLogger): Promise<void> {
  log('info', '— Пересоздание подписки —');
  await unsubscribePush();
  log('info', 'Старая подписка удалена.');
  const ok = await subscribePush();
  log(ok ? 'ok' : 'error', ok ? 'Новая подписка создана и сохранена.' : 'Не удалось создать подписку.');
  const { data: { session } } = await client().auth.getSession();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (session) await checkDb(log, session.user.id, sub?.endpoint ?? null);
}