import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useKodus } from '@/hooks/useKodus';
import { playPing, showNotify, unlockAudio } from '../services/notify';

export default function GlobalNotifier() {
  const { user, chats, readAt, preferences, settings } = useKodus();
  const lastSeenRef = useRef<Record<string, string>>({});
  const initializedRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || audioUnlockedRef.current) return;
    const handleFirstInteraction = () => {
      unlockAudio(); audioUnlockedRef.current = true;
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });
    window.addEventListener('keydown', handleFirstInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (!user || !chats.length) return;
    if (!initializedRef.current) {
      chats.forEach(chat => { if (chat.lastMessage) lastSeenRef.current[chat.id] = chat.lastMessage.created_at; });
      initializedRef.current = true; return;
    }
    if (!preferences.showUnread) return;
    chats.forEach(chat => {
      const msg = chat.lastMessage; if (!msg) return;
      if (msg.user_id === user.id) { lastSeenRef.current[chat.id] = msg.created_at; return; }
      const lastSeen = lastSeenRef.current[chat.id] ?? '';
      const readMarker = readAt[chat.id] ?? '';
      if (msg.created_at > lastSeen && msg.created_at > readMarker) {
        const sender = chat.members.find(m => m.id === msg.user_id);
        const title = chat.kind === 'group' ? (sender?.full_name?.split(' ')[0] ?? 'Участник') : (chat.members.find(m => m.id !== user.id)?.full_name ?? 'Новое сообщение');
        if (settings.sounds_enabled) playPing();
        if (Platform.OS === 'web') showNotify(title, msg.body);
        lastSeenRef.current[chat.id] = msg.created_at;
      }
    });
  }, [chats, user, readAt, preferences.showUnread, settings.sounds_enabled]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') chats.forEach(chat => { if (chat.lastMessage) lastSeenRef.current[chat.id] = chat.lastMessage.created_at; });
    });
    return () => sub.remove();
  }, [chats]);

  return null;
}