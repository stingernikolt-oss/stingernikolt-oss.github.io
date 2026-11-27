import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';
import type { User } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://slxuizwvssbltffoulzp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZKeuBix0nqz8vzomILUkEQ_4vpftHMx';

let instance: SupabaseClient | null = null;
export const client = (): SupabaseClient => {
  if (!instance) instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true } });
  return instance;
};

export type MemberStatus = 'pending' | 'approved' | 'rejected' | 'blocked';
export interface Member { id: string; full_name: string; login: string; avatar_path: string | null; role: 'master' | 'student'; status: MemberStatus; created_at: string }
export interface Chat { id: string; kind: 'group' | 'direct'; title: string | null; created_at: string; members: Member[]; lastMessage: Message | null }
export interface ReplyPreview { id: string; body: string; user_id: string; deleted_at: string | null }
export interface Message { id: string; chat_id: string; user_id: string; body: string; created_at: string; reply_to_id: string | null; deleted_at: string | null; deleted_by: string | null; reply?: ReplyPreview | null }
export interface AvatarAsset { uri: string; base64?: string | null; mimeType?: string | null; fileSize?: number }
export interface News { id: string; title: string; body: string; pinned: boolean; created_at: string; author_id: string | null; author?: { full_name: string } | null }
export interface Reaction { id: number; message_id: string | null; news_id: string | null; user_id: string; emoji: string; created_at: string }
export interface ReactionGroup { emoji: string; count: number; mine: boolean }
export interface PresenceRow { user_id: string; last_seen: string }

export interface AppSettings {
  force_theme: string | null; banner_text: string; banner_enabled: boolean;
  reactions_enabled: boolean; replies_enabled: boolean; deletion_enabled: boolean; slow_mode_seconds: number;
  app_name: string; app_tagline: string;
  maintenance_mode: boolean; maintenance_text: string;
  registration_open: boolean; news_enabled: boolean; chat_enabled: boolean;
  presence_enabled: boolean; animations_enabled: boolean; sounds_enabled: boolean;
  max_message_length: number; updated_at: string;
}
export const defaultSettings: AppSettings = {
  force_theme: null, banner_text: '', banner_enabled: false,
  reactions_enabled: true, replies_enabled: true, deletion_enabled: true, slow_mode_seconds: 0,
  app_name: 'KODUS', app_tagline: 'На связи со своей группой',
  maintenance_mode: false, maintenance_text: 'Технические работы. Скоро вернёмся.',
  registration_open: true, news_enabled: true, chat_enabled: true,
  presence_enabled: true, animations_enabled: true, sounds_enabled: true,
  max_message_length: 4000, updated_at: new Date(0).toISOString(),
};

export const REACTION_EMOJIS = ['👍','❤️','🔥','😂','😮','😢','','🎉'];
export const ONLINE_THRESHOLD_MS = 45000;

export function isOnlineLastSeen(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return Date.now() - Date.parse(iso) < ONLINE_THRESHOLD_MS;
}
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'был(а) давно';
  const diff = Date.now() - Date.parse(iso);
  if (diff < ONLINE_THRESHOLD_MS) return 'в сети';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'был(а) только что';
  if (min < 60) return `был(а) ${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `был(а) ${h} ч назад`;
  const d = new Date(iso);
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'был(а) вчера';
  return `был(а) ${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
export function groupReactions(rows: Reaction[], myId: string, key: 'message_id' | 'news_id', id: string): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  rows.filter(r => r[key] === id).forEach(r => {
    const g = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false };
    g.count += 1; if (r.user_id === myId) g.mine = true;
    map.set(r.emoji, g);
  });
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === '23505') throw new Error('Этот логин уже занят. Выберите другой.');
  if (error.message.includes('Invalid login credentials')) throw new Error('Неверный email или пароль.');
  if (error.message.includes('Email not confirmed')) throw new Error('Подтвердите email кодом из письма.');
  if (error.message.includes('User already registered')) throw new Error('Этот email уже зарегистрирован.');
  throw new Error(error.message);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); check(error); return data;
}
export async function register(email: string, password: string, name: string, login: string) {
  const { data, error } = await client().auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { full_name: name.trim(), kodus_login: login.trim().toLowerCase() } } });
  check(error); if (!data.user?.identities?.length && !data.session) throw new Error('Этот email уже зарегистрирован. Войдите в аккаунт.'); return data;
}
export async function verifyRegistration(email: string, token: string) {
  const { error } = await client().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'signup' }); check(error);
}
export async function resendCode(email: string) { const { error } = await client().auth.resend({ type: 'signup', email: email.trim().toLowerCase() }); check(error); }
export async function signOut() { const { error } = await client().auth.signOut(); check(error); }
export async function changePassword(password: string) { const { error } = await client().auth.updateUser({ password }); check(error); }

