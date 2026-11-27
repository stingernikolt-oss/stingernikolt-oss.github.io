import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useKodus } from './useKodus';
import * as api from '@/services/kodusService';
import { localCache } from '@/services/localCache';

function merge(previous: api.Message[], next: api.Message[]) {
  const values = new Map(previous.map(m => [m.id, m]));
  next.forEach(m => values.set(m.id, m));
  return [...values.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export function useConversation(id: string) {
  const { user, member, chats, refreshChats, markRead, preferences, settings } = useKodus();
  const chat = useMemo(() => chats.find(c => c.id === id), [chats, id]);
  const [messages, setMessages] = useState<api.Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<api.Message | null>(null);
  const [reactions, setReactions] = useState<api.Reaction[]>([]);
  const [outbox, setOutbox] = useState<api.Message[]>([]);
  const active = useRef(false); const busy = useRef(false); const sendingRef = useRef(false); const flushRef = useRef(false);
  const removedRef = useRef<Set<string>>(new Set());

  const isMaster = member?.role === 'master';
  const maxLen = settings.max_message_length;
  const canSend = settings.chat_enabled || isMaster;

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try { const rows = await api.fetchReactions(ids, []); if (active.current) setReactions(rows); } catch { /* офлайн */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const uid = user?.id ?? '';
      const items = await localCache.outbox(uid);
      if (!cancelled) setOutbox(items.map(i => ({ id: i.localId, chat_id: i.chatId, user_id: uid, body: i.body, created_at: i.createdAt, reply_to_id: null, deleted_at: null, deleted_by: null })));
    };
    void sync(); return () => { cancelled = true; };
  }, [user?.id]);

  const refresh = useCallback(async () => {
    if (!id || member?.status !== 'approved' || busy.current) return;
    busy.current = true;
    try {
      const values = await api.getMessages(id);
      if (active.current) {
        setMessages(old => {
          const oldest = values[values.length - 1];
          const kept = old.filter(m => m.id.startsWith('pending-') || (oldest && (m.created_at < oldest.created_at || (m.created_at === oldest.created_at && m.id < oldest.id))));
          const clean = (arr: api.Message[]) => arr.filter(m => !removedRef.current.has(m.id));
          return merge(clean(kept), clean(values));
        });
        setError('');
        if (values[0]) markRead(id, values[0].created_at);
        void loadReactions(values.map(v => v.id));
      }
      if (user?.id) {
        void localCache.saveMessages(user.id, id, values.filter(v => !removedRef.current.has(v.id)));
        void localCache.resolveByBodies(user.id, id, values.filter(m => m.user_id === user.id).map(m => m.body));
      }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Соединение потеряно.'); }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }, [id, member?.status, markRead, user?.id, loadReactions]);

  const flushOutbox = useCallback(async () => {
    const uid = user?.id ?? ''; if (!uid || flushRef.current) return;
    flushRef.current = true;
    try {
      const items = await localCache.outbox(uid);
      for (const item of items) { try { await api.sendMessage(item.chatId, uid, item.body); await localCache.drop(uid, item.localId); } catch { break; } }
      void refresh();
    } finally {
      flushRef.current = false;
      const items = await localCache.outbox(uid);
      if (active.current) setOutbox(items.map(i => ({ id: i.localId, chat_id: i.chatId, user_id: uid, body: i.body, created_at: i.createdAt, reply_to_id: null, deleted_at: null, deleted_by: null })));
    }
  }, [user?.id, refresh]);

  useEffect(() => { const sub = AppState.addEventListener('change', s => { if (s === 'active') void flushOutbox(); }); return () => sub.remove(); }, [flushOutbox]);

  useFocusEffect(useCallback(() => {
    active.current = true; setLoading(true); setMessages([]); setHasMore(false); setReplyTo(null);
    void localCache.messages(user?.id ?? '', id).then(cached => {
      if (active.current && cached?.length) {
        const clean = cached.filter(m => !removedRef.current.has(m.id));
        setMessages(old => merge(old, clean)); setHasMore(h => h || clean.length >= 60); setLoading(false);
        void loadReactions(clean.map(c => c.id));
      }
    }).catch(() => {});
    void flushOutbox();
    let cancelled = false;
    void api.getMessages(id).then(values => {
      const clean = values.filter(v => !removedRef.current.has(v.id));
      if (!cancelled) { setMessages(clean); setHasMore(clean.length === 60); setError(''); if (clean[0]) markRead(id, clean[0].created_at); void loadReactions(clean.map(v => v.id)); }
      if (user?.id && !cancelled) { void localCache.saveMessages(user.id, id, clean); void localCache.resolveByBodies(user.id, id, clean.filter(m => m.user_id === user.id).map(m => m.body)); }
    }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    const timer = setInterval(() => { if (AppState.currentState === 'active' || AppState.currentState === null) void refresh(); }, 3000);
    return () => { cancelled = true; active.current = false; clearInterval(timer); void refreshChats(); };
  }, [id, refresh, markRead, refreshChats, flushOutbox, user?.id, loadReactions]));

  const send = useCallback(async () => {
    const body = draft.trim(); if (!body || sendingRef.current) return;
    if (!canSend) { setError('Чаты в режиме «только чтение».'); return; }
    if (body.length > maxLen) { setError(`Максимум ${maxLen} символов.`); return; }
    sendingRef.current = true; setSending(true); setError('');
    const localId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const replyPreview = replyTo ? { id: replyTo.id, body: replyTo.body, user_id: replyTo.user_id, deleted_at: null } : null;
    const optimistic: api.Message = { id: localId, chat_id: id, user_id: user?.id ?? '', body, created_at: new Date().toISOString(), reply_to_id: replyTo?.id ?? null, deleted_at: null, deleted_by: null, reply: replyPreview };
    setMessages(old => merge(old, [optimistic])); setDraft(''); setReplyTo(null);
    try {
      const saved = await api.sendMessage(id, user?.id ?? '', body, replyTo?.id ?? null);
      const withReply = { ...saved, reply: saved.reply ?? replyPreview };
      setMessages(old => { const v = new Map(old.map(m => [m.id, m])); v.delete(localId); v.set(withReply.id, withReply); return [...v.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)); });
      markRead(id, saved.created_at);
      if (user?.id) void localCache.drop(user.id, localId);
      void refreshChats();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось отправить.';
      if (msg.includes('Медленный режим') || msg.includes('только чтение') || msg.includes('символов')) { setError(msg); setDraft(body); setMessages(old => old.filter(m => m.id !== localId)); }
      else if (user?.id) { void localCache.enqueue(user.id, { localId, chatId: id, body, createdAt: optimistic.created_at }); setOutbox(old => [...old, optimistic]); }
      else setError(msg);
    } finally { sendingRef.current = false; if (active.current) setSending(false); }
  }, [draft, id, user?.id, markRead, refreshChats, replyTo, canSend, maxLen]);

  const removeMessage = useCallback(async (messageId: string) => {
    const prev = messages;
    removedRef.current.add(messageId);
    setMessages(old => old.filter(m => m.id !== messageId));
    setReactions(old => old.filter(r => r.message_id !== messageId));
    if (user?.id) {
      const cached = await localCache.messages(user.id, id);
      if (cached) void localCache.saveMessages(user.id, id, cached.filter(m => m.id !== messageId));
    }
    try { await api.deleteMessage(messageId); void refreshChats(); }
    catch (e) { removedRef.current.delete(messageId); setMessages(prev); setError(e instanceof Error ? e.message : 'Не удалось удалить сообщение.'); }
  }, [messages, user?.id, id, refreshChats]);

  const clearHistory = useCallback(async () => {
    setMessages([]); setReactions([]);
    if (user?.id) void localCache.saveMessages(user.id, id, []);
    try { await api.clearChat(id); void refreshChats(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось очистить историю.'); void refresh(); }
  }, [id, user?.id, refreshChats, refresh]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    const uid = user?.id ?? ''; if (!uid) return;
    const mine = reactions.some(r => r.message_id === messageId && r.user_id === uid && r.emoji === emoji);
    setReactions(old => mine ? old.filter(r => !(r.message_id === messageId && r.user_id === uid && r.emoji === emoji)) : [...old, { id: -Date.now(), message_id: messageId, news_id: null, user_id: uid, emoji, created_at: new Date().toISOString() }]);
    try { await api.toggleReaction(messageId, null, emoji); }
    catch (e) { setError(e instanceof Error ? e.message : 'Реакция недоступна.'); void loadReactions(messages.map(m => m.id)); }
  }, [user?.id, reactions, messages, loadReactions]);

  const loadMore = useCallback(async () => {
    const oldest = messages[messages.length - 1]; if (!oldest || loadingMore) return;
    setLoadingMore(true);
    try { const values = await api.getMessages(id, { createdAt: oldest.created_at, id: oldest.id }); const clean = values.filter(v => !removedRef.current.has(v.id)); if (active.current) { setMessages(old => merge(old, clean)); setHasMore(clean.length === 60); void loadReactions(clean.map(v => v.id)); } }
    catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Не удалось загрузить историю.'); }
    finally { if (active.current) setLoadingMore(false); }
  }, [id, messages, loadingMore, loadReactions]);

  const visible = useMemo(() => merge(messages, outbox.filter(o => o.chat_id === id)), [messages, outbox, id]);
  const groupsFor = useCallback((messageId: string) => api.groupReactions(reactions, user?.id ?? '', 'message_id', messageId), [reactions, user?.id]);
  return { chat, messages: visible, draft, setDraft, loading, sending, error, hasMore, loadingMore, send, refresh, loadMore, user, preferences, settings, replyTo, setReplyTo, removeMessage, clearHistory, react, groupsFor, canSend, maxLen, isMaster };
}