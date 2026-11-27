import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { useKodus } from '@/hooks/useKodus';
import { usePasswordForm } from '@/hooks/useProfileForm';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page, Header } from '@/components/layout/Page';
import { Badge, Button, Field, Notice, ui } from '@/components/ui/Primitives';
import { applyTheme, colors as c, radius as r, spacing as s, THEMES, themeMode, type ThemeMode } from '@/constants/theme';
import { getNotificationPermission } from '@/services/notify';
import { subscribePush, unsubscribePush } from '@/services/webPush';
import { runPushDiagnostics, sendTestPush, resaveSubscription, recreateSubscription, type PushLogEntry, type PushLogLevel } from '@/services/pushDiagnostics';

function ThemePicker() {
  const { preferences, setPreference } = useKodus();
  const [error, setError] = useState('');
  const pick = (id: ThemeMode) => { if (id !== themeMode) applyTheme(id); };
  return (
    <View style={{ gap: s.md }}>
      <View style={ui.row}>
        <Ionicons name="color-palette-outline" size={22} color={c.primary} />
        <Text style={ui.sectionTitle}>Тема оформления</Text>
      </View>
      <Text style={ui.subtle}>Выберите тему — приложение перезапустится с новой палитрой и эффектами.</Text>
      <View style={styles.themeGrid}>
        {THEMES.map(t => {
          const active = t.id === themeMode;
          return (
            <Pressable key={t.id} accessibilityRole="button" accessibilityLabel={`Тема ${t.name}`} accessibilityState={{ selected: active }}
              onPress={() => pick(t.id)} style={({ pressed }) => [styles.themeCard, active ? styles.themeActive : null, pressed ? ui.pressed : null]}>
              <View style={[styles.themePreview, { backgroundColor: t.preview[0] }]}>
                <View style={[styles.themeSurface, { backgroundColor: t.preview[1] }]}>
                  <View style={[styles.themeDot, { backgroundColor: t.preview[2] }]} />
                  <View style={[styles.themeLine, { backgroundColor: t.preview[3] }]} />
                </View>
                <View style={[styles.themeAccent, { backgroundColor: t.preview[2] }]} />
              </View>
              <View style={ui.row}>
                <Ionicons name={t.icon as never} size={16} color={active ? c.primary : c.subtle} />
                <Text style={[styles.themeName, active ? { color: c.primary } : null]}>{t.name}</Text>
                {active ? <Ionicons name="checkmark-circle" size={16} color={c.primary} /> : null}
              </View>
              <Text style={styles.themeTag} numberOfLines={1}>{t.tagline}</Text>
              {t.animated ? <Badge label={t.effect} /> : <Text style={styles.themeTag}>Без эффектов</Text>}
            </Pressable>
          );
        })}
      </View>
      <View style={ui.divider} />
      <View style={styles.preference}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={ui.body}>Анимации темы</Text>
          <Text style={ui.subtle}>Кровь, летучие мыши, снег, гирлянда, неон, угли и лепестки. Выключите для экономии батареи.</Text>
        </View>
        <Switch accessibilityLabel="Анимации темы" value={preferences.themeAnimations}
          onValueChange={v => { void setPreference('themeAnimations', v).catch(() => setError('Не удалось сохранить настройку.')); }}
          trackColor={{ false: c.border, true: c.primary }} thumbColor={c.white} />
      </View>
      <Notice message={error} />
    </View>
  );
}

function PushControl() {
  const { showAlert } = useAlert();
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (perm !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready.then(async reg => {
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
      setDebugInfo(sub ? `endpoint: ${sub.endpoint.slice(0, 60)}...` : 'подписка отсутствует');
    }).catch(e => setDebugInfo(`SW error: ${e}`));
  }, [perm]);

  const handleToggle = useCallback(async () => {
    if (perm === 'denied') {
      showAlert('Уведомления заблокированы', 'Нажмите на значок замка слева от адресной строки → «Уведомления» → «Разрешить» → перезагрузите страницу.', [{ text: 'Понятно' }]);
      return;
    }
    setBusy(true);
    try {
      if (subscribed) { await unsubscribePush(); setSubscribed(false); setDebugInfo('подписка удалена'); }
      else {
        const ok = await subscribePush();
        if (ok) { setSubscribed(true); setPerm('granted'); setDebugInfo('подписка создана и сохранена'); }
        else showAlert('Ошибка', 'Не удалось оформить подписку на push-уведомления.', [{ text: 'OK' }]);
      }
    } catch (e) { showAlert('Ошибка', e instanceof Error ? e.message : 'Неизвестная ошибка', [{ text: 'OK' }]); }
    finally { setBusy(false); }
  }, [perm, subscribed, showAlert]);

  const hint = perm === 'unsupported' ? 'Уведомления поддерживаются только в веб-версии.'
    : perm === 'denied' ? 'Браузер заблокировал уведомления.'
    : subscribed ? 'Push-уведомления активны.'
    : perm === 'granted' ? 'Разрешение есть, нажмите переключатель для подписки.'
    : 'Нажмите, чтобы разрешить уведомления.';

  return (
    <View style={styles.preference}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={ui.body}>Push-уведомления</Text>
        <Text style={ui.subtle}>{hint}</Text>
        {debugInfo ? <Text style={[ui.subtle, { fontSize: 11, opacity: 0.7 }]}>{debugInfo}</Text> : null}
      </View>
      <Switch accessibilityLabel="Push-уведомления" value={subscribed && perm === 'granted'} onValueChange={() => void handleToggle()}
        disabled={perm === 'unsupported' || perm === 'denied' || busy} trackColor={{ false: c.border, true: c.primary }} thumbColor={c.white} />
    </View>
  );
}

