import { describe, it, expect } from 'vitest';
import {
  SOURCE_CHANNELS,
  getChannel,
  isValidChannelKey,
  selectableChannels,
} from '@/lib/source-channels';

describe('source-channels', () => {
  it('exposes a non-empty seed list', () => {
    expect(SOURCE_CHANNELS.length).toBeGreaterThan(0);
  });

  it('has unique keys (the validator on the action relies on a Set lookup)', () => {
    const keys = SOURCE_CHANNELS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('always includes the public-form channel — every existing row defaults to it', () => {
    const formCh = SOURCE_CHANNELS.find((c) => c.key === 'form');
    expect(formCh).toBeDefined();
    expect(formCh?.label_ar.length).toBeGreaterThan(0);
    expect(formCh?.label_en.length).toBeGreaterThan(0);
  });

  it('every channel has both Arabic and English labels and a non-empty icon', () => {
    for (const ch of SOURCE_CHANNELS) {
      expect(ch.label_ar.trim().length).toBeGreaterThan(0);
      expect(ch.label_en.trim().length).toBeGreaterThan(0);
      expect(ch.icon.trim().length).toBeGreaterThan(0);
      expect(ch.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('getChannel returns the matching entry for a known key', () => {
    expect(getChannel('phone').key).toBe('phone');
    expect(getChannel('event').key).toBe('event');
  });

  it('getChannel falls back to "other" for an unknown key (defensive)', () => {
    // Cast through unknown — production code is type-safe, but this guard
    // protects against bad data in the column once the migration is live.
    const fallback = getChannel('not-a-channel' as unknown as 'phone');
    expect(fallback.key).toBe('other');
  });
});

describe('isValidChannelKey', () => {
  it('returns true for every key in SOURCE_CHANNELS', () => {
    for (const c of SOURCE_CHANNELS) {
      expect(isValidChannelKey(c.key)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isValidChannelKey('sms')).toBe(false);
    expect(isValidChannelKey('')).toBe(false);
    expect(isValidChannelKey('Phone')).toBe(false); // case-sensitive
  });

  it('narrows the input type when used as a guard', () => {
    const raw: string = 'phone';
    if (isValidChannelKey(raw)) {
      // Compile-time check: TypeScript should accept the narrowed type
      // as SourceChannelKey here. At runtime we only assert behaviour.
      expect(raw).toBe('phone');
    }
  });
});

describe('selectableChannels', () => {
  it('omits the public-form channel (operators never pick that for manual entry)', () => {
    const keys = selectableChannels().map((c) => c.key);
    expect(keys).not.toContain('form');
  });

  it('returns every other channel in the original SOURCE_CHANNELS order', () => {
    const expected = SOURCE_CHANNELS.filter((c) => c.key !== 'form').map((c) => c.key);
    expect(selectableChannels().map((c) => c.key)).toEqual(expected);
  });
});
