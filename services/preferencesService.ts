import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Preferences { enterToSend: boolean; showUnread: boolean; themeAnimations: boolean }
export const defaultPreferences: Preferences = { enterToSend: true, showUnread: true, themeAnimations: true };

export async function readPreferences(): Promise<Preferences> {
  const value = await AsyncStorage.getItem('kodus.preferences');
  try { return value ? { ...defaultPreferences, ...JSON.parse(value) } : defaultPreferences; } catch { return defaultPreferences; }
}
export async function writePreferences(value: Preferences) { await AsyncStorage.setItem('kodus.preferences', JSON.stringify(value)); }
export async function readMarkers(userId: string): Promise<Record<string, string>> {
  const value = await AsyncStorage.getItem(`kodus.read.${userId}`);
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}
export async function writeMarkers(userId: string, value: Record<string, string>) { await AsyncStorage.setItem(`kodus.read.${userId}`, JSON.stringify(value)); }

export async function readHiddenNews(userId: string): Promise<string[]> {
  const value = await AsyncStorage.getItem(`kodus.hiddenNews.${userId}`);
  try { return value ? JSON.parse(value) : []; } catch { return []; }
}
export async function writeHiddenNews(userId: string, ids: string[]) { await AsyncStorage.setItem(`kodus.hiddenNews.${userId}`, JSON.stringify(ids)); }