// Живые эффекты тем: кровь, летучие мыши, снег+гирлянда, неон, угли, сакура.
// Работает в Web/PWA. Оверлей не перехватывает касания. Анимации — чистый CSS (transform/opacity).
import { useEffect, useMemo } from 'react';
import { Platform } from 'react-native';
import { useKodus } from '@/hooks/useKodus';
import { colors as c, themeMode } from '@/constants/theme';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const BASE_CSS = `
html{scrollbar-color:${c.border} ${c.background};scrollbar-width:thin;}
*::-webkit-scrollbar{width:10px;height:10px;}
*::-webkit-scrollbar-track{background:${c.background};}
*::-webkit-scrollbar-thumb{background:${c.border};border-radius:8px;border:2px solid ${c.background};}
*::-webkit-scrollbar-thumb:hover{background:${c.primary};}
::selection{background:${c.primarySoft};color:${c.text};}
.kx-root{position:fixed;inset:0;pointer-events:none;z-index:80;overflow:hidden;}
.kx{position:absolute;will-change:transform;}
@keyframes kx-fall{0%{transform:translateY(-8vh);}100%{transform:translateY(112vh);}}
@keyframes kx-rise{0%{transform:translateY(108vh);}100%{transform:translateY(-10vh);}}
@keyframes kx-sway{0%{transform:translateX(-16px);}100%{transform:translateX(16px);}}
@keyframes kx-spin{0%{transform:rotate(0deg) rotateX(0deg);}100%{transform:rotate(360deg) rotateX(180deg);}}
@keyframes kx-flicker{0%,100%{opacity:.35;}45%{opacity:1;}70%{opacity:.6;}}
@media (prefers-reduced-motion: reduce){.kx-root{display:none;}}
`;

const BLOOD_CSS = `
html[data-kodus-theme="blood"] [data-kodus-card]{position:relative;}
html[data-kodus-theme="blood"] [data-kodus-card]::before{content:"";position:absolute;left:0;right:0;top:0;height:15px;z-index:3;pointer-events:none;border-radius:inherit;transform-origin:top;
 background:radial-gradient(circle at 10px -6px,#8E0716 13px,rgba(142,7,22,0) 14px) 0 0/34px 15px repeat-x,linear-gradient(180deg,#5C020D 0%,#8E0716 55%,rgba(142,7,22,0) 100%);
 animation:kx-ooze 5s ease-in-out infinite;opacity:.94;}
html[data-kodus-theme="blood"] [data-kodus-card]::after{content:"";position:absolute;top:2px;left:18%;width:4px;height:34px;z-index:3;pointer-events:none;border-radius:0 0 6px 6px;transform-origin:top;
 background:linear-gradient(180deg,#8E0716,#C1121F 70%,#E01B2F);animation:kx-strand 4.2s ease-in-out infinite;}
html[data-kodus-theme="blood"] [data-kodus-card]:nth-child(even)::after{left:64%;height:46px;animation-delay:-2.1s;}
html[data-kodus-theme="blood"] [data-kodus-card]:nth-child(3n)::after{left:40%;height:26px;animation-delay:-1.2s;}
@keyframes kx-ooze{0%,100%{transform:scaleY(.72);}50%{transform:scaleY(1.18);}}
@keyframes kx-strand{0%,100%{transform:scaleY(.3);}55%{transform:scaleY(1);}72%{transform:scaleY(.85);}}
.kx-ledge{position:absolute;top:0;left:0;right:0;height:9px;background:linear-gradient(180deg,#4A010B,#8E0716);box-shadow:0 2px 14px rgba(193,18,31,.55);}
.kx-scallop{position:absolute;top:8px;left:0;right:0;height:24px;background:radial-gradient(circle at 14px -8px,#8E0716 16px,rgba(142,7,22,0) 17px) 0 0/42px 24px repeat-x;animation:kx-ooze 6s ease-in-out infinite;transform-origin:top;}
.kx-longdrip{position:absolute;top:6px;width:5px;border-radius:0 0 8px 8px;background:linear-gradient(180deg,#8E0716,#C1121F 60%,#E01B2F);transform-origin:top;animation:kx-strand 5.5s ease-in-out infinite;}
.kx-longdrip i{position:absolute;left:-2px;bottom:-6px;width:9px;height:11px;border-radius:50% 50% 55% 55%;background:#C1121F;}
.kx-drop{width:6px;height:16px;border-radius:45% 55% 55% 55%/28% 28% 72% 72%;background:linear-gradient(180deg,#E01B2F,#7A0000);box-shadow:0 0 6px rgba(224,27,47,.5);}
.kx-vignette{position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 0%,rgba(122,0,0,.14),transparent 55%);}
`;

