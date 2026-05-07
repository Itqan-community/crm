// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Tag } from '@/components/admin/Tag';

afterEach(() => {
  cleanup();
});

describe('Tag — tinted-pill primitive', () => {
  it('renders children inside the pill', () => {
    render(<Tag color="#16A34A">جاهز</Tag>);
    expect(screen.getByText('جاهز')).toBeTruthy();
  });

  it('applies the color to text, plus a tinted border and background', () => {
    // jsdom normalises hex-with-alpha (#16A34A40) to rgba(...), so we just
    // assert that the same RGB triple drives all three properties (text,
    // border, background) and that border + background are translucent.
    render(<Tag color="#16A34A">label</Tag>);
    const el = screen.getByText('label') as HTMLElement;
    const RGB = 'rgb(22, 163, 74)';
    expect(el.style.color).toBe(RGB);
    expect(el.style.borderColor).toMatch(/^rgba\(22, 163, 74, /);
    expect(el.style.background).toMatch(/^rgba\(22, 163, 74, /);
    // Sanity: border is more opaque than background (40 vs 14 in hex).
    const borderAlpha = parseFloat(el.style.borderColor.match(/, ([\d.]+)\)/)![1]);
    const bgAlpha = parseFloat(el.style.background.match(/, ([\d.]+)\)/)![1]);
    expect(borderAlpha).toBeGreaterThan(bgAlpha);
  });

  it('exposes the title prop as the native HTML title for tooltips', () => {
    render(
      <Tag color="#000" title="Phone · LEAP 2026">
        x
      </Tag>,
    );
    expect(screen.getByText('x').getAttribute('title')).toBe('Phone · LEAP 2026');
  });

  it('appends `className` for one-off tweaks (e.g., smaller text)', () => {
    render(
      <Tag color="#000" className="text-[11.5px]">
        small
      </Tag>,
    );
    const el = screen.getByText('small');
    expect(el.className).toMatch(/text-\[11\.5px\]/);
    // Default classes still present.
    expect(el.className).toMatch(/inline-flex/);
    expect(el.className).toMatch(/rounded-md/);
  });
});
