import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useKodus } from '@/hooks/useKodus';
import * as api from '@/services/kodusService';
import { chatTitle, conversationDate, isOnlineLastSeen, type Chat } from '@/services/kodusService';
import { readHiddenNews, writeHiddenNews } from '@/services/preferencesService';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page, Header } from '@/components/layout/Page';
import { Avatar, Badge, Button, EmptyState, IconButton, LoadingState, Notice, ui } from '@/components/ui/Primitives';
import { ReactionBar } from '@/components/ui/Reactions';
import type { ConnectionStatus } from '@/hooks/useConnectionStatus';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';

interface ChatRowProps { chat: Chat; userId: string; unread: boolean; otherOnline: boolean; onPress: () => void }

const ChatRow = memo(function ChatRow({ chat, userId, unread, otherOnline, onPress }: ChatRowProps) {
  const title = chatTitle(chat, userId);
  const other = chat.members.find(m => m.id !== userId);
  const last = chat.lastMessage && !chat.lastMessage.deleted_at ? chat.lastMessage : null;
  const prefix = last
    ? last.user_id === userId
      ? 'Вы: '
      : chat.kind === 'group'
        ? `${chat.members.find(m => m.id === last.user_id)?.full_name.split(' ')[0] ?? 'Участник'}: `
        : ''
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Открыть чат ${title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chatRow, pressed ? { backgroundColor: c.surface } : null]}
    >
      <Avatar
        name={title}
        path={chat.kind === 'direct' ? other?.avatar_path : undefined}
        group={chat.kind === 'group'}
        size={54}
        status={chat.kind === 'direct' ? (otherOnline ? 'online' : 'offline') : undefined}
      />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.chatHeading}>
          <Text numberOfLines={1} style={styles.chatName}>{title}</Text>
          {last ? <Text style={[styles.time, unread ? { color: c.primary } : null]}>{conversationDate(last.created_at)}</Text> : null}
        </View>
        <View style={styles.chatHeading}>
          <Text numberOfLines={1} style={[styles.preview, unread ? { color: c.text } : null]}>
            {last ? `${prefix}${last.body}` : 'Сообщений пока нет'}
          </Text>
          {unread ? <View style={styles.unread} /> : chat.kind === 'group' ? <Ionicons name="people-outline" size={16} color={c.muted} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

interface NewsFeedProps { userId: string; isMaster: boolean; refreshKey: number }

function NewsFeed({ userId, isMaster, refreshKey }: NewsFeedProps) {
  const { showAlert } = useAlert();
  const { settings } = useKodus();
  const [news, setNews] = useState<api.News[]>([]);
  const [reactions, setReactions] = useState<api.Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);

  const newsEnabled = settings.news_enabled;
  const reactionsEnabled = settings.reactions_enabled;

  const load = useCallback(async () => {
    try {
      const items = await api.listNews();
      setNews(items);
      setError('');
      const rows = await api.fetchReactions([], items.map(n => n.id));
      setReactions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить новости.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void readHiddenNews(userId).then(setHidden); }, [userId]);

  useEffect(() => {
    if (!newsEnabled) { setLoading(false); return; }
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => clearInterval(timer);
  }, [load, newsEnabled, refreshKey]);

  const visible = useMemo(() => news.filter(n => showHidden || !hidden.includes(n.id)), [news, hidden, showHidden]);
  const hiddenCount = useMemo(() => news.filter(n => hidden.includes(n.id)).length, [news, hidden]);

  const react = (newsId: string, emoji: string) => {
    const mine = reactions.some(x => x.news_id === newsId && x.user_id === userId && x.emoji === emoji);
    setReactions(old => mine
      ? old.filter(x => !(x.news_id === newsId && x.user_id === userId && x.emoji === emoji))
      : [...old, { id: -Date.now(), message_id: null, news_id: newsId, user_id: userId, emoji, created_at: new Date().toISOString() }]);
    void api.toggleReaction(null, newsId, emoji).catch(e => {
      setError(e instanceof Error ? e.message : 'Реакция недоступна.');
      void load();
    });
  };

  const hide = (id: string) => {
    const next = [...hidden, id];
    setHidden(next);
    setExpanded(null);
    void writeHiddenNews(userId, next);
  };

  const unhideOne = (id: string) => {
    const next = hidden.filter(h => h !== id);
    setHidden(next);
    void writeHiddenNews(userId, next);
  };

  const unhideAll = () => {
    setHidden([]);
    setShowHidden(false);
    void writeHiddenNews(userId, []);
  };

  const remove = (n: api.News) => {
    showAlert('Удалить новость?', `«${n.title}» исчезнет у всех участников.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          const prev = news;
          setNews(cur => cur.filter(x => x.id !== n.id));
          void api.deleteNews(n.id).catch(e => {
            setNews(prev);
            setError(e instanceof Error ? e.message : 'Не удалось удалить новость.');
          });
        },
      },
    ]);
  };

  const pin = (n: api.News) => {
    const prev = news;
    setNews(cur => cur
      .map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at)));
    void api.toggleNewsPin(n.id).catch(e => {
      setNews(prev);
      setError(e instanceof Error ? e.message : 'Не удалось закрепить новость.');
    });
  };

  if (!newsEnabled) return null;
  if (loading) return null;
  if (!visible.length && !error && !hiddenCount) return null;

  return (
    <View style={{ gap: s.sm }}>
      <Pressable onPress={() => setCollapsed(v => !v)} style={styles.newsHeader} accessibilityRole="button" accessibilityLabel="Новости группы">
        <Ionicons name="megaphone" size={18} color={c.primary} />
        <Text style={[ui.sectionTitle, { flex: 1, fontSize: 16 }]}>Новости группы</Text>
        <Badge label={String(visible.length)} />
        <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={c.subtle} />
      </Pressable>

      <Notice message={error} onRetry={() => void load()} />

      {!collapsed && visible.map(n => {
        const open = expanded === n.id;
        const isHidden = hidden.includes(n.id);
        return (
          <Pressable
            key={n.id}
            onPress={() => setExpanded(open ? null : n.id)}
            style={({ pressed }) => [styles.newsCard, pressed ? ui.pressed : null]}
            dataSet={{ kodusCard: '1' }}
          >
            <View style={ui.row}>
              {n.pinned ? <Ionicons name="pin" size={14} color={c.warning} /> : null}
              <Text style={[styles.newsTitle, isHidden ? { color: c.muted } : null]} numberOfLines={open ? undefined : 1}>{n.title}</Text>
              {isHidden ? <Badge label="Скрыта" /> : null}
            </View>
            <Text style={ui.subtle} numberOfLines={open ? undefined : 2}>{n.body}</Text>
            <Text style={styles.newsMeta}>
              {n.author?.full_name ?? 'Мастер'} · {new Date(n.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>

            <ReactionBar
              groups={api.groupReactions(reactions, userId, 'news_id', n.id)}
              onToggle={e => react(n.id, e)}
              enabled={reactionsEnabled}
              compact
            />

            {open ? (
              <View style={styles.newsActions}>
                {isHidden
                  ? <Button label="Показать снова" tone="secondary" icon="eye-outline" style={{ flex: 1 }} onPress={() => unhideOne(n.id)} />
                  : <Button label="Скрыть" tone="secondary" icon="eye-off-outline" style={{ flex: 1 }} onPress={() => hide(n.id)} />}
                {isMaster ? (
                  <>
                    <IconButton icon={n.pinned ? 'pin-outline' : 'pin'} label={n.pinned ? 'Открепить' : 'Закрепить'} color={c.warning} onPress={() => pin(n)} />
                    <IconButton icon="trash-outline" label="Удалить новость" color={c.danger} onPress={() => remove(n)} />
                  </>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        );
      })}

      {!collapsed && hiddenCount > 0 ? (
        <View style={styles.hiddenToggle}>
          <Pressable onPress={() => setShowHidden(v => !v)} accessibilityRole="button">
            <Text style={ui.subtle}>{showHidden ? 'Спрятать скрытые новости' : `Показать скрытые (${hiddenCount})`}</Text>
          </Pressable>
          {showHidden ? <Button label="Вернуть все" tone="secondary" onPress={unhideAll} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const CONNECTION_LABEL: Record<ConnectionStatus, string> = { online: 'В сети', connecting: 'Подключение…', offline: 'Нет соединения' };

export function ChatsScreen() { return <AccessGate><ChatsContent /></AccessGate>; }

function ChatsContent() {
  const { user, member, chats, chatsLoading, chatError, lastSynced, refreshChats, readAt, preferences, connection, presence, settings } = useKodus();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const presenceOn = settings.presence_enabled;

  const visible = useMemo(
    () => chats.filter(ch => (filter === 'all' || ch.kind === filter) && chatTitle(ch, user?.id ?? '').toLowerCase().includes(query.trim().toLowerCase())),
    [chats, filter, query, user?.id]
  );

  const refresh = async () => {
    setRefreshing(true);
    setRefreshKey(k => k + 1);
    await refreshChats();
    setRefreshing(false);
  };

  const open = (id: string) => router.push({ pathname: '/chat/[id]', params: { id } });

  return (
    <Page>
      <View style={styles.screen}>
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const other = item.members.find(m => m.id !== user?.id);
            const last = item.lastMessage && !item.lastMessage.deleted_at ? item.lastMessage : null;
            return (
              <ChatRow
                chat={item}
                userId={user?.id ?? ''}
                unread={preferences.showUnread && !!last && last.user_id !== user?.id && last.created_at > (readAt[item.id] ?? '')}
                otherOnline={presenceOn && isOnlineLastSeen(other ? presence[other.id] : undefined)}
                onPress={() => open(item.id)}
              />
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: s.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.primary} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Header
                title={settings.app_name}
                subtitle={settings.app_tagline}
                action={
                  <View style={{ flexDirection: 'row' }}>
                    <IconButton
                      icon="shield-checkmark-outline"
                      color={connection === 'online' ? c.success : connection === 'offline' ? c.danger : c.warning}
                      label="Статус подключения"
                      onPress={() => setStatusOpen(!statusOpen)}
                    />
                    <Pressable
                      accessibilityLabel="Мой профиль"
                      onPress={() => router.push('/profile')}
                      style={({ pressed }) => [styles.profileButton, pressed ? ui.pressed : null]}
                    >
                      <Avatar name={member?.full_name ?? ''} path={member?.avatar_path} size={36} status={connection} />
                    </Pressable>
                  </View>
                }
              />

              {settings.banner_enabled && settings.banner_text ? (
                <View style={styles.banner} dataSet={{ kodusCard: '1' }}>
                  <Ionicons name="megaphone-outline" size={20} color={c.warning} />
                  <Text style={styles.bannerText}>{settings.banner_text}</Text>
                </View>
              ) : null}

              {statusOpen ? (
                <View style={[ui.card, { gap: s.sm }]} dataSet={{ kodusCard: '1' }}>
                  <View style={ui.row}>
                    <View style={[styles.statusDot, { backgroundColor: connection === 'online' ? '#8BC34A' : connection === 'offline' ? c.danger : c.warning }]} />
                    <Text style={ui.sectionTitle}>{CONNECTION_LABEL[connection]}</Text>
                  </View>
                  <Text style={ui.subtle}>
                    {lastSynced ? `Последняя синхронизация: ${lastSynced.toLocaleTimeString('ru-RU')}` : 'Ожидаем ответ сервера'}
                  </Text>
                  <Button label="Синхронизировать" tone="secondary" onPress={() => void refresh()} />
                </View>
              ) : null}

              <Notice message={chatError} onRetry={() => void refresh()} />

              {user?.id ? <NewsFeed userId={user.id} isMaster={member?.role === 'master'} refreshKey={refreshKey} /> : null}

              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={20} color={c.muted} />
                <TextInput
                  accessibilityLabel="Поиск по чатам"
                  placeholder="Поиск"
                  placeholderTextColor={c.muted}
                  selectionColor={c.primary}
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.filters}>
                {(['all', 'direct', 'group'] as const).map(value => (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === value }}
                    onPress={() => setFilter(value)}
                    style={({ pressed }) => [styles.filter, filter === value ? styles.filterSelected : null, pressed ? ui.pressed : null]}
                  >
                    <Text style={[styles.filterText, filter === value ? { color: c.white } : null]}>
                      {value === 'all' ? 'Все чаты' : value === 'direct' ? 'Личные' : 'Группа'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={ui.eyebrow}>
                {filter === 'all' ? 'ВСЕ ЧАТЫ' : filter === 'direct' ? 'ЛИЧНЫЕ ПЕРЕПИСКИ' : 'ГРУППОВЫЕ ЧАТЫ'} · {visible.length}
              </Text>
            </View>
          }
          ListEmptyComponent={chatsLoading
            ? <LoadingState label="Загружаем ваши чаты…" />
            : <EmptyState
                icon="chatbubbles-outline"
                title={query ? 'Ничего не найдено' : 'Здесь начинается общение'}
                description={query ? 'Попробуйте другое имя или название чата.' : 'Выберите участника группы, чтобы начать личный разговор.'}
                action={query ? undefined : { label: 'Найти участника', onPress: () => router.push('/search') }}
              />}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Новый личный чат"
          onPress={() => router.push('/search')}
          style={({ pressed }) => [styles.fab, pressed ? { opacity: 0.85 } : null]}
        >
          <Ionicons name="pencil" size={24} color={c.white} />
        </Pressable>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, position: 'relative' },
  listHeader: { gap: s.md },
  profileButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  statusDot: { height: 10, width: 10, borderRadius: 5 },
  banner: { flexDirection: 'row', gap: s.sm, alignItems: 'center', backgroundColor: c.warningSoft, borderWidth: 1, borderColor: c.warning, borderRadius: r.md, padding: s.md },
  bannerText: { flex: 1, fontSize: 14, color: c.text, lineHeight: 20 },
  searchWrap: { minHeight: 44, borderRadius: r.pill, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: s.sm, paddingHorizontal: s.md },
  searchInput: { flex: 1, fontSize: 16, color: c.text, paddingVertical: 10 },
  filters: { flexDirection: 'row', gap: s.sm },
  filter: { height: 36, borderRadius: r.pill, backgroundColor: c.surface, justifyContent: 'center', paddingHorizontal: 14 },
  filterSelected: { backgroundColor: c.primary },
  filterText: { fontSize: 13, color: c.subtle, fontWeight: '600' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: s.md, paddingVertical: 8, paddingHorizontal: s.md, minHeight: 72 },
  chatHeading: { flexDirection: 'row', gap: s.sm, alignItems: 'center' },
  chatName: { fontSize: 16, fontWeight: '600', color: c.text, flex: 1 },
  time: { fontSize: 12, color: c.muted },
  preview: { fontSize: 14, color: c.subtle, flex: 1 },
  unread: { height: 10, width: 10, borderRadius: 5, backgroundColor: c.primary, marginRight: 2 },
  fab: { position: 'absolute', right: s.md, bottom: s.md, height: 56, width: 56, borderRadius: 28, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  newsHeader: { flexDirection: 'row', alignItems: 'center', gap: s.sm, paddingVertical: 4 },
  newsCard: { backgroundColor: c.surface, borderRadius: r.md, borderWidth: 1, borderColor: c.border, padding: s.md, gap: 6 },
  newsTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: c.text },
  newsMeta: { fontSize: 11, color: c.muted },
  newsActions: { flexDirection: 'row', alignItems: 'center', gap: s.sm, marginTop: 4 },
  hiddenToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s.sm },
});