const GOTHIC_CSS = `
.kx-moon{position:absolute;top:34px;right:56px;width:86px;height:86px;border-radius:50%;background:radial-gradient(circle at 38% 34%,#F4EDFB,#CBB8E8 58%,#8F76B8);box-shadow:0 0 60px 22px rgba(157,92,255,.28);opacity:.85;}
.kx-fog{position:absolute;width:64vw;height:26vh;border-radius:50%;filter:blur(46px);background:rgba(157,92,255,.12);animation:kx-fog 26s ease-in-out infinite alternate;}
@keyframes kx-fog{0%{transform:translateX(-12vw);}100%{transform:translateX(14vw);}}
.kx-bat{animation-timing-function:linear;animation-iteration-count:infinite;}
.kx-bat svg{display:block;animation:kx-flap .32s ease-in-out infinite alternate;filter:drop-shadow(0 0 6px rgba(157,92,255,.45));}
@keyframes kx-flap{0%{transform:scaleY(1);}100%{transform:scaleY(.62);}}
@keyframes kx-bat1{0%{transform:translate(-10vw,22vh);}25%{transform:translate(24vw,12vh);}50%{transform:translate(52vw,28vh);}75%{transform:translate(80vw,10vh);}100%{transform:translate(112vw,20vh);}}
@keyframes kx-bat2{0%{transform:translate(112vw,58vh);}30%{transform:translate(70vw,44vh);}60%{transform:translate(38vw,62vh);}100%{transform:translate(-12vw,40vh);}}
@keyframes kx-bat3{0%{transform:translate(-10vw,74vh);}40%{transform:translate(40vw,56vh);}70%{transform:translate(72vw,70vh);}100%{transform:translate(112vw,50vh);}}
`;

const WINTER_CSS = `
.kx-snow{border-radius:50%;background:radial-gradient(circle,#FFFFFF 0%,rgba(255,255,255,.85) 45%,rgba(255,255,255,0) 72%);box-shadow:0 0 6px rgba(200,230,255,.5);}
.kx-garland{position:absolute;top:0;left:0;right:0;height:92px;}
.kx-bulb{animation:kx-twinkle 1.7s ease-in-out infinite alternate;}
@keyframes kx-twinkle{0%{opacity:.35;}100%{opacity:1;}}
.kx-frost{position:absolute;inset:0;background:radial-gradient(110% 70% at 50% 0%,rgba(87,184,255,.10),transparent 55%);}
`;

