import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { daysUntil, formatDate, isoDate, isoDays, relativeDays } from './relative-time';

const NOW = new Date('2026-11-01T12:00:00.000Z').getTime();

describe('relative-time', () => {
  it('counts calendar days, not 24-hour spans', () => {
    assert.equal(daysUntil('2026-11-01T23:59:00.000Z', NOW), 0);
    assert.equal(daysUntil('2026-10-31T23:59:00.000Z', NOW), -1);
    assert.equal(daysUntil('2026-11-02T00:01:00.000Z', NOW), 1);
    assert.equal(daysUntil('2026-11-10', NOW), 9);
  });

  it('phrases the common cases and falls back to counts', () => {
    assert.equal(relativeDays('2026-11-01T08:00:00.000Z', NOW), 'today');
    assert.equal(relativeDays('2026-10-31', NOW), 'yesterday');
    assert.equal(relativeDays('2026-11-02', NOW), 'tomorrow');
    assert.equal(relativeDays('2026-10-12T17:11:58.000Z', NOW), '20 days ago');
    assert.equal(relativeDays('2026-11-15', NOW), 'in 14 days');
    assert.equal(relativeDays('not a date', NOW), null);
  });

  it('formats absolute dates and datetime values without Intl', () => {
    assert.equal(formatDate('2026-11-08'), '8 Nov 2026');
    assert.equal(formatDate('2026-04-15T17:11:58.000Z'), '15 Apr 2026');
    assert.equal(isoDate('2026-04-15T17:11:58.000Z'), '2026-04-15');
    assert.equal(formatDate('garbage'), 'garbage');
    assert.equal(isoDays(14), 'P14D');
  });
});
