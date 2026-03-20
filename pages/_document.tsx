import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#18181b" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {process.env.DEFAULT_THEME && <meta name="default-palette" content={process.env.DEFAULT_THEME} />}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var d=document.documentElement,t=localStorage.getItem('theme-preference')||'system',hcStored=localStorage.getItem('high-contrast'),hc=hcStored!==null?hcStored==='true':matchMedia('(prefers-contrast:more)').matches,p=localStorage.getItem('theme-palette'),dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);if(!p){var m=document.querySelector('meta[name="default-palette"]');if(m)p=m.getAttribute('content')}if(dark)d.classList.add('dark');if(hc)d.classList.add('high-contrast');if(p==='rose')d.classList.add('theme-rose');if(p==='rebecca')d.classList.add('theme-rebecca');if(p==='claude')d.classList.add('theme-claude');d.style.colorScheme=dark?'dark':'light'}catch(e){}})()` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
