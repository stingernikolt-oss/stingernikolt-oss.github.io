import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDirectory } from '@/hooks/useDirectory';
import { useKodus } from '@/hooks/useKodus';
import { formatLastSeen, isOnlineLastSeen } from '@/services/kodusService';
import { AccessGate } from '@/components/auth/AccessGate';
import { Page, Header } from '@/components/layout/Page';
import { Avatar, Badge, EmptyState, Field, LoadingState, Notice, ui } from '@/components/ui/Primitives';
import { colors as c, radius as r, spacing as s } from '@/constants/theme';

export function DirectoryScreen() { return <AccessGate><DirectoryContent /></AccessGate>; }

function DirectoryContent() {
  const f = useDirectory();
  const { presence, settings } = useKodus();
  const presenceOn = settings.presence_enabled;
  const onlineCount = presenceOn ? f.members.filter(m => isOnlineLastSeen(presence[m.id])).length : 0;

  return (
    <Page keyboard bottom>
      <FlatList
        data={f.visible}
        keyExtractor={m => m.id}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: s.xl }}
        refreshControl={<RefreshControl refreshing={f.loading} onRefresh={() => void f.refresh()} tintColor={c.primary} />}
        ListHeaderComponent={
          <View style={{ gap: s.lg }}>
            <Header title="Участники" subtitle="Начните личный разговор" back />
            <View style={[ui.card, { gap: s.md }]} dataSet={{ kodusCard: '1' }}>
              <Ionicons name="school-outline" size={28} color={c.primary} />
              <Text style={ui.sectionTitle}>Ваша учебная группа</Text>
              <Text style={ui.subtle}>Здесь только участники с подтверждённым доступом. Найдите человека по ФИО или логину.</Text>
              <View style={{ flexDirection: 'row', gap: s.sm, flexWrap: 'wrap' }}>
                <Badge label={`${f.members.length} участников`} tone="success" />
                {presenceOn ? <Badge label={`${onlineCount} в сети`} /> : null}
              </View>
            </View>
            <Field
              label="Поиск участников"
              placeholder="ФИО или @логин"
              icon="search-outline"
              value={f.query}
              onChangeText={value => f.setQuery(value.startsWith('@') ? value.slice(1) : value)}
              autoCapitalize="none"
            />
            <Notice message={f.error} onRetry={() => void f.refresh()} />
            <Text style={ui.eyebrow}>УЧАСТНИКИ · {f.visible.length}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const online = presenceOn && isOnlineLastSeen(presence[item.id]);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Написать ${item.full_name}`}
              disabled={!!f.busy}
              onPress={() => void f.open(item.id)}
              style={({ pressed }) => [styles.row, pressed ? { backgroundColor: c.raised } : null]}
            >
              <Avatar
                name={item.full_name}
                path={item.avatar_path}
                status={presenceOn ? (online ? 'online' : 'offline') : undefined}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={ui.sectionTitle}>{item.full_name}</Text>
                <Text style={ui.subtle}>@{item.login}{item.role === 'master' ? ' · мастер' : ''}</Text>
                {presenceOn ? (
                  <Text style={[styles.lastSeen, online ? { color: c.success } : null]}>
                    {online ? 'в сети' : formatLastSeen(presence[item.id])}
                  </Text>
                ) : null}
              </View>
              <Ionicons name={f.busy === item.id ? 'hourglass-outline' : 'chatbubble-outline'} size={22} color={c.primary} />
            </Pressable>
          );
        }}
        ListEmptyComponent={f.loading
          ? <LoadingState />
          : <EmptyState
              icon="people-outline"
              title={f.query ? 'Участник не найден' : 'Участников пока нет'}
              description={f.query ? 'Проверьте написание ФИО или логина.' : 'Одобренные участники появятся здесь. Новые заявки находятся в панели мастера.'}
            />}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: s.md, alignItems: 'center', paddingVertical: s.lg, borderBottomWidth: 1, borderBottomColor: c.border, borderRadius: r.sm },
  lastSeen: { fontSize: 12, color: c.muted },
});