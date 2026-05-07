import { describe, it, expect } from 'vitest';
import { autoMap } from '@/lib/bulk-import/auto-map';

function rolesFor(headers: string[]) {
  const m = autoMap(headers);
  return Object.fromEntries(m.map((e) => [e.column, e.role]));
}

describe('autoMap — keyword detection', () => {
  it('detects standard English headers', () => {
    expect(rolesFor(['Name', 'Email', 'Phone', 'Category', 'Notes'])).toEqual({
      Name: 'name',
      Email: 'email',
      Phone: 'phone',
      Category: 'category',
      Notes: 'notes',
    });
  });

  it('detects Arabic headers', () => {
    expect(rolesFor(['الاسم', 'البريد', 'الهاتف', 'الفئة', 'ملاحظات'])).toEqual({
      'الاسم': 'name',
      'البريد': 'email',
      'الهاتف': 'phone',
      'الفئة': 'category',
      'ملاحظات': 'notes',
    });
  });

  it('matches case-insensitively and tolerates underscores/dashes/spaces', () => {
    expect(rolesFor(['Full_Name', 'E-MAIL', 'mobile number'])).toEqual({
      'Full_Name': 'name',
      'E-MAIL': 'email',
      'mobile number': 'phone',
    });
  });

  it('falls back to "custom" for unknown headers', () => {
    expect(rolesFor(['Random Column', 'إجابة الفئة'])).toEqual({
      'Random Column': 'custom',
      // 'الفئة' substring shows up here, so it'd match 'category' — which is
      // exactly the documented behaviour for substring keyword matching.
      'إجابة الفئة': 'category',
    });
  });

  it('demotes the second occurrence of a unique role to "custom"', () => {
    // Two columns both look like email — the wizard forces the user to pick
    // the right one rather than guessing. First wins.
    expect(rolesFor(['email', 'work email'])).toEqual({
      email: 'email',
      'work email': 'custom',
    });
  });

  it('does NOT demote duplicates of "custom" (multiple custom columns are allowed)', () => {
    const m = autoMap(['organization', 'role', 'website']);
    expect(m.every((e) => e.role === 'custom')).toBe(true);
  });

  it('returns a 1:1 mapping for every header (no entries dropped)', () => {
    const headers = ['name', 'email', 'phone', 'category', 'extra1', 'extra2'];
    const m = autoMap(headers);
    expect(m.map((e) => e.column)).toEqual(headers);
  });

  it('detects channel and referral by Arabic + English keywords', () => {
    expect(rolesFor(['channel', 'referral', 'القناة', 'إحالة'])).toEqual({
      channel: 'channel',
      referral: 'referral',
      'القناة': 'custom', // duplicate of channel demoted
      'إحالة': 'custom', // duplicate of referral demoted
    });
  });
});
