import { useState, useEffect } from 'react';
import { getThemePalette, getCurrentMode } from '@pantry-host/shared/theme';

/**
 * Returns video src paths that match the active theme palette and mode.
 * Reacts to palette/mode changes via footer controls and OS dark mode toggles.
 */
export function useThemeVideo(videoName: string) {
  const [prefix, setPrefix] = useState(() =>
    `${getThemePalette()}-${getCurrentMode()}`
  );

  useEffect(() => {
    function update() {
      setPrefix(`${getThemePalette()}-${getCurrentMode()}`);
    }

    // OS dark mode changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);

    // Footer palette/mode picker — observe body data attributes set by applyTheme()
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-color-scheme', 'data-theme'],
    });

    return () => {
      mq.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);

  return {
    webm: `/videos/${prefix}-${videoName}.webm`,
    mp4: `/videos/${prefix}-${videoName}.mp4`,
  };
}
