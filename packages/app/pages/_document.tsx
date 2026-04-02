import { Html, Head, Main, NextScript } from 'next/document';
import { readFileSync } from 'fs';
import { join } from 'path';

function getBuildHash(): string {
  try {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), '.rex/build/manifest.json'), 'utf-8'));
    return (manifest.build_id as string)?.slice(0, 8) || 'dev';
  } catch {
    return 'dev';
  }
}

export default function Document() {
  const buildHash = getBuildHash();

  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <meta name="theme-color" content="#f4f4f5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="build-hash" content={buildHash} />
        {process.env.DEFAULT_THEME && <meta name="default-palette" content={process.env.DEFAULT_THEME} />}
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(typeof localStorage==='undefined')return;try{var b=document.body,t=localStorage.getItem('theme-preference')||'system',hcStored=localStorage.getItem('high-contrast'),hc=hcStored!==null?hcStored==='true':matchMedia('(prefers-contrast:more)').matches,p=localStorage.getItem('theme-palette');if(!p){var m=document.querySelector('meta[name="default-palette"]');if(m)p=m.getAttribute('content')}if(t!=='system')b.dataset.colorScheme=t;if(hc)b.dataset.highContrast='';if(p&&p!=='default')b.dataset.theme=p;var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);b.style.colorScheme=dark?'dark':'light'}catch(e){}})()` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
