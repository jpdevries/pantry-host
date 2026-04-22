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
        {/* Force browsers (especially Safari) to revalidate cached HTML
            instead of serving a stale document that carries a stale
            <meta name="build-hash"> — which would otherwise keep the
            SW pinned to the previous deploy's registration URL. This
            is a weak polyfill for a real response-level
            `Cache-Control: no-cache` header; see
            https://github.com/limlabs/rex/issues/242 for the follow-up
            request that Rex send it server-side. Note: `no-cache` ≠
            `no-store` — browsers still cache the HTML, they just
            revalidate (conditional GET) before using it. Offline mode
            is unaffected; the SW owns that path and doesn't read
            Cache-Control. */}
        <meta httpEquiv="Cache-Control" content="no-cache, must-revalidate" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <meta name="theme-color" content="#f4f4f5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* iOS Add-to-Home-Screen: launch inside Safari (with back button) until
            we build our own in-app back navigation. Paired with manifest's
            display: minimal-ui so Android gets the same treatment. */}
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="mobile-web-app-capable" content="no" />
        <meta name="apple-mobile-web-app-title" content="Pantry Host" />
        {/* og:image lives in _app.tsx Head (keyed) so page Heads can dedupe-override it — _document.tsx is outside next/head's dedup stack. */}
        <meta name="build-hash" content={buildHash} />
        {process.env.DEFAULT_THEME && <meta name="default-palette" content={process.env.DEFAULT_THEME} />}
        {/* Optional override for the GraphQL API origin. Set when the
            frontend and API aren't co-located at the same origin — e.g.
            Tailscale-serve setups where port 443 forwards to Rex but
            GraphQL lives on a dedicated port (:4443). `apiUrl()` reads
            this meta before falling back to its heuristic. */}
        {process.env.PUBLIC_API_ORIGIN && <meta name="api-origin" content={process.env.PUBLIC_API_ORIGIN} />}
        {/* SHOW_COCKTAILDB no longer injected here — RecipeImportPage fetches
            it from /api/settings-read so /settings overrides take effect
            without a server restart. */}
      </Head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `(function(){if(typeof localStorage==='undefined')return;try{var b=document.body,t=localStorage.getItem('theme-preference')||'system',hcStored=localStorage.getItem('high-contrast'),hc=hcStored!==null?hcStored==='true':matchMedia('(prefers-contrast:more)').matches,p=localStorage.getItem('theme-palette');if(!p){var m=document.querySelector('meta[name="default-palette"]');if(m)p=m.getAttribute('content')}if(t!=='system')b.dataset.colorScheme=t;if(hc)b.dataset.highContrast='';if(p&&p!=='default')b.dataset.theme=p;var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);b.style.colorScheme=dark?'dark':'light'}catch(e){}})()` }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
