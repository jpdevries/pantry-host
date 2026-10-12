import { useEffect, useState } from 'react';
import { getThemePreference, type ThemePreference } from '@pantry-host/shared/theme';

const CHOICES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Marks the stored choice before React runs (or when it never does, e.g. the
// Kindle's Silk 80). ES5 only. Mirrors getThemePreference().
const MARK_CURRENT = `(function(){try{var t=localStorage.getItem('theme-preference')||'system',a=document.querySelectorAll('[data-theme-choice]');for(var i=0;i<a.length;i++){if(a[i].getAttribute('data-theme-choice')===t)a[i].setAttribute('aria-current','true');else a[i].removeAttribute('aria-current')}}catch(e){}})()`;

/**
 * Per-device preferences: saved in this browser's localStorage only, never on
 * the server, so they're available to guests too.
 *
 * The theme choices are plain links (`?theme=dark`) handled by the inline
 * theme bootstrap (@pantry-host/shared/theme-init), so they work in browsers
 * that can't run the app's JS. That matters on e-readers: the Kindle's Silk
 * browser doesn't support prefers-color-scheme at all, so following the
 * device's dark mode is impossible and the choice has to be made here.
 */
export default function DeviceSettings() {
  const [current, setCurrent] = useState<ThemePreference | null>(null);
  useEffect(() => { setCurrent(getThemePreference()); }, []);

  return (
    <section aria-labelledby="device-settings-heading" className="max-w-2xl mx-auto px-4 pt-10">
      <h2 id="device-settings-heading" className="text-xl font-bold mb-1">This device</h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Saved in this browser only. Not on the server, and not on your other devices.
      </p>
      <p id="device-theme-label" className="field-label">Theme</p>
      <ul role="list" aria-labelledby="device-theme-label" className="flex flex-wrap gap-2">
        {CHOICES.map((c) => (
          <li key={c.value}>
            <a
              href={`?theme=${c.value}`}
              data-theme-choice={c.value}
              aria-current={current === c.value ? 'true' : undefined}
              className={current === c.value ? 'btn-primary' : 'btn-secondary'}
            >
              {c.label}
            </a>
          </li>
        ))}
      </ul>
      <script dangerouslySetInnerHTML={{ __html: MARK_CURRENT }} />
    </section>
  );
}