const NEON_CSS = `
html[data-kodus-theme="neon"] [data-kodus-card]{box-shadow:0 0 0 1px rgba(0,229,255,.28),0 0 18px rgba(255,46,151,.14);animation:kx-neonpulse 4s ease-in-out infinite alternate;}
@keyframes kx-neonpulse{0%{box-shadow:0 0 0 1px rgba(0,229,255,.22),0 0 10px rgba(255,46,151,.10);}100%{box-shadow:0 0 0 1px rgba(0,229,255,.5),0 0 26px rgba(255,46,151,.28);}}
.kx-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#00E5FF 30%,#FF2E97 70%,transparent);box-shadow:0 0 16px rgba(0,229,255,.7);animation:kx-scan 7s linear infinite;}
@keyframes kx-scan{0%{transform:translateY(-4vh);opacity:0;}6%{opacity:1;}94%{opacity:1;}100%{transform:translateY(104vh);opacity:0;}}
.kx-orb{border-radius:50%;filter:blur(14px);animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate;}
@keyframes kx-orb{0%{transform:translate(0,0) scale(1);}100%{transform:translate(6vw,-14vh) scale(1.25);}}
.kx-grid{position:absolute;left:-12%;right:-12%;bottom:-2%;height:32vh;transform:perspective(420px) rotateX(58deg);transform-origin:bottom;
 background:repeating-linear-gradient(90deg,rgba(0,229,255,.16) 0 1px,transparent 1px 60px),repeating-linear-gradient(0deg,rgba(255,46,151,.15) 0 1px,transparent 1px 46px);
 -webkit-mask-image:linear-gradient(transparent,#000 35%);mask-image:linear-gradient(transparent,#000 35%);animation:kx-gridmove 5s linear infinite;}
@keyframes kx-gridmove{0%{background-position:0 0,0 0;}100%{background-position:0 0,0 46px;}}
`;

const INFERNO_CSS = `
html[data-kodus-theme="inferno"] [data-kodus-card]{position:relative;}
html[data-kodus-theme="inferno"] [data-kodus-card]::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;z-index:3;pointer-events:none;border-radius:inherit;
 background:linear-gradient(90deg,transparent,#FF7A29 25%,#FFC53D 50%,#FF4747 75%,transparent);animation:kx-flicker 3.2s ease-in-out infinite;}
.kx-ember{border-radius:50%;animation-timing-function:linear;animation-iteration-count:infinite;}
.kx-ember i{display:block;width:100%;height:100%;border-radius:50%;animation:kx-flicker 1.1s ease-in-out infinite;}
.kx-heat{position:absolute;left:0;right:0;bottom:0;height:130px;background:linear-gradient(0deg,rgba(255,90,20,.20),transparent);animation:kx-heat 3s ease-in-out infinite alternate;}
@keyframes kx-heat{0%{opacity:.55;}100%{opacity:1;}}
`;

const SAKURA_CSS = `
html[data-kodus-theme="sakura"] [data-kodus-card]{position:relative;}
html[data-kodus-theme="sakura"] [data-kodus-card]::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;z-index:3;pointer-events:none;border-radius:inherit;
 background:linear-gradient(90deg,transparent,#FF7EB6 30%,#FFB7D5 60%,transparent);opacity:.8;}
.kx-petal{border-radius:150% 0 150% 0;background:linear-gradient(135deg,#FFB7D5,#FF7EB6);box-shadow:0 0 5px rgba(255,126,182,.35);}
.kx-sakmoon{position:absolute;top:40px;left:52px;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#FFF3F8,#FFC9DE 60%,#E58FB6);box-shadow:0 0 54px 20px rgba(255,126,182,.22);opacity:.8;}
`;

const BAT_PATH = 'M32 14c-1.8-5.5-7-8.6-12.6-7.6 2.4 2.3 3.3 5 2.6 7.8-5.4-1.6-10.9.3-14.6 4.9 4.4-.9 8 .1 10.7 2.9 2.7-1.7 6-1.4 8.6.9L32 28l5.3-5.1c2.6-2.3 5.9-2.6 8.6-.9 2.7-2.8 6.3-3.8 10.7-2.9-3.7-4.6-9.2-6.5-14.6-4.9-.7-2.8.2-5.5 3-9-6-1-12 2-14 8z';
const GARLAND_COLORS = ['#FF5A5A', '#FFD166', '#5AFF9D', '#57B8FF', '#FF8AE2'];

