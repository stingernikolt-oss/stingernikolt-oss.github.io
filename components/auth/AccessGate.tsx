import { type ReactNode } from 'react';
import { Redirect } from 'expo-router';
import { useKodus } from '@/hooks/useKodus';
import { Page } from '@/components/layout/Page';
import { EmptyState, Notice } from '@/components/ui/Primitives';
import { Splash } from '@/components/ui/Splash';

interface AccessGateProps { children: ReactNode; allowPending?: boolean; masterOnly?: boolean }
export function AccessGate({ children, allowPending = false, masterOnly = false }: AccessGateProps) {
  const { ready, user, member, profileLoading, profileError, refreshMember, settings } = useKodus();
  if (!ready || profileLoading) return <Splash />;
  if (!user) return <Redirect href="/login" />;
  if (!member) return <Redirect href="/" />;
  if (settings.maintenance_mode && member.role !== 'master') {
    return (
      <Page bottom>
        <EmptyState icon="construct-outline" title="Технические работы" description={settings.maintenance_text} />
      </Page>
    );
  }
  if (!allowPending && member.status !== 'approved') return <Redirect href="/pending" />;
  if (profileError && !member) return <Page bottom><Notice message={`Проверка доступа недоступна: ${profileError}`} onRetry={() => void refreshMember()} /></Page>;
  if (masterOnly && member.role !== 'master') return <Page bottom><EmptyState icon="lock-closed-outline" title="Доступ ограничен" description="Управление учебной группой доступно только мастеру." /></Page>;
  return <>{children}</>;
}