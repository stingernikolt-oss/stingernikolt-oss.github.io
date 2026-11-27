import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const themeScript = `(function(){
  try {
    var r = sessionStorage.getItem('kodus.redirect');
    if (r && r !== '/') { sessionStorage.removeItem('kodus.redirect'); window.history.replaceState(null, '', r); }
    var M = {dark:['#0E1621','#17212B'],light:['#F4F4F5','#FFFFFF'],blood:['#0D0508','#1A0A0E'],gothic:['#0B0713','#150E22'],winter:['#0A1420','#10202F'],neon:['#07070F','#0E0E1C'],inferno:['#100806','#1C100B'],sakura:['#120A14','#1D1220']};
    var t = localStorage.getItem('kodus.theme');
    if (!M[t]) t = 'dark';
    var p = M[t];
    document.documentElement.style.background = p[0];
    document.documentElement.setAttribute('data-kodus-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', p[1]);
  } catch(e) {}
})();`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0E1621" />
        <meta name="description" content="KODUS — закрытый мессенджер учебной группы колледжа" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="KODUS" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/kodus-icon.png" />
        <link rel="apple-touch-icon" href="/kodus-icon.png" />
        <title>KODUS — учебная группа</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html,body,#root{height:100%;}body{margin:0;}input,textarea{outline:none;}*{box-sizing:border-box;}' }} />
      </head>
      <body>{children}</body>
    </html>
  );
}