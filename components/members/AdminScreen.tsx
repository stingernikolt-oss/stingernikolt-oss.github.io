import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useDirectory } from '@/hooks/useDirectory';
import { useKodus } from '@/hooks/useKodus';
import * as api from '@/services/kodusService';
import { THEMES } from '@/constants/theme';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page, Header } from '@/components/layout/Page';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, LoadingState, Notice, ui } from '@/components/ui/Primitives';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';

type Segment = 'requests' | 'groups' | 'news' | 'interface';
type Draft = Omit<api.AppSettings, 'updated_at'>;
const SLOW_OPTIONS = [0, 5, 10, 30, 60];
const LEN_OPTIONS = [500, 1000, 2000, 4000];

export function AdminScreen() { return <AccessGate masterOnly><AdminContent /></AccessGate>; }

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.preference}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.body}>{label}</Text>
        {hint ? <Text style={ui.subtle}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: c.border, true: c.primary }} thumbColor={c.white} />
    </View>
  );
}

function AdminContent() {
  const f = useDirectory(true);
  const { user, chats, refreshChats, settings, refreshSettings } = useKodus();
  const { showAlert } = useAlert();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('requests');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const groups = useMemo(() => chats.filter(ch => ch.kind === 'group'), [chats]);
  const approved = useMemo(() => f.members.filter(m => m.status === 'approved'), [f.members]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useMemo(() => groups.find(g => g.id === detailId) ?? null, [groups, detailId]);
  const [renameDraft, setRenameDraft] = useState('');
  const [addIds, setAddIds] = useState<Set<string>>(new Set());
  const [groupBusy, setGroupBusy] = useState(false);

  useEffect(() => { if (detail) setRenameDraft(detail.title ?? ''); }, [detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleId = (set: Set<string>, id: string, apply: (v: Set<string>) => void) => { const n = new Set(set); n.has(id) ? n.delete(id) : n.add(id); apply(n); };
  const createGroup = async () => {
    if (newTitle.trim().length < 2) { setError('Название группы: минимум 2 символа.'); return; }
    setCreating(true); setError('');
    try { const id = await api.createGroup(newTitle, [...newIds]); setCreateOpen(false); setNewTitle(''); setNewIds(new Set()); await refreshChats(); setNotice('Группа создана.'); router.push({ pathname: '/chat/[id]', params: { id } }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать группу.'); }
    finally { setCreating(false); }
  };
  const renameGroup = async () => { if (!detail) return; setGroupBusy(true); setError(''); try { await api.renameGroup(detail.id, renameDraft); await refreshChats(); setNotice('Название обновлено.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось переименовать.'); } finally { setGroupBusy(false); } };
  const addMembers = async () => { if (!detail || !addIds.size) return; setGroupBusy(true); setError(''); try { await api.addGroupMembers(detail.id, [...addIds]); setAddIds(new Set()); await refreshChats(); setNotice('Участники добавлены.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось добавить.'); } finally { setGroupBusy(false); } };
  const removeMember = (m: api.Member) => {
    if (!detail) return;
    showAlert('Удалить из группы?', `${m.full_name} потеряет доступ к «${detail.title}».`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { void (async () => { setGroupBusy(true); setError(''); try { await api.removeGroupMember(detail.id, m.id); await refreshChats(); setNotice('Участник удалён.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить.'); } finally { setGroupBusy(false); } })(); } },
    ]);
  };
  const deleteGroup = (g: api.Chat) => {
    showAlert('Удалить группу?', `«${g.title}» и переписка будут удалены.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => { void (async () => { setError(''); try { await api.deleteGroup(g.id); if (detailId === g.id) setDetailId(null); await refreshChats(); setNotice('Группа удалена.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось удалить группу.'); } })(); } },
    ]);
  };
  const clearGroup = (g: api.Chat) => {
    showAlert('Очистить историю?', `Все сообщения «${g.title}» будут удалены у всех.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Очистить', style: 'destructive', onPress: () => { void (async () => { try { await api.clearChat(g.id); await refreshChats(); setNotice('История очищена.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось очистить.'); } })(); } },
    ]);
  };
  const candidates = useMemo(() => approved.filter(m => m.id !== user?.id && (!detail || !detail.members.some(dm => dm.id === m.id))), [approved, detail, user?.id]);

  // Новости
  const [news, setNews] = useState<api.News[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [newsPinned, setNewsPinned] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editNews, setEditNews] = useState<api.News | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editPinned, setEditPinned] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcBody, setBcBody] = useState('');
  const [bcBusy, setBcBusy] = useState(false);

  const loadNews = useCallback(async () => { setNewsLoading(true); try { setNews(await api.listNews()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить новости.'); } finally { setNewsLoading(false); } }, []);
  useEffect(() => { if (segment === 'news') void loadNews(); }, [segment, loadNews]);
  const publish = async () => {
    if (!newsTitle.trim() || !newsBody.trim()) { setError('Заполните заголовок и текст.'); return; }
    setPosting(true); setError('');
    try { await api.postNews(newsTitle, newsBody, newsPinned); setNewsTitle(''); setNewsBody(''); setNewsPinned(false); await loadNews(); setNotice('Новость опубликована и разослана пушем всем.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось опубликовать.'); }
    finally { setPosting(false); }
  };
  const openEdit = (n: api.News) => { setEditNews(n); setEditTitle(n.title); setEditBody(n.body); setEditPinned(n.pinned); };
  const saveEdit = async () => {
    if (!editNews) return; setSavingEdit(true); setError('');
    try { await api.updateNews(editNews.id, editTitle, editBody, editPinned); setEditNews(null); await loadNews(); setNotice('Новость обновлена.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось обновить.'); }
    finally { setSavingEdit(false); }
  };
  const removeNews = (n: api.News) => { showAlert('Удалить новость?', `«${n.title}» исчезнет у всех.`, [{ text: 'Отмена', style: 'cancel' }, { text: 'Удалить', style: 'destructive', onPress: () => { const prev = news; setNews(cur => cur.filter(x => x.id !== n.id)); void api.deleteNews(n.id).catch(e => { setNews(prev); setError(e instanceof Error ? e.message : 'Не удалось удалить.'); }); } }]); };
  const pinNews = (n: api.News) => { const prev = news; setNews(cur => cur.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at))); void api.toggleNewsPin(n.id).catch(e => { setNews(prev); setError(e instanceof Error ? e.message : 'Не удалось закрепить.'); }); };
  const broadcast = async () => {
    if (!bcTitle.trim() || !bcBody.trim()) { setError('Заполните заголовок и текст рассылки.'); return; }
    setBcBusy(true); setError('');
    try { await api.broadcastPush(bcTitle, bcBody); setBcTitle(''); setBcBody(''); setNotice('Пуш-рассылка отправлена всем.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось отправить рассылку.'); }
    finally { setBcBusy(false); }
  };

  // Интерфейс
  const [draft, setDraft] = useState<Draft>({ ...settings });
  const [savingSettings, setSavingSettings] = useState(false);
  useEffect(() => { setDraft({ ...settings }); }, [settings.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const setD = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => ({ ...d, [k]: v }));
  const saveSettings = async () => { setSavingSettings(true); setError(''); try { await api.updateSettings(draft); await refreshSettings(); setNotice('Настройки применены у всех.'); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось сохранить.'); } finally { setSavingSettings(false); } };
  const resetSettings = () => setDraft({ ...api.defaultSettings });

  const pending = f.members.filter(m => m.status === 'pending').length;

  const Segments = (
    <View style={styles.segments}>
      {([['requests','Заявки','person-add-outline'],['groups','Группы','people-outline'],['news','Новости','newspaper-outline'],['interface','Управление','settings-outline']] as const).map(([id,label,icon]) => (
        <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: segment === id }} onPress={() => { setSegment(id); setError(''); setNotice(''); }}
          style={({ pressed }) => [styles.segment, segment === id ? styles.segmentActive : null, pressed ? ui.pressed : null]}>
          <Ionicons name={icon} size={16} color={segment === id ? c.white : c.subtle} />
          <Text style={[styles.segmentText, segment === id ? { color: c.white } : null]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <Page keyboard>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: s.xl }} keyboardShouldPersistTaps="handled">
        <Header title="Панель мастера" subtitle="Полное управление приложением" action={<IconButton icon="refresh-outline" label="Обновить" onPress={() => { void f.refresh(); void refreshChats(); void refreshSettings(); if (segment === 'news') void loadNews(); }} />} />
        <View style={styles.hero}>
          <View style={ui.row}>
            <View style={styles.shield}><Ionicons name="shield-checkmark-outline" size={32} color={c.primary} /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={ui.sectionTitle}>Группа под вашим контролем</Text>
              <Text style={ui.subtle}>Доступ, чаты, новости, интерфейс и рассылки.</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={{ flex: 1, gap: s.sm }}><Text style={styles.count}>{pending}</Text><Text style={ui.subtle}>ожидают</Text></View>
            <View style={styles.statDivider} />
            <View style={{ flex: 1, gap: s.sm }}><Text style={styles.count}>{approved.length}</Text><Text style={ui.subtle}>в группе</Text></View>
            <View style={styles.statDivider} />
            <View style={{ flex: 1, gap: s.sm }}><Text style={styles.count}>{groups.length}</Text><Text style={ui.subtle}>групп</Text></View>
          </View>
        </View>
        {Segments}
        <Notice message={error} />
        <Notice message={notice} success />

        {segment === 'requests' && (
          <View style={{ gap: s.md }}>
            <View style={styles.filters}>
              {(['pending','approved','all'] as const).map(filter => (
                <Pressable key={filter} accessibilityState={{ selected: f.filter === filter }} onPress={() => f.setFilter(filter)} style={({ pressed }) => [styles.filter, f.filter === filter ? styles.filterSelected : null, pressed ? ui.pressed : null]}>
                  <Text style={[styles.filterText, f.filter === filter ? { color: c.text } : null]}>{filter === 'pending' ? 'Заявки' : filter === 'approved' ? 'Участники' : 'Все'}</Text>
                </Pressable>
              ))}
            </View>
            <Field label="Поиск по ФИО или логину" placeholder="Найти участника" icon="search-outline" value={f.query} onChangeText={f.setQuery} />
            <Text style={ui.eyebrow}>{f.filter === 'pending' ? 'ЗАЯВКИ' : f.filter === 'approved' ? 'УЧАСТНИКИ' : 'ВСЕ'} · {f.visible.length}</Text>
            {f.loading ? <LoadingState /> : f.visible.length === 0 ? <EmptyState icon="shield-checkmark-outline" title={f.filter === 'pending' ? 'Все заявки разобраны' : 'Ничего не найдено'} description="Измените поиск или фильтр." /> : f.visible.map(item => (
              <View key={item.id} style={styles.memberCard}>
                <View style={ui.row}>
                  <Avatar name={item.full_name} path={item.avatar_path} />
                  <View style={{ flex: 1, gap: 5 }}><Text style={ui.sectionTitle}>{item.full_name}</Text><Text style={ui.subtle}>@{item.login}</Text></View>
                </View>
                <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                  <Badge label={item.role === 'master' ? 'Мастер' : item.status === 'pending' ? 'Ожидает' : item.status === 'approved' ? 'Одобрен' : item.status === 'blocked' ? 'Заблокирован' : 'Отклонён'} tone={item.status === 'pending' ? 'warning' : item.status === 'approved' ? 'success' : 'danger'} />
                  <Text style={ui.subtle}>{new Date(item.created_at).toLocaleDateString('ru-RU')}</Text>
                </View>
                {item.role !== 'master' ? item.status !== 'approved' ? (
                  <View style={styles.actions}>
                    <Button label="Одобрить" icon="checkmark-outline" style={{ flex: 1 }} disabled={!!f.busy} busy={f.busy === item.id} onPress={() => void f.review(item.id, 'approved')} />
                    {item.status === 'pending' ? <Button label="Отклонить" tone="secondary" disabled={!!f.busy} onPress={() => showAlert('Отклонить заявку?', `${item.full_name} не получит доступ.`, [{ text: 'Отмена', style: 'cancel' }, { text: 'Отклонить', style: 'destructive', onPress: () => void f.review(item.id, 'rejected') }])} /> : null}
                  </View>
                ) : (
                  <Button label="Приостановить доступ" tone="danger" disabled={!!f.busy} busy={f.busy === item.id} onPress={() => showAlert('Заблокировать?', `${item.full_name} потеряет доступ к чатам.`, [{ text: 'Отмена', style: 'cancel' }, { text: 'Заблокировать', style: 'destructive', onPress: () => void f.review(item.id, 'blocked') }])} />
                ) : null}
              </View>
            ))}
          </View>
        )}

        {segment === 'groups' && (
          <View style={{ gap: s.md }}>
            <Button label="Создать группу" icon="add-circle-outline" onPress={() => { setCreateOpen(true); setError(''); }} />
            {groups.length === 0 ? <EmptyState icon="people-outline" title="Групп пока нет" description="Создайте первую группу." /> : groups.map(g => (
              <View key={g.id} style={styles.memberCard}>
                <View style={ui.row}>
                  <View style={styles.groupIcon}><Ionicons name="people" size={24} color={c.primary} /></View>
                  <View style={{ flex: 1, gap: 4 }}><Text style={ui.sectionTitle}>{g.title || 'Без названия'}</Text><Text style={ui.subtle}>{g.members.length} участников</Text></View>
                </View>
                <View style={styles.actions}>
                  <Button label="Чат" tone="secondary" icon="chatbubble-outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: g.id } })} />
                  <Button label="Участники" tone="secondary" icon="settings-outline" style={{ flex: 1 }} onPress={() => { setDetailId(g.id); setAddIds(new Set()); setError(''); }} />
                  <IconButton icon="trash-outline" label="Удалить группу" color={c.danger} onPress={() => deleteGroup(g)} />
                </View>
              </View>
            ))}
          </View>
        )}

        {segment === 'news' && (
          <View style={{ gap: s.md }}>
            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="megaphone-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Новая новость</Text></View>
              <Text style={ui.subtle}>При публикации все участники получат пуш с текстом новости.</Text>
              <Field label="Заголовок" placeholder="Собрание группы в пятницу" value={newsTitle} onChangeText={setNewsTitle} maxLength={120} editable={!posting} />
              <Field label="Текст новости" placeholder="Подробности…" value={newsBody} onChangeText={setNewsBody} multiline maxLength={4000} style={{ minHeight: 90 }} editable={!posting} />
              <Toggle label="Закрепить сверху" value={newsPinned} onChange={setNewsPinned} />
              <Button label="Опубликовать + пуш всем" icon="paper-plane-outline" busy={posting} onPress={() => void publish()} />
            </View>

            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="notifications-outline" size={22} color={c.warning} /><Text style={ui.sectionTitle}>Пуш-рассылка всем</Text></View>
              <Field label="Заголовок" placeholder="Важное объявление" value={bcTitle} onChangeText={setBcTitle} maxLength={80} editable={!bcBusy} />
              <Field label="Текст" placeholder="Текст push-уведомления…" value={bcBody} onChangeText={setBcBody} multiline maxLength={300} editable={!bcBusy} />
              <Button label="Отправить пуш всем" icon="send-outline" tone="secondary" busy={bcBusy} onPress={() => void broadcast()} />
            </View>

            <Text style={ui.eyebrow}>ОПУБЛИКОВАННЫЕ · {news.length}</Text>
            {newsLoading ? <LoadingState /> : news.length === 0 ? <EmptyState icon="newspaper-outline" title="Новостей нет" description="Опубликованные новости появятся на главном экране." /> : news.map(n => (
              <View key={n.id} style={styles.memberCard}>
                <View style={ui.row}>{n.pinned ? <Ionicons name="pin" size={16} color={c.warning} /> : null}<Text style={[ui.sectionTitle, { flex: 1 }]} numberOfLines={2}>{n.title}</Text></View>
                <Text style={ui.subtle} numberOfLines={3}>{n.body}</Text>
                <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                  <Text style={ui.subtle}>{new Date(n.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                  <View style={{ flexDirection: 'row', gap: s.xs }}>
                    <IconButton icon="create-outline" label="Редактировать" color={c.primary} onPress={() => openEdit(n)} />
                    <IconButton icon={n.pinned ? 'pin-outline' : 'pin'} label={n.pinned ? 'Открепить' : 'Закрепить'} color={c.warning} onPress={() => pinNews(n)} />
                    <IconButton icon="trash-outline" label="Удалить" color={c.danger} onPress={() => removeNews(n)} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {segment === 'interface' && (
          <View style={{ gap: s.md }}>
            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="pricetag-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Брендинг</Text></View>
              <Field label="Название приложения" value={draft.app_name} onChangeText={v => setD('app_name', v)} maxLength={40} />
              <Field label="Подзаголовок на главном" value={draft.app_tagline} onChangeText={v => setD('app_tagline', v)} maxLength={80} />
            </View>

            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="color-palette-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Тема для всех</Text></View>
              <View style={styles.themeRow}>
                <Pressable onPress={() => setD('force_theme', null)} style={({ pressed }) => [styles.themeChip, draft.force_theme === null ? styles.themeChipActive : null, pressed ? ui.pressed : null]}><Text style={[styles.themeChipText, draft.force_theme === null ? { color: c.white } : null]}>Нет</Text></Pressable>
                {THEMES.map(t => (
                  <Pressable key={t.id} onPress={() => setD('force_theme', t.id)} style={({ pressed }) => [styles.themeChip, draft.force_theme === t.id ? styles.themeChipActive : null, pressed ? ui.pressed : null]}>
                    <View style={[styles.themeDot, { backgroundColor: t.preview[2] }]} /><Text style={[styles.themeChipText, draft.force_theme === t.id ? { color: c.white } : null]}>{t.name}</Text>
                  </Pressable>
                ))}
              </View>
              <Toggle label="Анимации тем" hint="Глобально разрешить снег, кровь, мышей и т.д." value={draft.animations_enabled} onChange={v => setD('animations_enabled', v)} />
            </View>

            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="megaphone-outline" size={22} color={c.warning} /><Text style={ui.sectionTitle}>Объявление на главном</Text></View>
              <Field label="Текст объявления" value={draft.banner_text} onChangeText={v => setD('banner_text', v)} multiline maxLength={300} />
              <Toggle label="Показывать объявление" value={draft.banner_enabled} onChange={v => setD('banner_enabled', v)} />
            </View>

            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="lock-closed-outline" size={22} color={c.danger} /><Text style={ui.sectionTitle}>Доступ и режимы</Text></View>
              <Toggle label="Регистрация открыта" hint="Новые заявки на вступление" value={draft.registration_open} onChange={v => setD('registration_open', v)} />
              <Toggle label="Чаты активны" hint="Выключите — режим «только чтение» для всех, кроме мастера" value={draft.chat_enabled} onChange={v => setD('chat_enabled', v)} />
              <Toggle label="Режим техработ" hint="Все, кроме мастера, видят экран техработ" value={draft.maintenance_mode} onChange={v => setD('maintenance_mode', v)} />
              <Field label="Текст техработ" value={draft.maintenance_text} onChangeText={v => setD('maintenance_text', v)} maxLength={200} />
            </View>

            <View style={[ui.card, ui.stack]}>
              <View style={ui.row}><Ionicons name="chatbubbles-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Правила чатов</Text></View>
              <Toggle label="Ответы свайпом" value={draft.replies_enabled} onChange={v => setD('replies_enabled', v)} />
              <Toggle label="Реакции" value={draft.reactions_enabled} onChange={v => setD('reactions_enabled', v)} />
              <Toggle label="Удаление своих сообщений" value={draft.deletion_enabled} onChange={v => setD('deletion_enabled', v)} />
              <Toggle label="Статусы онлайн" value={draft.presence_enabled} onChange={v => setD('presence_enabled', v)} />
              <Toggle label="Звук уведомлений" value={draft.sounds_enabled} onChange={v => setD('sounds_enabled', v)} />
              <Toggle label="Новости на главном" value={draft.news_enabled} onChange={v => setD('news_enabled', v)} />
              <Text style={ui.body}>Медленный режим</Text>
              <View style={styles.themeRow}>
                {SLOW_OPTIONS.map(sec => (
                  <Pressable key={sec} onPress={() => setD('slow_mode_seconds', sec)} style={({ pressed }) => [styles.themeChip, draft.slow_mode_seconds === sec ? styles.themeChipActive : null, pressed ? ui.pressed : null]}><Text style={[styles.themeChipText, draft.slow_mode_seconds === sec ? { color: c.white } : null]}>{sec === 0 ? 'Выкл' : `${sec} с`}</Text></Pressable>
                ))}
              </View>
              <Text style={ui.body}>Лимит длины сообщения</Text>
              <View style={styles.themeRow}>
                {LEN_OPTIONS.map(len => (
                  <Pressable key={len} onPress={() => setD('max_message_length', len)} style={({ pressed }) => [styles.themeChip, draft.max_message_length === len ? styles.themeChipActive : null, pressed ? ui.pressed : null]}><Text style={[styles.themeChipText, draft.max_message_length === len ? { color: c.white } : null]}>{len}</Text></Pressable>
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: s.sm }}>
              <Button label="Применить у всех" icon="checkmark-done-outline" style={{ flex: 1 }} busy={savingSettings} onPress={() => void saveSettings()} />
              <Button label="Сбросить" tone="secondary" disabled={savingSettings} onPress={resetSettings} />
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.sectionTitle}>Новая группа</Text><IconButton icon="close-outline" label="Закрыть" onPress={() => setCreateOpen(false)} /></View>
            <Field label="Название группы" value={newTitle} onChangeText={setNewTitle} maxLength={80} editable={!creating} />
            <Text style={ui.eyebrow}>УЧАСТНИКИ · {newIds.size}</Text>
            <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled>
              {approved.filter(m => m.id !== user?.id).map(m => (
                <Pressable key={m.id} onPress={() => toggleId(newIds, m.id, setNewIds)} style={({ pressed }) => [styles.pickRow, pressed ? ui.pressed : null]}>
                  <Avatar name={m.full_name} path={m.avatar_path} size={36} />
                  <View style={{ flex: 1 }}><Text style={ui.body} numberOfLines={1}>{m.full_name}</Text><Text style={ui.subtle}>@{m.login}</Text></View>
                  <Ionicons name={newIds.has(m.id) ? 'checkbox' : 'square-outline'} size={22} color={newIds.has(m.id) ? c.primary : c.muted} />
                </Pressable>
              ))}
            </ScrollView>
            <Notice message={error} />
            <Button label={`Создать${newIds.size ? ` · ${newIds.size + 1} чел.` : ''}`} icon="add-circle-outline" busy={creating} onPress={() => void createGroup()} />
          </View>
        </View>
      </Modal>

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetailId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '88%' }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.sectionTitle} numberOfLines={1}>{detail?.title ?? 'Группа'}</Text><IconButton icon="close-outline" label="Закрыть" onPress={() => setDetailId(null)} /></View>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <View style={{ gap: s.md }}>
                <Field label="Название" value={renameDraft} onChangeText={setRenameDraft} maxLength={80} editable={!groupBusy} />
                <Button label="Сохранить название" tone="secondary" icon="save-outline" disabled={groupBusy || renameDraft.trim() === (detail?.title ?? '')} onPress={() => void renameGroup()} />
                <Text style={ui.eyebrow}>УЧАСТНИКИ · {detail?.members.length ?? 0}</Text>
                {(detail?.members ?? []).map(m => (
                  <View key={m.id} style={styles.pickRow}>
                    <Avatar name={m.full_name} path={m.avatar_path} size={36} />
                    <View style={{ flex: 1 }}><Text style={ui.body} numberOfLines={1}>{m.full_name}</Text><Text style={ui.subtle}>@{m.login}{m.role === 'master' ? ' · мастер' : ''}</Text></View>
                    {m.id !== user?.id ? <IconButton icon="person-remove-outline" label="Удалить" color={c.danger} onPress={() => removeMember(m)} /> : <Badge label="Вы" />}
                  </View>
                ))}
                <Text style={ui.eyebrow}>ДОБАВИТЬ · {addIds.size}</Text>
                {candidates.length === 0 ? <Text style={ui.subtle}>Все одобренные уже в группе.</Text> : candidates.map(m => (
                  <Pressable key={m.id} onPress={() => toggleId(addIds, m.id, setAddIds)} style={({ pressed }) => [styles.pickRow, pressed ? ui.pressed : null]}>
                    <Avatar name={m.full_name} path={m.avatar_path} size={36} />
                    <View style={{ flex: 1 }}><Text style={ui.body} numberOfLines={1}>{m.full_name}</Text><Text style={ui.subtle}>@{m.login}</Text></View>
                    <Ionicons name={addIds.has(m.id) ? 'checkbox' : 'square-outline'} size={22} color={addIds.has(m.id) ? c.primary : c.muted} />
                  </Pressable>
                ))}
                <Button label={`Добавить (${addIds.size})`} icon="person-add-outline" disabled={groupBusy || !addIds.size} onPress={() => void addMembers()} />
                <Notice message={error} />
                {detail ? <Button label="Очистить историю чата" tone="secondary" icon="eraser-outline" onPress={() => clearGroup(detail)} /> : null}
                {detail ? <Button label="Удалить группу" tone="danger" icon="trash-outline" disabled={groupBusy} onPress={() => deleteGroup(detail)} /> : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!editNews} transparent animationType="fade" onRequestClose={() => setEditNews(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { maxHeight: '85%' }]}>
            <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.sectionTitle}>Редактировать новость</Text><IconButton icon="close-outline" label="Закрыть" onPress={() => setEditNews(null)} /></View>
            <Field label="Заголовок" value={editTitle} onChangeText={setEditTitle} maxLength={120} editable={!savingEdit} />
            <Field label="Текст" value={editBody} onChangeText={setEditBody} multiline maxLength={4000} style={{ minHeight: 100 }} editable={!savingEdit} />
            <Toggle label="Закрепить" value={editPinned} onChange={setEditPinned} />
            <Button label="Сохранить" icon="save-outline" busy={savingEdit} onPress={() => void saveEdit()} />
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: r.lg, padding: s.lg, gap: s.lg },
  shield: { height: 60, width: 60, borderRadius: r.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: s.lg, borderTopWidth: 1, borderTopColor: c.border, paddingTop: s.lg },
  count: { fontSize: 34, fontWeight: '700', color: c.text },
  statDivider: { width: 1, backgroundColor: c.border },
  segments: { flexDirection: 'row', gap: s.sm, marginVertical: s.md, flexWrap: 'wrap' },
  segment: { flexGrow: 1, height: 42, borderRadius: r.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: s.sm },
  segmentActive: { backgroundColor: c.primary, borderColor: c.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: c.subtle },
  filters: { flexDirection: 'row', gap: s.sm },
  filter: { height: 40, paddingHorizontal: s.md, borderRadius: r.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' },
  filterSelected: { backgroundColor: c.primarySoft, borderColor: c.primary },
  filterText: { fontSize: 14, fontWeight: '600', color: c.subtle },
  memberCard: { backgroundColor: c.surface, borderRadius: r.md, borderWidth: 1, borderColor: c.border, padding: s.md, gap: s.md },
  actions: { flexDirection: 'row', gap: s.sm, alignItems: 'center' },
  groupIcon: { height: 48, width: 48, borderRadius: r.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: s.md },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: s.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  modalBackdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: 'center', alignItems: 'center', padding: s.lg },
  modal: { backgroundColor: c.surface, width: '100%', maxWidth: 520, padding: s.lg, borderRadius: r.lg, gap: s.md },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: s.sm },
  themeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: r.pill, backgroundColor: c.raised, borderWidth: 1, borderColor: c.border },
  themeChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  themeChipText: { fontSize: 13, fontWeight: '600', color: c.subtle },
  themeDot: { height: 10, width: 10, borderRadius: 5 },
});