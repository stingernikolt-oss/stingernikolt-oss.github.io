import { memo, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversation } from '@/hooks/useConversation';
import { chatTitle, formatLastSeen, isOnlineLastSeen, timeLabel, type Member, type Message } from '@/services/kodusService';
import { useKodus } from '@/hooks/useKodus';
import { useAlert } from '@/template';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page } from '@/components/layout/Page';
import { Avatar, Badge, Button, EmptyState, IconButton, LoadingState, Notice, ui } from '@/components/ui/Primitives';
import { ReactionBar, ReactionPicker } from '@/components/ui/Reactions';
import type { ConnectionStatus } from '@/hooks/useConnectionStatus';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';

const SWIPE_TRIGGER = -52;

interface BubbleProps {
  message: Message; own: boolean; sender?: Member; group: boolean; showDate: boolean;
  canReply: boolean; canReact: boolean; canDelete: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
  onDelete: () => void; onReact: (e: string) => void; onOpenSheet: () => void; onSwipeReply: () => void; onJumpReply: (id: string) => void;
  highlight: boolean; senderName: (id: string) => string;
}
const MessageBubble = memo(function MessageBubble(p: BubbleProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => p.canReply && g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
    onPanResponderMove: (_e, g) => { if (g.dx < 0) translateX.setValue(Math.max(g.dx, -84)); },
    onPanResponderRelease: (_e, g) => {
      if (g.dx < SWIPE_TRIGGER) p.onSwipeReply();
      Animated.spring(translateX, { toValue: 0, friction: 6, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateX, { toValue: 0, friction: 6, useNativeDriver: true }).start();
    },
  }), [p.canReply, p.onSwipeReply, translateX]);

  const reply = p.message.reply;
  return (
    <View>
      <View style={[styles.messageRow, p.own ? { justifyContent: 'flex-end' } : null]}>
        {p.group && !p.own ? <View style={{ paddingBottom: 2 }}><Avatar name={p.sender?.full_name ?? 'Участник'} path={p.sender?.avatar_path} size={28} /></View> : null}
        <View style={styles.swipeWrap} {...pan.panHandlers}>
          {p.canReply ? (
            <View style={styles.swipeHint} pointerEvents="none">
              <Ionicons name="arrow-undo-outline" size={20} color={c.primary} />
            </View>
          ) : null}
          <Animated.View style={{ transform: [{ translateX }] }}>
            <Pressable onLongPress={p.onOpenSheet} delayLongPress={350}
              style={({ pressed }) => [styles.bubble, p.own ? styles.ownBubble : styles.theirBubble, p.highlight ? styles.highlight : null, pressed ? { opacity: 0.85 } : null]}>
              {p.group && !p.own ? <Text style={styles.sender}>{p.sender?.full_name ?? 'Участник'}</Text> : null}
              {reply ? (
                <Pressable onPress={() => p.onJumpReply(reply.id)} style={styles.replyBlock}>
                  <Text style={styles.replyName}>{p.senderName(reply.user_id)}</Text>
                  <Text numberOfLines={1} style={styles.replyBody}>{reply.body}</Text>
                </Pressable>
              ) : null}
              <Text selectable style={styles.messageBody}>{p.message.body}</Text>
              <View style={styles.messageMeta}>
                <Text style={[styles.messageTime, p.own ? styles.ownTime : null]}>{timeLabel(p.message.created_at)}</Text>
                {p.own ? <Ionicons name={p.message.id.startsWith('pending-') ? 'time-outline' : 'checkmark-outline'} size={14} color="rgba(255,255,255,0.65)" /> : null}
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
      {p.reactions.length > 0 || p.canReact ? (
        <View style={[styles.reactionsRow, p.own ? { justifyContent: 'flex-end' } : null]}>
          <ReactionBar groups={p.reactions} onToggle={p.onReact} enabled={p.canReact} compact />
        </View>
      ) : null}
      {p.showDate ? <View style={styles.date}><Text style={styles.dateText}>{new Date(p.message.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</Text></View> : null}
    </View>
  );
});

const CONNECTION_LABEL: Record<ConnectionStatus, string> = { online: 'В сети', connecting: 'Подключение…', offline: 'Нет соединения' };

export function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  return <AccessGate><ConversationContent id={typeof params.id === 'string' ? params.id : ''} /></AccessGate>;
}