export async function getMember(user: User) {
  const { data, error } = await client().from('kodus_members').select('*').eq('id', user.id).maybeSingle(); check(error);
  return data as Member | null;
}
export async function enroll(name: string, login: string) {
  const { data, error } = await client().rpc('kodus_enroll', { p_full_name: name, p_login: login }); check(error); return data as Member;
}
export async function getMembers(status?: MemberStatus) {
  let query = client().from('kodus_members').select('*').order('full_name');
  if (status) query = query.eq('status', status);
  const { data, error } = await query; check(error); return (data ?? []) as Member[];
}

export async function listChats(userId: string): Promise<Chat[]> {
  const { data, error } = await client().from('kodus_chats').select('*').order('created_at', { ascending: false }); check(error);
  if (!data?.length) return [];
  const ids = data.map(c => c.id);
  const { data: links, error: linkError } = await client().from('kodus_chat_members').select('chat_id,user_id').in('chat_id', ids); check(linkError);
  const { data: members, error: memberError } = await client().from('kodus_members').select('*').in('id', [...new Set((links ?? []).map(l => l.user_id))]); check(memberError);
  const chats = await Promise.all(data.map(async c => {
    const { data: last, error: lastError } = await client().from('kodus_messages').select('*').eq('chat_id', c.id).order('created_at', { ascending: false }).limit(1); check(lastError);
    const participantIds = (links ?? []).filter(l => l.chat_id === c.id).map(l => l.user_id);
    return { ...c, members: (members ?? []).filter(m => participantIds.includes(m.id) && m.status === 'approved') as Member[], lastMessage: last?.[0] as Message ?? null } as Chat;
  }));
  return chats.sort((a, b) => Date.parse(b.lastMessage?.created_at ?? b.created_at) - Date.parse(a.lastMessage?.created_at ?? a.created_at));
}

