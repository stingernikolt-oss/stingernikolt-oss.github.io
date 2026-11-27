// Палитры KODUS: 8 тем + метаданные для выбора.
// Выбранный режим хранится в localStorage и применяется при запуске.
// Статические стили пересобираются после перезагрузки страницы — штатное поведение.
export type ThemeMode = 'dark' | 'light' | 'blood' | 'gothic' | 'winter' | 'neon' | 'inferno' | 'sakura';

const dark = {
  background: '#0E1621', surface: '#17212B', raised: '#182533', border: '#101921',
  primary: '#5288C1', primarySoft: '#2B5278', text: '#FFFFFF', subtle: '#708399', muted: '#6D7883',
  success: '#4FAE4E', successSoft: '#16281A', warning: '#E8A33D', warningSoft: '#332A16',
  danger: '#EC3942', dangerSoft: '#34181B', white: '#FFFFFF', bubble: '#2B5278',
  transparent: 'transparent', overlay: 'rgba(0,0,0,0.6)',
};
const light = {
  background: '#F4F4F5', surface: '#FFFFFF', raised: '#E7EBEE', border: '#DFE4E9',
  primary: '#3390EC', primarySoft: '#DDEBFC', text: '#0F1B25', subtle: '#707E8C', muted: '#8C99A6',
  success: '#3EA43E', successSoft: '#E2F4E3', warning: '#DB8E2B', warningSoft: '#FCF1DD',
  danger: '#E5393F', dangerSoft: '#FBE7E8', white: '#FFFFFF', bubble: '#3390EC',
  transparent: 'transparent', overlay: 'rgba(0,0,0,0.35)',
};
const blood = {
  background: '#0D0508', surface: '#1A0A0E', raised: '#241016', border: '#2E1218',
  primary: '#E01B2F', primarySoft: '#3A0F16', text: '#F5E9E9', subtle: '#A97F86', muted: '#8A6068',
  success: '#5FBF63', successSoft: '#14261A', warning: '#E8A33D', warningSoft: '#332512',
  danger: '#FF3B4E', dangerSoft: '#3A1218', white: '#FFFFFF', bubble: '#7A1220',
  transparent: 'transparent', overlay: 'rgba(18,0,4,0.72)',
};
const gothic = {
  background: '#0B0713', surface: '#150E22', raised: '#1D1430', border: '#271A3D',
  primary: '#9D5CFF', primarySoft: '#2A1B45', text: '#EFE9F7', subtle: '#9C8BB8', muted: '#7E6E99',
  success: '#57C777', successSoft: '#14261C', warning: '#E5B04C', warningSoft: '#322813',
  danger: '#FF4D6D', dangerSoft: '#371320', white: '#FFFFFF', bubble: '#3A2260',
  transparent: 'transparent', overlay: 'rgba(8,4,16,0.72)',
};
const winter = {
  background: '#0A1420', surface: '#10202F', raised: '#16293B', border: '#1E3347',
  primary: '#57B8FF', primarySoft: '#14344E', text: '#EAF4FB', subtle: '#8FB0C6', muted: '#6F8FA5',
  success: '#4FD08A', successSoft: '#122A1E', warning: '#F0B44A', warningSoft: '#33270F',
  danger: '#FF5A6E', dangerSoft: '#38141C', white: '#FFFFFF', bubble: '#1E4E75',
  transparent: 'transparent', overlay: 'rgba(4,10,18,0.7)',
};
const neon = {
  background: '#07070F', surface: '#0E0E1C', raised: '#151529', border: '#22224A',
  primary: '#00E5FF', primarySoft: '#0A2E3A', text: '#F2F7FF', subtle: '#8B93C8', muted: '#6C74A6',
  success: '#3DFFA0', successSoft: '#0E2A1E', warning: '#FFC53D', warningSoft: '#33270E',
  danger: '#FF2E63', dangerSoft: '#38101F', white: '#FFFFFF', bubble: '#0E3B46',
  transparent: 'transparent', overlay: 'rgba(4,4,12,0.75)',
};
const inferno = {
  background: '#100806', surface: '#1C100B', raised: '#26170F', border: '#331D12',
  primary: '#FF7A29', primarySoft: '#3A1D0C', text: '#FBEEE4', subtle: '#C09A82', muted: '#9A7660',
  success: '#6FCF6F', successSoft: '#182A16', warning: '#FFC53D', warningSoft: '#33270E',
  danger: '#FF4747', dangerSoft: '#3A1210', white: '#FFFFFF', bubble: '#7A3413',
  transparent: 'transparent', overlay: 'rgba(16,6,2,0.72)',
};
const sakura = {
  background: '#120A14', surface: '#1D1220', raised: '#271A2B', border: '#342239',
  primary: '#FF7EB6', primarySoft: '#3A1F30', text: '#F9EEF4', subtle: '#C39BAF', muted: '#9F7C90',
  success: '#5FCF8A', successSoft: '#142A1E', warning: '#F0B44A', warningSoft: '#33270F',
  danger: '#FF5A76', dangerSoft: '#3A1420', white: '#FFFFFF', bubble: '#6E2A4E',
  transparent: 'transparent', overlay: 'rgba(14,6,14,0.72)',
};

