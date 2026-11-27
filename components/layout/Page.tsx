import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors as c, spacing as s } from '@/constants/theme';
import { IconButton, ui } from '@/components/ui/Primitives';

interface PageProps { children: ReactNode; scroll?: boolean; keyboard?: boolean; bottom?: boolean; narrow?: boolean }
export function Page({ children, scroll = false, keyboard = false, bottom = false, narrow = false }: PageProps) {
  return (
    <SafeAreaView edges={bottom ? ['top', 'bottom'] : ['top']} style={styles.root}>
      <KeyboardAvoidingView enabled={keyboard} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.root}>
        {scroll
          ? <ScrollView style={styles.root} contentContainerStyle={[styles.content, narrow ? styles.narrow : null]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          : <View style={[styles.content, styles.fill, narrow ? styles.narrow : null]}>{children}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface HeaderProps { title: string; subtitle?: string; back?: boolean; action?: ReactNode }
export function Header({ title, subtitle, back = false, action }: HeaderProps) {
  const router = useRouter();
  return (
    <View style={styles.header} dataSet={{ kodusCard: '1' }}>
      {back ? <IconButton icon="arrow-back-outline" label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /> : null}
      <View style={styles.heading}>
        <Text style={ui.pageTitle}>{title}</Text>
        {subtitle ? <Text style={ui.subtle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: s.md },
  narrow: { maxWidth: 560 },
  fill: { flex: 1 },
  header: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: s.sm, paddingVertical: s.sm },
  heading: { flex: 1, gap: 2 },
});