export async function getMessages(chatId: string, before?: { createdAt: string; id: string }): Promise<Message[]> {
  let query = client().from('kodus_messages').select('*, reply:reply_to_id(id,body,user_id,deleted_at)').eq('chat_id', chatId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(60);
  if (before) query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
  const { data, error } = await query; check(error); return (data ?? []) as Message[];
}

export async function sendMessage(chatId: string, userId: string, body: string, replyTo?: string | null): Promise<Message> {
  const { data, error } = await client().rpc('kodus_send_message', { p_chat_id: chatId, p_body: body.trim(), p_reply_to: replyTo ?? null });
  check(error); return data as Message;
}
export async function deleteMessage(id: string) { const { error } = await client().rpc('kodus_delete_message', { p_id: id }); check(error); }
export async function clearChat(chatId: string) { const { error } = await client().rpc('kodus_clear_chat', { p_chat_id: chatId }); check(error); }

export async function fetchReactions(messageIds: string[], newsIds: string[]): Promise<Reaction[]> {
  const parts: string[] = [];
  if (messageIds.length) parts.push(`message_id.in.(${messageIds.join(',')})`);
  if (newsIds.length) parts.push(`news_id.in.(${newsIds.join(',')})`);
  if (!parts.length) return [];
  const { data, error } = await client().from('kodus_reactions').select('*').or(parts.join(','));
  check(error); return (data ?? []) as Reaction[];
}
export async function toggleReaction(messageId: string | null, newsId: string | null, emoji: string): Promise<boolean> {
  const { data, error } = await client().rpc('kodus_toggle_reaction', { p_message_id: messageId, p_news_id: newsId, p_emoji: emoji });
  check(error); return data as boolean;
}

export async function heartbeat() { const { error } = await client().rpc('kodus_heartbeat'); check(error); }
export async function fetchPresence(): Promise<PresenceRow[]> {
  const { data, error } = await client().from('kodus_presence').select('user_id,last_seen');
  check(error); return (data ?? []) as PresenceRow[];
}
export async function fetchSettings(): Promise<AppSettings> {
  const { data, error } = await client().from('kodus_app_settings').select('*').eq('id', 1).maybeSingle();
  check(error); return { ...defaultSettings, ...(data ?? {}) } as AppSettings;
}
export async function updateSettings(s: Omit<AppSettings, 'updated_at'>): Promise<AppSettings> {
  const { data, error } = await client().rpc('kodus_set_app_settings', {
    p_force_theme: s.force_theme, p_banner_text: s.banner_text, p_banner_enabled: s.banner_enabled,
    p_reactions_enabled: s.reactions_enabled, p_replies_enabled: s.replies_enabled, p_deletion_enabled: s.deletion_enabled,
    p_slow_mode_seconds: s.slow_mode_seconds,
    p_app_name: s.app_name, p_app_tagline: s.app_tagline,
    p_maintenance_mode: s.maintenance_mode, p_maintenance_text: s.maintenance_text,
    p_registration_open: s.registration_open, p_news_enabled: s.news_enabled, p_chat_enabled: s.chat_enabled,
    p_presence_enabled: s.presence_enabled, p_animations_enabled: s.animations_enabled, p_sounds_enabled: s.sounds_enabled,
    p_max_message_length: s.max_message_length,
  });
  check(error); return { ...defaultSettings, ...data } as AppSettings;
}
export async function broadcastPush(title: string, body: string) { const { error } = await client().rpc('kodus_broadcast_push', { p_title: title, p_body: body }); check(error); }

export async function openDirect(otherId: string) { const { data, error } = await client().rpc('kodus_open_direct', { p_other: otherId }); check(error); return data as string; }
export async function reviewMember(id: string, status: MemberStatus) { const { error } = await client().rpc('kodus_review_member', { p_id: id, p_status: status }); check(error); }

export async function createGroup(title: string, memberIds: string[]): Promise<string> {
  const { data, error } = await client().rpc('kodus_create_group', { p_title: title.trim(), p_member_ids: memberIds }); check(error); return data as string;
}
export async function renameGroup(chatId: string, title: string) { const { error } = await client().rpc('kodus_rename_group', { p_chat_id: chatId, p_title: title.trim() }); check(error); }
export async function deleteGroup(chatId: string) { const { error } = await client().rpc('kodus_delete_group', { p_chat_id: chatId }); check(error); }
export async function addGroupMembers(chatId: string, userIds: string[]) { const { error } = await client().rpc('kodus_group_add_members', { p_chat_id: chatId, p_user_ids: userIds }); check(error); }
export async function removeGroupMember(chatId: string, userId: string) { const { error } = await client().rpc('kodus_group_remove_member', { p_chat_id: chatId, p_user_id: userId }); check(error); }

export async function listNews(): Promise<News[]> {
  const { data, error } = await client().from('kodus_news').select('*, author:author_id(full_name)').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(50);
  check(error); return (data ?? []) as News[];
}
export async function postNews(title: string, body: string, pinned: boolean): Promise<News> {
  const { data, error } = await client().rpc('kodus_post_news', { p_title: title.trim(), p_body: body.trim(), p_pinned: pinned }); check(error); return data as News;
}
export async function updateNews(id: string, title: string, body: string, pinned: boolean): Promise<News> {
  const { data, error } = await client().rpc('kodus_update_news', { p_id: id, p_title: title.trim(), p_body: body.trim(), p_pinned: pinned }); check(error); return data as News;
}
export async function deleteNews(id: string) { const { error } = await client().rpc('kodus_delete_news', { p_id: id }); check(error); }
export async function toggleNewsPin(id: string): Promise<boolean> {
  const { data, error } = await client().rpc('kodus_toggle_news_pin', { p_id: id }); check(error); return data as boolean;
}

export function avatarUrl(path: string | null | undefined) { return path ? client().storage.from('kodus-avatars').getPublicUrl(path).data.publicUrl : undefined; }
export async function saveProfile(name: string, avatarPath: string | null) {
  const { error } = await client().rpc('kodus_update_profile', { p_full_name: name, p_avatar_path: avatarPath }); check(error);
}
export async function uploadAvatar(userId: string, asset: AvatarAsset) {
  if ((asset.fileSize ?? 0) > 5242880) throw new Error('Размер аватара не должен превышать 5 МБ.');
  const mime = asset.mimeType || 'image/jpeg';
  if (!['image/jpeg','image/png','image/webp'].includes(mime)) throw new Error('Выберите JPG, PNG или WebP.');
  const path = `${userId}/${Date.now()}.${mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg'}`;
  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') body = await (await fetch(asset.uri)).blob();
  else { if (!asset.base64) throw new Error('Не удалось прочитать изображение. Выберите его повторно.'); body = decode(asset.base64); }
  const { error } = await client().storage.from('kodus-avatars').upload(path, body, { contentType: mime, upsert: false }); check(error); return path;
}

export function chatTitle(chat: Chat, userId: string) { return chat.kind === 'group' ? chat.title || 'Учебная группа' : chat.members.find(m => m.id !== userId)?.full_name || 'Личный чат'; }
export function initials(name: string) { return name.split(' ').filter(Boolean).slice(0,2).map(n => n[0]).join('').toUpperCase() || 'К'; }
export function timeLabel(date: string) { return new Date(date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); }
export function conversationDate(date: string) { const d = new Date(date); return d.toDateString() === new Date().toDateString() ? timeLabel(date) : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }

export function subscribeToNewMessages(onMessage: (m: Message) => void) {
  const channel = client().channel('kodus-messages').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kodus_messages' }, (p: { new: Message }) => onMessage(p.new)).subscribe();
  return () => { client().removeChannel(channel); };
}