function ConversationContent({ id }: { id: string }) {
  const f = useConversation(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { chatsLoading, refreshChats, connection, presence, settings } = useKodus();
  const [info, setInfo] = useState(false);
  const [sheet, setSheet] = useState<Message | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const title = f.chat ? chatTitle(f.chat, f.user?.id ?? '') : 'Чат';
  const other = f.chat?.members.find(m => m.id !== f.user?.id);
  const repliesEnabled = settings.replies_enabled;
  const reactionsEnabled = settings.reactions_enabled;
  const deletionEnabled = settings.deletion_enabled;
  const presenceOn = settings.presence_enabled;

  const senderName = (uid: string) => f.chat?.members.find(m => m.id === uid)?.full_name ?? (uid === f.user?.id ? 'Вы' : 'Участник');
  const otherPresence = other ? presence[other.id] : undefined;
  const onlineCount = f.chat?.members.filter(m => isOnlineLastSeen(presence[m.id])).length ?? 0;

  const jumpTo = (mid: string) => {
    const index = f.messages.findIndex(m => m.id === mid);
    if (index >= 0) { listRef.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true }); setHighlight(mid); setTimeout(() => setHighlight(null), 1200); }
  };
  const confirmDelete = (m: Message) => {
    const label = m.user_id === f.user?.id ? 'Удалить моё сообщение?' : 'Удалить сообщение мастера?';
    showAlert(label, 'Сообщение исчезнет из чата у всех участников.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void f.removeMessage(m.id) },
    ]);
    setSheet(null);
  };
  const confirmClear = () => {
    showAlert('Очистить историю чата?', 'Все сообщения этого чата будут удалены у всех участников.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Очистить', style: 'destructive', onPress: () => { void f.clearHistory(); setInfo(false); } },
    ]);
  };

  if (!f.chat && !chatsLoading) return (
    <Page bottom>
      <EmptyState icon="lock-closed-outline" title="Чат недоступен" description="Проверьте подключение и доступ к группе." action={{ label: 'Обновить чаты', onPress: () => void refreshChats() }} />
      <Button label="К списку чатов" tone="secondary" onPress={() => router.replace('/(tabs)')} />
    </Page>
  );

  const headerStatus = f.chat?.kind === 'group'
    ? `${CONNECTION_LABEL[connection]} · ${presenceOn ? `${onlineCount} в сети` : `${f.chat.members.length} участников`}`
    : other ? (presenceOn ? (isOnlineLastSeen(otherPresence) ? 'в сети' : formatLastSeen(otherPresence)) : CONNECTION_LABEL[connection]) : CONNECTION_LABEL[connection];

  return (
    <Page keyboard>
      <View style={styles.header}>
        <IconButton icon="arrow-back-outline" label="К списку чатов" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} />
        {/* Убрали status у аватара в шапке — салатовый кружок больше не рисуется */}
        <Avatar name={title} path={other?.avatar_path} group={f.chat?.kind === 'group'} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: connection === 'online' ? '#8BC34A' : connection === 'offline' ? c.danger : c.warning }]} />
            <Text style={styles.subtitle}>{headerStatus}</Text>
          </View>
        </View>
        <IconButton icon="information-circle-outline" label="Информация о чате" onPress={() => setInfo(true)} />
      </View>
      <View style={styles.context}>
        <Ionicons name="shield-checkmark-outline" color={c.primary} size={14} />
        <Text style={styles.contextText}>Свайп сообщения влево — ответ · долгое нажатие — удалить</Text>
      </View>
      <Notice message={f.error} onRetry={() => void f.refresh()} />
      {f.loading ? <View style={{ flex: 1 }}><LoadingState label="Загружаем переписку…" /></View> : (
        <FlatList
          ref={listRef} inverted data={f.messages} keyExtractor={item => item.id} onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item} own={item.user_id === f.user?.id}
              sender={f.chat?.members.find(m => m.id === item.user_id)} group={f.chat?.kind === 'group'}
              showDate={!f.messages[index + 1] || new Date(f.messages[index + 1].created_at).toDateString() !== new Date(item.created_at).toDateString()}
              canReply={repliesEnabled} canReact={reactionsEnabled}
              canDelete={(deletionEnabled && item.user_id === f.user?.id) || f.isMaster}
              reactions={f.groupsFor(item.id)}
              onDelete={() => confirmDelete(item)}
              onReact={e => void f.react(item.id, e)}
              onOpenSheet={() => setSheet(item)}
              onSwipeReply={() => f.setReplyTo(item)}
              onJumpReply={jumpTo}
              highlight={highlight === item.id}
              senderName={senderName}
            />
          )}
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingVertical: s.md, paddingHorizontal: s.sm }, f.messages.length === 0 ? { flexGrow: 1, justifyContent: 'center' } : null]}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }}><EmptyState icon={f.chat?.kind === 'group' ? 'people-outline' : 'chatbubble-outline'} title={f.chat?.kind === 'group' ? 'Группа на связи' : 'Начните разговор'} description="Напишите первое сообщение. Свайпните сообщение влево, чтобы ответить на него." /></View>}
          ListFooterComponent={f.hasMore ? <Button label="Более ранние сообщения" tone="secondary" busy={f.loadingMore} onPress={() => void f.loadMore()} /> : null}
        />
      )}
      <View style={[styles.composer, { paddingBottom: Math.max(s.sm, insets.bottom) }]}>
        {f.replyTo ? (
          <View style={styles.replyBanner}>
            <Ionicons name="arrow-undo-outline" size={16} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerName}>Ответ для {senderName(f.replyTo.user_id)}</Text>
              <Text numberOfLines={1} style={styles.replyBannerBody}>{f.replyTo.body}</Text>
            </View>
            <IconButton icon="close-outline" label="Отменить ответ" onPress={() => f.setReplyTo(null)} />
          </View>
        ) : null}
        <View style={styles.inputShell}>
          <TextInput
            accessibilityLabel="Текст сообщения" placeholder={f.canSend ? (f.replyTo ? 'Ваш ответ…' : 'Сообщение…') : 'Только чтение'} placeholderTextColor={c.muted} selectionColor={c.primary}
            value={f.draft} onChangeText={f.setDraft} multiline maxLength={f.maxLen} editable={!f.sending && f.canSend} style={styles.messageInput}
            onKeyPress={event => {
              const native = event.nativeEvent as typeof event.nativeEvent & { shiftKey?: boolean; isComposing?: boolean };
              if (Platform.OS === 'web' && f.preferences.enterToSend && native.key === 'Enter' && !native.shiftKey && !native.isComposing) { event.preventDefault(); void f.send(); }
            }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Отправить сообщение" accessibilityState={{ disabled: !f.draft.trim() || f.sending || !f.canSend }} disabled={!f.draft.trim() || f.sending || !f.canSend} onPress={() => void f.send()}
            style={({ pressed }) => [styles.send, (!f.draft.trim() || !f.canSend) ? { opacity: 0.4 } : null, pressed ? { opacity: 0.8 } : null]}>
            {f.sending ? <ActivityIndicator size="small" color={c.white} /> : <Ionicons name="arrow-up-outline" color={c.white} size={22} />}
          </Pressable>
        </View>
        <Text style={styles.composerHint}>{!f.canSend ? 'Мастер перевёл чаты в режим «только чтение»' : f.sending ? 'Отправка на сервер…' : settings.slow_mode_seconds > 0 && !f.isMaster ? `Медленный режим: ${settings.slow_mode_seconds} с` : f.draft.length > f.maxLen - 200 ? `${f.draft.length} / ${f.maxLen}` : 'Свайп влево — ответ · долгое нажатие — удалить'}</Text>
      </View>

      {/* Лист действий: реакции + удаление */}
      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            {sheet ? (
              <>
                <Text numberOfLines={2} style={styles.sheetPreview}>{sheet.body}</Text>
                <Text style={styles.sheetHint}>Свайпните сообщение влево, чтобы ответить</Text>
                {reactionsEnabled ? <ReactionPicker onPick={e => { void f.react(sheet.id, e); setSheet(null); }} /> : null}
                <View style={{ gap: s.sm, marginTop: s.sm }}>
                  {((deletionEnabled && sheet.user_id === f.user?.id) || f.isMaster) ? (
                    <Button
                      label={sheet.user_id === f.user?.id ? 'Удалить моё сообщение' : 'Удалить (мастер)'}
                      tone="danger" icon="trash-outline" onPress={() => confirmDelete(sheet)}
                    />
                  ) : null}
                  <Button label="Закрыть" tone="secondary" onPress={() => setSheet(null)} />
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Информация о чате — здесь статусы участников остаются */}
      <Modal visible={info} transparent animationType="fade" onRequestClose={() => setInfo(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '80%' }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.sectionTitle}>Информация о чате</Text>
              <IconButton icon="close-outline" label="Закрыть" onPress={() => setInfo(false)} />
            </View>
            <Avatar name={title} path={other?.avatar_path} group={f.chat?.kind === 'group'} size={72} />
            <Text style={ui.pageTitle}>{title}</Text>
            <Badge label={f.chat?.kind === 'group' ? 'Учебная группа' : 'Личный чат'} />
            <Text style={ui.subtle}>Участники · {f.chat?.members.length ?? 0}{presenceOn ? ` · ${onlineCount} в сети` : ''}</Text>
            <FlatList
              data={f.chat?.members ?? []} keyExtractor={m => m.id} style={{ flexGrow: 0, flexShrink: 1 }}
              renderItem={({ item }) => (
                <View style={[ui.row, { paddingVertical: 10 }]}>
                  {/* Здесь статусы участников остаются — реальный онлайн/оффлайн */}
                  <Avatar name={item.full_name} path={item.avatar_path} size={40} status={presenceOn ? (isOnlineLastSeen(presence[item.id]) ? 'online' : 'offline') : undefined} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.body}>{item.full_name}</Text>
                    <Text style={ui.subtle}>@{item.login}{item.role === 'master' ? ' · мастер' : ''}{presenceOn ? ` · ${isOnlineLastSeen(presence[item.id]) ? 'в сети' : formatLastSeen(presence[item.id])}` : ''}</Text>
                  </View>
                </View>
              )} />
            {f.isMaster ? <Button label="Очистить историю чата" tone="danger" icon="trash-outline" onPress={confirmClear} /> : null}
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: s.sm },
  title: { fontSize: 17, fontWeight: '600', color: c.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { height: 7, width: 7, borderRadius: 4 },
  subtitle: { fontSize: 12, color: c.subtle },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s.xs, paddingVertical: 10 },
  contextText: { fontSize: 11, color: c.muted },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: s.xs, paddingVertical: 2, marginVertical: 2 },
  swipeWrap: { position: 'relative', maxWidth: '78%', flexShrink: 1 },
  swipeHint: { position: 'absolute', right: -30, top: 0, bottom: 0, justifyContent: 'center' },
  bubble: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  ownBubble: { backgroundColor: c.bubble, borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: c.raised, borderBottomLeftRadius: 4 },
  highlight: { borderWidth: 2, borderColor: c.primary },
  sender: { fontSize: 12, fontWeight: '600', color: c.primary, marginBottom: 2 },
  replyBlock: { borderLeftWidth: 3, borderLeftColor: c.primary, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  replyName: { fontSize: 12, fontWeight: '700', color: c.primary },
  replyBody: { fontSize: 12, color: c.subtle },
  messageBody: { fontSize: 16, lineHeight: 22, color: c.text },
  messageMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, alignItems: 'center', marginTop: 2 },
  messageTime: { fontSize: 11, color: c.muted },
  ownTime: { color: 'rgba(255,255,255,0.65)' },
  reactionsRow: { flexDirection: 'row', paddingHorizontal: 40, marginTop: 2 },
  date: { alignItems: 'center', marginVertical: s.sm },
  dateText: { fontSize: 12, color: c.subtle, backgroundColor: c.surface, overflow: 'hidden', paddingHorizontal: 12, paddingVertical: 5, borderRadius: r.pill },
  composer: { paddingTop: s.sm, gap: s.xs },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: s.sm, backgroundColor: c.primarySoft, borderRadius: r.sm, paddingHorizontal: s.sm, paddingVertical: 4 },
  replyBannerName: { fontSize: 12, fontWeight: '700', color: c.primary },
  replyBannerBody: { fontSize: 12, color: c.subtle },
  inputShell: { backgroundColor: c.surface, borderRadius: r.lg, flexDirection: 'row', alignItems: 'flex-end', padding: s.xs, gap: s.xs },
  messageInput: { flex: 1, minHeight: 40, maxHeight: 140, paddingHorizontal: s.sm, paddingVertical: 10, fontSize: 16, color: c.text, lineHeight: 22 },
  send: { height: 44, width: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  composerHint: { fontSize: 10, color: c.muted, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', alignItems: 'center', padding: s.lg },
  modal: { backgroundColor: c.surface, width: '100%', maxWidth: 500, padding: s.lg, borderRadius: r.lg, gap: s.md },
  sheet: { backgroundColor: c.surface, width: '100%', maxWidth: 420, padding: s.lg, borderRadius: r.lg, gap: s.sm },
  sheetPreview: { fontSize: 14, color: c.subtle, fontStyle: 'italic' },
  sheetHint: { fontSize: 11, color: c.muted },
});