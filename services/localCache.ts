// Локальный кеш устройства: чаты, сообщения, профиль и офлайн-очередь отправки.
// Хранится в AsyncStorage (на вебе — localStorage браузера устройства).
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Chat, Member, Message } from '@/services/kodusService';

const memberKey = (u: string) => `kodus.cache.member.${u}`;
const chatsKey = (u: string) => `kodus.cache.chats.${u}`;
const messagesKey = (u: string, c: string) => `kodus.cache.messages.${u}.${c}`;
const outboxKey = (u: string) => `kodus.cache.outbox.${u}`;
const MESSAGES_LIMIT = 200; // храним последние 200 сообщений каждого чата

export interface OutboxItem { localId: string; chatId: string; body: string; createdAt: string }

async function read<T>(key: string): Promise<T | null> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
async function write(key: string, value: unknown): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* переполнение хранилища не роняет приложение */ }
}

export const localCache = {
  member: (u: string) => read<Member>(memberKey(u)),
  saveMember: (u: string, m: Member) => write(memberKey(u), m),

  chats: (u: string) => read<Chat[]>(chatsKey(u)),
  saveChats: (u: string, v: Chat[]) => write(chatsKey(u), v),

  messages: (u: string, c: string) => read<Message[]>(messagesKey(u, c)),
  saveMessages: (u: string, c: string, v: Message[]) => write(messagesKey(u, c), v.slice(0, MESSAGES_LIMIT)),

  outbox: async (u: string): Promise<OutboxItem[]> => (await read<OutboxItem[]>(outboxKey(u))) ?? [],
  enqueue: async (u: string, item: OutboxItem) => { const list = await localCache.outbox(u); await write(outboxKey(u), [...list, item]); },
  drop: async (u: string, localId: string) => { const list = await localCache.outbox(u); await write(outboxKey(u), list.filter(i => i.localId !== localId)); },
  // Убираем из очереди сообщения, которые сервер уже подтвердил (совпали по тексту).
  resolveByBodies: async (u: string, chatId: string, bodies: string[]) => {
    if (!bodies.length) return;
    const list = await localCache.outbox(u);
    const next = list.filter(i => !(i.chatId === chatId && bodies.includes(i.body)));
    if (next.length !== list.length) await write(outboxKey(u), next);
  },

  clearAll: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('kodus.cache.')));
    } catch { /* игнорируем */ }
  },
};
