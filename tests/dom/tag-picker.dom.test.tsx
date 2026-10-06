// @vitest-environment jsdom

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TagPicker } from '@/components/admin/TagPicker';
import { setSubmissionTags } from '@/lib/admin-actions';
import type { TagGroupRow, TagRow } from '@/types/database';

vi.mock('@/lib/admin-actions', () => ({
  setSubmissionTags: vi.fn(async () => {}),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const GROUPS: TagGroupRow[] = [
  {
    key: 'general', label_ar: 'تصنيفات عامة', label_en: 'General tags',
    position: 0, is_active: true, created_at: '', updated_at: '',
  },
  {
    key: 'availability', label_ar: 'أوقات التطوع', label_en: 'Availability',
    position: 10, is_active: true, created_at: '', updated_at: '',
  },
];

const TAGS: TagRow[] = [
  {
    id: 't-dev', key: 'developer', label_ar: 'مطور', label_en: 'Developer',
    kind: 'general', color: '#2563EB', position: 10, is_active: true,
    created_at: '', updated_at: '',
  },
  {
    id: 't-morn', key: 'avail_morning', label_ar: 'صباحًا', label_en: 'Mornings',
    kind: 'availability', color: '#0891B2', position: 10, is_active: true,
    created_at: '', updated_at: '',
  },
];

// A label can appear twice — once on the trigger chip, once as a dropdown
// option. Options are the buttons carrying aria-pressed; pick those only.
function findOption(label: string): HTMLButtonElement {
  const el = screen
    .getAllByText(label)
    .map((n) => n.closest('button'))
    .find((b): b is HTMLButtonElement => !!b && b.hasAttribute('aria-pressed'));
  if (!el) throw new Error(`option not found: ${label}`);
  return el;
}

function renderPicker(current: string[] = []) {
  return render(
    <TagPicker submissionId="sub-1" currentTagIds={current} tags={TAGS} groups={GROUPS} />,
  );
}

describe('TagPicker — multi-select chips dropdown', () => {
  it('shows selected tag chips on the closed trigger button', () => {
    renderPicker(['t-dev']);
    expect(screen.getAllByText('مطور').length).toBeGreaterThan(0);
  });

  it('shows a muted placeholder when nothing is selected', () => {
    renderPicker();
    expect(screen.getByText('تصنيفات')).toBeTruthy();
  });

  it('groups options by kind when opened', () => {
    renderPicker();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('تصنيفات عامة')).toBeTruthy();
    expect(screen.getByText('أوقات التطوع')).toBeTruthy();
    expect(screen.getByText('صباحًا')).toBeTruthy();
  });

  it('toggling an unselected tag calls setSubmissionTags with it added', () => {
    renderPicker(['t-dev']);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(findOption('صباحًا'));

    expect(setSubmissionTags).toHaveBeenCalledWith('sub-1', ['t-dev', 't-morn']);
  });

  it('toggling a selected tag calls setSubmissionTags with it removed', () => {
    renderPicker(['t-dev', 't-morn']);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(findOption('صباحًا'));

    expect(setSubmissionTags).toHaveBeenCalledWith('sub-1', ['t-dev']);
  });

  it('marks selected options as pressed', () => {
    renderPicker(['t-dev']);
    fireEvent.click(screen.getByRole('button'));
    expect(findOption('مطور').getAttribute('aria-pressed')).toBe('true');
    expect(findOption('صباحًا').getAttribute('aria-pressed')).toBe('false');
  });
});