const palettes: Record<ThemeMode, typeof dark> = { dark, light, blood, gothic, winter, neon, inferno, sakura };

export interface ThemeMeta {
  id: ThemeMode; name: string; tagline: string; icon: string;
  preview: [string, string, string, string]; // bg, surface, primary, accent
  effect: string; animated: boolean;
}
export const THEMES: ThemeMeta[] = [
  { id: 'dark', name: 'Тёмная', tagline: 'Классика KODUS', icon: 'moon-outline', preview: ['#0E1621', '#17212B', '#5288C1', '#2B5278'], effect: 'Без эффектов', animated: false },
  { id: 'light', name: 'Светлая', tagline: 'Дневной режим', icon: 'sunny-outline', preview: ['#F4F4F5', '#FFFFFF', '#3390EC', '#DDEBFC'], effect: 'Без эффектов', animated: false },
  { id: 'blood', name: 'Кровавая', tagline: 'Кровь стекает по элементам', icon: 'water-outline', preview: ['#0D0508', '#1A0A0E', '#E01B2F', '#7A1220'], effect: 'Капли крови сверху вниз', animated: true },
  { id: 'gothic', name: 'Готическая', tagline: 'Луна, туман и летучие мыши', icon: 'skull-outline', preview: ['#0B0713', '#150E22', '#9D5CFF', '#3A2260'], effect: 'Летучие мыши и туман', animated: true },
  { id: 'winter', name: 'Зимняя', tagline: 'Снегопад и гирлянда', icon: 'snow-outline', preview: ['#0A1420', '#10202F', '#57B8FF', '#FFD166'], effect: 'Снег + гирлянда', animated: true },
  { id: 'neon', name: 'Неон', tagline: 'Киберпанк-сетка и сканлайн', icon: 'flash-outline', preview: ['#07070F', '#0E0E1C', '#00E5FF', '#FF2E97'], effect: 'Неоновые импульсы', animated: true },
  { id: 'inferno', name: 'Инферно', tagline: 'Угли поднимаются из пекла', icon: 'flame-outline', preview: ['#100806', '#1C100B', '#FF7A29', '#FFC53D'], effect: 'Летящие угли', animated: true },
  { id: 'sakura', name: 'Сакура', tagline: 'Ночной сад, лепестки', icon: 'flower-outline', preview: ['#120A14', '#1D1220', '#FF7EB6', '#FFB7D5'], effect: 'Падающие лепестки', animated: true },
];

const IDS = THEMES.map(t => t.id);
function initialMode(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const v = window.localStorage.getItem('kodus.theme') as ThemeMode | null;
      if (v && IDS.includes(v)) return v;
    }
  } catch { /* вне браузера — тёмная по умолчанию */ }
  return 'dark';
}
export const themeMode: ThemeMode = initialMode();
export const colors = palettes[themeMode];
export const themeMeta = THEMES.find(t => t.id === themeMode) ?? THEMES[0];

export function applyTheme(mode: ThemeMode) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('kodus.theme', mode);
  } catch { /* на мобильных тема применится после перезапуска */ }
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') window.location.reload();
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const type = { small: 13, label: 14, body: 16, section: 18, title: 24, hero: 34 };