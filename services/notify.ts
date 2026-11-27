import { Platform } from 'react-native';

let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  if (Platform.OS !== 'web') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = audioCtx ?? new AudioContextClass();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch { /* ignore */ }
}

export function playPing() {
  if (Platform.OS !== 'web') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = audioCtx ?? new AudioContextClass();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const notes: Array<[number, number]> = [[880, 0], [1174.7, 0.15]];
    for (const [freq, delay] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      const t = audioCtx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.4);
    }
  } catch { /* без звука не падаем */ }
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (Platform.OS !== 'web' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (Platform.OS !== 'web' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied'; // нельзя сбросить из кода
  return await Notification.requestPermission();
}

export function showNotify(title: string, body: string) {
  if (Platform.OS !== 'web' || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/kodus-icon.png' });
  } catch { /* ignore */ }
}