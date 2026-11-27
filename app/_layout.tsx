import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GlobalNotifier from '../components/GlobalNotifier';
import ThemeEffects from '@/components/themes/ThemeEffects';
import { AlertProvider } from '@/template';
import { KodusProvider } from '@/contexts/KodusContext';
import { useWebInstall } from '@/hooks/useWebInstall';
import { colors, themeMode } from '@/constants/theme';

export default function RootLayout() {
  useWebInstall();
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <KodusProvider>
          <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="pending" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" />
          </Stack>
          <GlobalNotifier />
          <ThemeEffects />
        </KodusProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}