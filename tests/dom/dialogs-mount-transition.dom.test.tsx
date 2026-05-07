// @vitest-environment jsdom

/**
 * Catches the foot-gun that took down /admin twice already:
 * a dialog component with conditional `if (!open) return null` and
 * additional hooks below it. The render-transition from closed → open
 * triggers a Rules-of-Hooks invariant ("rendered more hooks than during
 * the previous render") and the component throws.
 *
 * Each test mounts the parent in the `closed` state, then flips it to
 * `open`. If the dialog throws, RTL surfaces the error and the test
 * fails. ESLint catches this rule statically too — this is the runtime
 * second layer.
 */

import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { CreateSubmissionDialog } from '@/components/admin/CreateSubmissionDialog';
import { BulkImportDialog } from '@/components/admin/BulkImportDialog';
import type { FormCategoryRow } from '@/types/database';

// Server-action import lives in the dialog file; stub it so the render
// has nothing to do with the network.
vi.mock('@/lib/admin-actions', () => ({
  createManualSubmission: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const CATEGORIES: FormCategoryRow[] = [
  {
    id: 'cat-1',
    key: 'app',
    label_ar: 'تطبيق',
    label_en: 'App',
    hint_ar: null,
    hint_en: null,
    icon: null,
    position: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
  },
];

afterEach(() => {
  cleanup();
});

function ManualHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <CreateSubmissionDialog
          categories={CATEGORIES}
          fieldsByCategory={{ 'cat-1': [] }}
          onClose={() => setOpen(false)}
          onCreated={() => setOpen(false)}
        />
      )}
    </>
  );
}

function BulkHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <BulkImportDialog
          categories={CATEGORIES}
          existingRows={[]}
          onClose={() => setOpen(false)}
          onCreated={() => setOpen(false)}
        />
      )}
    </>
  );
}

describe('CreateSubmissionDialog mount transition', () => {
  it('mounts without throwing when the parent flips open from false to true', () => {
    render(<ManualHarness />);
    expect(screen.queryByText('طلب يدوي')).toBeNull();
    fireEvent.click(screen.getByText('open'));
    // Dialog title is the canary that the dialog actually rendered.
    expect(screen.getByText('طلب يدوي')).toBeTruthy();
  });
});

describe('BulkImportDialog mount transition', () => {
  it('mounts without throwing when the parent flips open from false to true', () => {
    render(<BulkHarness />);
    expect(screen.queryByText(/استيراد ملف — اختيار/)).toBeNull();
    fireEvent.click(screen.getByText('open'));
    // Step title for the upload step appears once the dialog is open.
    expect(screen.getByText(/استيراد ملف — اختيار/)).toBeTruthy();
  });
});
