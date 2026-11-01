/**
 * `<time>` for pantry dates, one way in both tiers.
 *
 * People read a relative phrase ("20 days ago") or a short date
 * ("8 Nov 2026"); the `datetime` attribute carries the ISO value for
 * assistive tech, reader modes and anything that parses the page, and the
 * tooltip gives the absolute date behind a relative phrase. No `Intl`, so
 * it's safe in Rex's ICU-free server render (CLAUDE.md gotcha 16).
 */

import { formatDate, isoDate, isoDays, parseIso, pluralDays, relativeDays } from '../relative-time';

interface RelativeTimeProps {
  /** ISO 8601 date or date-time. */
  iso: string;
  /** "relative" (default): "20 days ago" with the absolute date as tooltip.
   *  "date": "8 Nov 2026". */
  mode?: 'relative' | 'date';
  /** Clock for the relative phrase; defaults to now. Pass a fixed value
   *  when the surrounding render must be deterministic. */
  now?: number;
  className?: string;
}

export default function RelativeTime({ iso, mode = 'relative', now, className }: RelativeTimeProps) {
  const t = parseIso(iso);
  if (t == null) return <>{iso}</>;
  const absolute = formatDate(iso);
  if (mode === 'date') {
    return <time dateTime={isoDate(iso)} className={className}>{absolute}</time>;
  }
  const phrase = relativeDays(iso, now) ?? absolute;
  return (
    <time dateTime={new Date(t).toISOString()} title={absolute} className={className}>
      {phrase}
    </time>
  );
}

/** A number of days as a `<time>` duration: `<time datetime="P14D">14 days</time>`. */
export function Duration({ days, className }: { days: number; className?: string }) {
  return <time dateTime={isoDays(days)} className={className}>{pluralDays(days)}</time>;
}