const LOG_COLOR: Record<PushLogLevel, string> = { info: c.subtle, ok: c.success, warn: c.warning, error: c.danger };

function PushDiagnostics() {
  const [logs, setLogs] = useState<PushLogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const idRef = useRef(0);
  const log = useCallback((level: PushLogLevel, text: string) => {
    setLogs(prev => [...prev.slice(-199), { id: ++idRef.current, time: new Date().toLocaleTimeString('ru-RU'), level, text }]);
  }, []);
  const run = useCallback(async (key: string, fn: (l: typeof log) => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try { await fn(log); } catch (e) { log('error', e instanceof Error ? e.message : String(e)); }
    finally { setBusy(null); }
  }, [busy, log]);

  return (
    <View style={{ gap: s.md }}>
      <Text style={ui.subtle}>Диагностика цепочки push. Тестировать два аккаунта лучше в разных браузерах.</Text>
      <View style={{ flexDirection: 'row', gap: s.sm, flexWrap: 'wrap' }}>
        <Button label="Проверить цепочку" tone="secondary" icon="search-outline" disabled={!!busy} busy={busy === 'check'} style={{ flex: 1, minWidth: 150 }} onPress={() => void run('check', runPushDiagnostics)} />
        <Button label="Тестовый пуш себе" icon="paper-plane-outline" disabled={!!busy} busy={busy === 'test'} style={{ flex: 1, minWidth: 150 }} onPress={() => void run('test', sendTestPush)} />
      </View>
      <View style={{ flexDirection: 'row', gap: s.sm, flexWrap: 'wrap' }}>
        <Button label="Пересохранить в БД" tone="secondary" icon="save-outline" disabled={!!busy} busy={busy === 'resave'} style={{ flex: 1, minWidth: 150 }} onPress={() => void run('resave', resaveSubscription)} />
        <Button label="Пересоздать подписку" tone="secondary" icon="refresh-outline" disabled={!!busy} busy={busy === 'recreate'} style={{ flex: 1, minWidth: 150 }} onPress={() => void run('recreate', recreateSubscription)} />
      </View>
      {logs.length ? (
        <View style={{ backgroundColor: c.raised, borderRadius: r.sm, padding: s.sm }}>
          <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
            {logs.map(entry => (
              <Text key={entry.id} style={{ fontSize: 11, lineHeight: 17, color: LOG_COLOR[entry.level], fontFamily: 'monospace' }}>[{entry.time}] {entry.text}</Text>
            ))}
          </ScrollView>
          <Button label="Очистить лог" tone="secondary" disabled={!!busy} onPress={() => setLogs([])} style={{ marginTop: s.sm }} />
        </View>
      ) : null}
    </View>
  );
}

export function SettingsScreen() { return <AccessGate allowPending><SettingsContent /></AccessGate>; }

