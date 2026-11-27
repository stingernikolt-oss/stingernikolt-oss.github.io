import { createContext, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { User } from '@supabase/supabase-js';
import * as api from '@/services/kodusService';
import { localCache } from '@/services/localCache';
import { useConnectionStatus, type ConnectionStatus } from '@/hooks/useConnectionStatus';
import { defaultPreferences, readPreferences, writePreferences, readMarkers, writeMarkers, type Preferences } from '@/services/preferencesService';
import { applyTheme, themeMode } from '@/constants/theme';

interface KodusContextValue {
  user: User | null; member: api.Member | null; ready: boolean; profileLoading: boolean; profileError: string;
  chats: api.Chat[]; chatsLoading: boolean; chatError: string; lastSynced: Date | null;
  preferences: Preferences; readAt: Record<string, string>; connection: ConnectionStatus;
  settings: api.AppSettings; presence: Record<string, string>;
  refreshMember: () => Promise<void>; refreshChats: () => Promise<void>; refreshSettings: () => Promise<void>;
  completeProfile: (name: string, login: string) => Promise<void>;
  logout: () => Promise<void>; saveMember: (name: string, asset: api.AvatarAsset | null) => Promise<void>;
  setRegistrationAvatar: (asset: api.AvatarAsset | null) => void; setPreference: (key: keyof Preferences, value: boolean) => Promise<void>;
  markRead: (chatId: string, date: string) => void;
}
export const KodusContext = createContext<KodusContextValue | undefined>(undefined);

export function KodusProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [member, setMember] = useState<api.Member | null>(null);
  const [ready, setReady] = useState(false); const [profileLoading, setProfileLoading] = useState(false); const [profileError, setProfileError] = useState('');
  const [chats, setChats] = useState<api.Chat[]>([]); const [chatsLoading, setChatsLoading] = useState(true); const [chatError, setChatError] = useState('');
  const [lastSynced, setLastSynced] = useState<Date | null>(null); const [preferences, setPreferences] = useState(defaultPreferences); const [readAt, setReadAt] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<api.AppSettings>(api.defaultSettings);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const connection = useConnectionStatus();
  const avatarRef = useRef<api.AvatarAsset | null>(null); const userRef = useRef<User | null>(null); const alive = useRef(true); const profileBusy = useRef(false); const chatBusy = useRef(false); const markerRef = useRef<Record<string, string>>({});

  useEffect(() => {
    alive.current = true;
    const hydrate = async (userId: string) => {
      const [cachedMember, cachedChats] = await Promise.all([localCache.member(userId), localCache.chats(userId)]);
      if (!alive.current) return;
      if (cachedMember) setMember(cachedMember);
      if (cachedChats?.length) { setChats(cachedChats); setChatsLoading(false); }
    };
    const apply = (next: User | null) => { if (!alive.current) return; if (userRef.current?.id !== next?.id) { setMember(null); setChats([]); setProfileError(''); setLastSynced(null); } if (next) void hydrate(next.id); userRef.current = next; setUser(next); setReady(true); };
    void api.client().auth.getSession().then(({ data, error }) => { if (error) setProfileError(error.message); apply(data.session?.user ?? null); }).catch(e => { if (alive.current) { setProfileError(e.message); setReady(true); } });
    const { data: subscription } = api.client().auth.onAuthStateChange((_e, session) => apply(session?.user ?? null));
    void readPreferences().then(p => { if (alive.current) setPreferences(p); }).catch(() => {});
    return () => { alive.current = false; subscription.subscription.unsubscribe(); };
  }, []);

  const syncProfile = useCallback(async (initial = false) => {
    const current = userRef.current; if (!current || profileBusy.current) return;
    profileBusy.current = true; if (initial) setProfileLoading(true);
    try {
      let next = await api.getMember(current);
      if (!next && initial && current.user_metadata?.full_name && current.user_metadata?.kodus_login) next = await api.enroll(current.user_metadata.full_name, current.user_metadata.kodus_login);
      if (next && avatarRef.current) { const asset = avatarRef.current; avatarRef.current = null; const path = await api.uploadAvatar(current.id, asset); await api.saveProfile(next.full_name, path); next = { ...next, avatar_path: path }; }
      if (alive.current && userRef.current?.id === current.id) { if (next) void localCache.saveMember(current.id, next); setMember(next); setProfileError(''); }
    } catch (e) { if (alive.current) setProfileError(e instanceof Error ? e.message : 'Не удалось загрузить профиль.'); }
    finally { profileBusy.current = false; if (alive.current) setProfileLoading(false); }
  }, []);
  const refreshMember = useCallback(async () => { await syncProfile(false); }, [syncProfile]);

  useEffect(() => { if (user?.id) { void syncProfile(true); void readMarkers(user.id).then(m => { if (userRef.current?.id === user.id) { markerRef.current = m; setReadAt(m); } }).catch(() => {}); } else { setMember(null); setProfileLoading(false); setReadAt({}); markerRef.current = {}; } }, [user?.id, syncProfile]);

  const refreshChats = useCallback(async () => {
    const current = userRef.current; if (!current || member?.status !== 'approved' || chatBusy.current) return; chatBusy.current = true;
    try { const next = await api.listChats(current.id); if (alive.current && userRef.current?.id === current.id) { setChats(next); setChatError(''); setLastSynced(new Date()); void localCache.saveChats(current.id, next); } }
    catch (e) { if (alive.current) setChatError(e instanceof Error ? e.message : 'Нет соединения с сервером.'); }
    finally { chatBusy.current = false; if (alive.current) setChatsLoading(false); }
  }, [member?.status]);

  useEffect(() => { if (member?.status === 'approved') { setChatsLoading(true); void refreshChats(); } else setChats([]); }, [member?.status, refreshChats]);

  const refreshSettings = useCallback(async () => {
    try { const s = await api.fetchSettings(); if (alive.current) setSettings(s); } catch { /* держим прошлые */ }
  }, []);

  useEffect(() => {
    if (!user?.id || member?.status !== 'approved') return;
    const beat = () => { if (AppState.currentState === 'active' || AppState.currentState === null) void api.heartbeat().catch(() => {}); };
    const pullPresence = () => { void api.fetchPresence().then(rows => { if (alive.current) setPresence(Object.fromEntries(rows.map(r => [r.user_id, r.last_seen]))); }).catch(() => {}); };
    beat(); pullPresence(); void refreshSettings();
    const t1 = setInterval(beat, 20000);
    const t2 = setInterval(pullPresence, 20000);
    const t3 = setInterval(() => void refreshSettings(), 15000);
    const sub = AppState.addEventListener('change', st => { if (st === 'active') { beat(); pullPresence(); void refreshSettings(); void refreshChats(); } });
    return () => { clearInterval(t1); clearInterval(t2); clearInterval(t3); sub.remove(); };
  }, [user?.id, member?.status, refreshChats, refreshSettings]);

  useEffect(() => { const forced = settings.force_theme; if (forced && forced !== themeMode) applyTheme(forced as never); }, [settings.force_theme]);

  useEffect(() => {
    if (!user?.id) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active' || AppState.currentState === null) { void refreshMember(); if (member?.status === 'approved') void refreshChats(); } }, 5000);
    return () => clearInterval(timer);
  }, [user?.id, member?.status, refreshMember, refreshChats]);

  const completeProfile = useCallback(async (name: string, login: string) => { const next = await api.enroll(name, login); setMember(next); setProfileError(''); if (avatarRef.current) { const asset = avatarRef.current; avatarRef.current = null; const path = await api.uploadAvatar(next.id, asset); await api.saveProfile(next.full_name, path); setMember({ ...next, avatar_path: path }); } }, []);
  const logout = useCallback(async () => { await api.signOut(); avatarRef.current = null; void localCache.clearAll(); }, []);
  const saveMember = useCallback(async (name: string, asset: api.AvatarAsset | null) => { if (!member) throw new Error('Профиль недоступен.'); const path = asset ? await api.uploadAvatar(member.id, asset) : member.avatar_path; await api.saveProfile(name, path); setMember({ ...member, full_name: name.trim(), avatar_path: path }); }, [member]);
  const setRegistrationAvatar = useCallback((asset: api.AvatarAsset | null) => { avatarRef.current = asset; }, []);
  const setPreference = useCallback(async (key: keyof Preferences, value: boolean) => { const next = { ...preferences, [key]: value }; await writePreferences(next); setPreferences(next); }, [preferences]);
  const markRead = useCallback((chatId: string, date: string) => { const id = userRef.current?.id; if (!id || (markerRef.current[chatId] ?? '') >= date) return; const next = { ...markerRef.current, [chatId]: date }; markerRef.current = next; setReadAt(next); void writeMarkers(id, next).catch(() => {}); }, []);

  return <KodusContext.Provider value={{ user, member, ready, profileLoading, profileError, chats, chatsLoading, chatError, lastSynced, preferences, readAt, connection, settings, presence, refreshMember, refreshChats, refreshSettings, completeProfile, logout, saveMember, setRegistrationAvatar, setPreference, markRead }}>{children}</KodusContext.Provider>;
}