function Bat({ i }: { i: number }) {
  const size = 22 + (i % 3) * 12;
  const anim = `kx-bat${(i % 3) + 1}`;
  return (
    <div className="kx kx-bat" style={{ animationName: anim, animationDuration: `${22 + i * 5}s`, animationDelay: `${-i * 7}s`, top: 0, left: 0 }}>
      <svg width={size} height={size / 2} viewBox="0 0 64 32"><path d={BAT_PATH} fill="#05030A" /></svg>
    </div>
  );
}

function Garland() {
  const bulbs: { x: number; y: number; color: string; i: number }[] = [];
  let n = 0;
  for (let seg = 0; seg < 4; seg++) {
    for (const t of [0.2, 0.5, 0.8]) {
      const x = seg * 300 + t * 300;
      const y = (1 - t) * (1 - t) * 20 + 2 * t * (1 - t) * 78 + t * t * 20;
      bulbs.push({ x, y, color: GARLAND_COLORS[n % GARLAND_COLORS.length], i: n });
      n++;
    }
  }
  return (
    <div className="kx-garland">
      <svg width="100%" height="92" viewBox="0 0 1200 92" preserveAspectRatio="none">
        <path d="M0 20 Q150 78 300 20 T600 20 T900 20 T1200 20" fill="none" stroke="#1E3347" strokeWidth="3" />
        {bulbs.map(b => (
          <g key={b.i} className="kx-bulb" style={{ animationDelay: `${(b.i * 0.23) % 1.7}s` }}>
            <line x1={b.x} y1={b.y} x2={b.x} y2={b.y + 7} stroke="#1E3347" strokeWidth="2" />
            <circle cx={b.x} cy={b.y + 13} r="10" fill={b.color} opacity="0.3" />
            <circle cx={b.x} cy={b.y + 13} r="5" fill={b.color} />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ThemeEffects() {
  if (Platform.OS !== 'web') return null;
  return <WebEffects />;
}

function WebEffects() {
  const { preferences, settings } = useKodus();
  const anim = preferences.themeAnimations && settings.animations_enabled;
  const theme = themeMode;
  const isNarrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const n = (desktop: number, mobile: number) => (isNarrow ? mobile : desktop);

  useEffect(() => {
    console.log(`[KODUS FX] тема=${theme}, анимации=${anim}, web=true, narrow=${isNarrow}`);
  }, [theme, anim, isNarrow]);

  const drops = useMemo(() => Array.from({ length: n(14, 8) }, (_, i) => ({ left: rnd(2, 98), dur: rnd(2.6, 5.2), delay: -rnd(0, 6), scale: rnd(0.7, 1.5), key: i })), []);
  const longDrips = useMemo(() => Array.from({ length: n(6, 4) }, (_, i) => ({ left: 6 + i * 16 + rnd(-3, 3), h: rnd(46, 130), delay: -rnd(0, 5), key: i })), []);
  const snow = useMemo(() => Array.from({ length: n(30, 16) }, (_, i) => ({ left: rnd(0, 100), size: rnd(3, 7.5), dur: rnd(7, 15), delay: -rnd(0, 15), sway: rnd(2.4, 4.6), blur: Math.random() > 0.7, op: rnd(0.5, 1), key: i })), []);
  const embers = useMemo(() => Array.from({ length: n(18, 10) }, (_, i) => ({ left: rnd(0, 100), size: rnd(3, 6.5), dur: rnd(6, 13), delay: -rnd(0, 13), sway: rnd(2, 4.5), color: ['#FF7A29', '#FFC53D', '#FF4747'][i % 3], key: i })), []);
  const petals = useMemo(() => Array.from({ length: n(16, 9) }, (_, i) => ({ left: rnd(0, 100), w: rnd(9, 15), dur: rnd(8, 16), delay: -rnd(0, 16), sway: rnd(2.6, 5), spin: rnd(2.5, 6), key: i })), []);
  const orbs = useMemo(() => Array.from({ length: n(8, 5) }, (_, i) => ({ left: rnd(4, 90), top: rnd(10, 80), size: rnd(40, 110), dur: rnd(9, 18), delay: -rnd(0, 10), color: i % 2 ? 'rgba(0,229,255,.16)' : 'rgba(255,46,151,.15)', key: i })), []);
  const bats = useMemo(() => Array.from({ length: n(5, 3) }, (_, i) => i), []);

  const css = BASE_CSS
    + (anim && theme === 'blood' ? BLOOD_CSS : '')
    + (anim && theme === 'gothic' ? GOTHIC_CSS : '')
    + (anim && theme === 'winter' ? WINTER_CSS : '')
    + (anim && theme === 'neon' ? NEON_CSS : '')
    + (anim && theme === 'inferno' ? INFERNO_CSS : '')
    + (anim && theme === 'sakura' ? SAKURA_CSS : '');

  return (
    <div className="kx-root" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {anim && theme === 'blood' && (
        <>
          <div className="kx-vignette" />
          <div className="kx-ledge" />
          <div className="kx-scallop" />
          {longDrips.map(d => (
            <div key={d.key} className="kx-longdrip" style={{ left: `${d.left}%`, height: d.h, animationDelay: `${d.delay}s` }}><i /></div>
          ))}
          {drops.map(d => (
            <div key={d.key} className="kx" style={{ left: `${d.left}%`, top: 0, animation: `kx-fall ${d.dur}s linear infinite`, animationDelay: `${d.delay}s` }}>
              <div className="kx-drop" style={{ transform: `scale(${d.scale})` }} />
            </div>
          ))}
        </>
      )}
      {anim && theme === 'gothic' && (
        <>
          <div className="kx-moon" />
          <div className="kx-fog" style={{ left: '-8vw', top: '30vh' }} />
          <div className="kx-fog" style={{ left: '30vw', top: '64vh', animationDelay: '-13s' }} />
          {bats.map(i => <Bat key={i} i={i} />)}
        </>
      )}
      {anim && theme === 'winter' && (
        <>
          <div className="kx-frost" />
          <Garland />
          {snow.map(s => (
            <div key={s.key} className="kx" style={{ left: `${s.left}%`, top: 0, animation: `kx-fall ${s.dur}s linear infinite`, animationDelay: `${s.delay}s`, opacity: s.op }}>
              <div style={{ animation: `kx-sway ${s.sway}s ease-in-out infinite alternate` }}>
                <div className="kx-snow" style={{ width: s.size, height: s.size, filter: s.blur ? 'blur(1px)' : undefined }} />
              </div>
            </div>
          ))}
        </>
      )}
      {anim && theme === 'neon' && (
        <>
          <div className="kx-grid" />
          <div className="kx-scan" />
          {orbs.map(o => (
            <div key={o.key} className="kx kx-orb" style={{ left: `${o.left}%`, top: `${o.top}%`, width: o.size, height: o.size, background: o.color, animationName: 'kx-orb', animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s` }} />
          ))}
        </>
      )}
      {anim && theme === 'inferno' && (
        <>
          <div className="kx-heat" />
          {embers.map(e => (
            <div key={e.key} className="kx kx-ember" style={{ left: `${e.left}%`, top: 0, width: e.size, height: e.size, animationName: 'kx-rise', animationDuration: `${e.dur}s`, animationDelay: `${e.delay}s` }}>
              <div style={{ animation: `kx-sway ${e.sway}s ease-in-out infinite alternate`, width: '100%', height: '100%' }}>
                <i style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }} />
              </div>
            </div>
          ))}
        </>
      )}
      {anim && theme === 'sakura' && (
        <>
          <div className="kx-sakmoon" />
          {petals.map(p => (
            <div key={p.key} className="kx" style={{ left: `${p.left}%`, top: 0, animation: `kx-fall ${p.dur}s linear infinite`, animationDelay: `${p.delay}s` }}>
              <div style={{ animation: `kx-sway ${p.sway}s ease-in-out infinite alternate` }}>
                <div className="kx-petal" style={{ width: p.w, height: p.w * 0.82, animation: `kx-spin ${p.spin}s linear infinite` }} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}