function SettingsContent() {
  const { preferences, setPreference, logout, member } = useKodus();
  const password = usePasswordForm();
  const { showAlert } = useAlert();
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  const set = async (key: 'enterToSend' | 'showUnread', value: boolean) => {
    try { await setPreference(key, value); setError(''); }
    catch { setError('Не удалось сохранить настройку на устройстве.'); }
  };
  const exit = async () => {
    setLoggingOut(true);
    try { await logout(); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось выйти.'); }
    finally { setLoggingOut(false); }
  };

  return (
    <Page scroll keyboard bottom narrow>
      <Header title="Настройки" subtitle="Общение без лишнего" back />
      <View style={[styles.identity, ui.row]} dataSet={{ kodusCard: '1' }}>
        <View style={styles.symbol}><Ionicons name="settings-outline" size={28} color={c.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={ui.sectionTitle}>KODUS</Text>
          <Text style={ui.subtle}>Учебная группа · версия 1.0</Text>
        </View>
        <Badge label={THEMES.find(t => t.id === themeMode)?.name ?? 'Тёмная'} />
      </View>

      <View style={[ui.card, ui.stack, { marginTop: s.md }]} dataSet={{ kodusCard: '1' }}><ThemePicker /></View>

      <View style={[ui.card, ui.stack, { marginTop: s.md }]} dataSet={{ kodusCard: '1' }}>
        <Text style={ui.sectionTitle}>Переписка</Text>
        <View style={styles.preference}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.body}>Отправлять по Enter</Text>
            <Text style={ui.subtle}>В Web: Shift + Enter — новая строка.</Text>
          </View>
          <Switch accessibilityLabel="Отправлять сообщения по Enter" value={preferences.enterToSend} onValueChange={v => void set('enterToSend', v)} trackColor={{ false: c.border, true: c.primary }} thumbColor={c.white} />
        </View>
        <View style={ui.divider} />
        <View style={styles.preference}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={ui.body}>Отмечать новые сообщения</Text>
            <Text style={ui.subtle}>Индикатор непрочитанных чатов на этом устройстве.</Text>
          </View>
          <Switch accessibilityLabel="Показывать непрочитанные чаты" value={preferences.showUnread} onValueChange={v => void set('showUnread', v)} trackColor={{ false: c.border, true: c.primary }} thumbColor={c.white} />
        </View>
      </View>

      <View style={[ui.card, ui.stack, { marginTop: s.md }]} dataSet={{ kodusCard: '1' }}>
        <View style={ui.row}><Ionicons name="notifications-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Уведомления</Text></View>
        <PushControl />
        <View style={ui.divider} />
        <PushDiagnostics />
      </View>

      <View style={[ui.card, ui.stack, { marginTop: s.md }]} dataSet={{ kodusCard: '1' }}>
        <View style={ui.row}><Ionicons name="lock-closed-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Безопасность</Text></View>
        <Text style={ui.subtle}>Смените пароль текущего аккаунта. Используйте уникальный пароль.</Text>
        <Field label="Новый пароль" value={password.password} onChangeText={password.setPassword} secureTextEntry placeholder="Минимум 6 символов" editable={!password.busy} />
        <Field label="Повторите новый пароль" value={password.confirm} onChangeText={password.setConfirm} secureTextEntry editable={!password.busy} />
        <Notice message={password.error} />
        <Notice message={password.saved ? 'Пароль изменён.' : ''} success />
        <Button label="Обновить пароль" tone="secondary" busy={password.busy} onPress={() => void password.save()} />
      </View>

      <View style={[ui.card, ui.stack, { marginTop: s.md }]} dataSet={{ kodusCard: '1' }}>
        <View style={ui.row}><Ionicons name="server-outline" size={22} color={c.primary} /><Text style={ui.sectionTitle}>Данные и приватность</Text></View>
        <Text style={ui.subtle}>Авторизация, сообщения и аватары хранятся в OnSpace Cloud. Доступ к переписке проверяется на сервере. Сквозное шифрование не подключено.</Text>
        <Text style={ui.subtle}>Новости и группы обновляются автоматически. Настройки и отметки прочтения хранятся локально.</Text>
        {member?.role === 'master' ? <Badge label="Вы управляете доступом к группе" /> : null}
      </View>

      <View style={{ marginTop: s.lg, gap: s.md }}>
        <Notice message={error} />
        <Button label="Выйти из аккаунта" tone="danger" busy={loggingOut} icon="log-out-outline"
          onPress={() => showAlert('Выйти из KODUS?', 'Для доступа к чатам потребуется снова войти.', [{ text: 'Отмена', style: 'cancel' }, { text: 'Выйти', style: 'destructive', onPress: () => void exit() }])} />
      </View>
      <View style={{ height: s.xl }} />
    </Page>
  );
}

const styles = StyleSheet.create({
  identity: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: r.md, padding: s.md, flexWrap: 'wrap' },
  symbol: { height: 52, width: 52, borderRadius: r.md, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' },
  preference: { flexDirection: 'row', alignItems: 'center', gap: s.md },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: s.sm },
  themeCard: { flexGrow: 1, flexBasis: 150, minWidth: 150, maxWidth: '100%', backgroundColor: c.raised, borderRadius: r.sm, borderWidth: 1, borderColor: c.border, padding: s.sm, gap: 6 },
  themeActive: { borderColor: c.primary, borderWidth: 2 },
  themePreview: { height: 54, borderRadius: 8, padding: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  themeSurface: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, padding: 6 },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  themeLine: { flex: 1, height: 6, borderRadius: 3 },
  themeAccent: { position: 'absolute', top: 8, right: 8, width: 22, height: 6, borderRadius: 3 },
  themeName: { fontSize: 14, fontWeight: '700', color: c.text, flex: 1 },
  themeTag: { fontSize: 11, color: c.subtle },
});