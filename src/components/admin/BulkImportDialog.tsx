'use client';

import { useMemo, useState } from 'react';
import type { FormCategoryRow, SourceChannelKey } from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { autoMap } from '@/lib/bulk-import/auto-map';
import { parseFile, MAX_IMPORT_ROWS } from '@/lib/bulk-import/parse-file';
import {
  validateRows,
  buildDuplicateIndex,
} from '@/lib/bulk-import/validate-row';
import type {
  ColumnMapping,
  ColumnRole,
  ParsedFile,
  ValidatedRow,
} from '@/lib/bulk-import/types';
import { DialogShell } from './DialogPrimitives';
import { UploadStep } from './bulk-import-steps/UploadStep';
import { MapStep } from './bulk-import-steps/MapStep';
import { PreviewStep } from './bulk-import-steps/PreviewStep';
import { DoneStep } from './bulk-import-steps/DoneStep';
import { StepDots, type WizardStep } from './bulk-import-steps/StepDots';
import { UNIQUE_ROLES, ROLE_LABEL_AR } from './bulk-import-steps/role-labels';

type Props = {
  categories: FormCategoryRow[];
  existingRows: SubmissionListRow[];
  onClose: () => void;
  onCreated: (count: number) => void;
};

const PARSE_ERRORS_AR: Record<string, string> = {
  unsupported_format: 'صيغة الملف غير مدعومة. اختر CSV أو Excel.',
  empty_file: 'الملف فارغ.',
  no_headers: 'الصف الأول يجب أن يحتوي أسماء الأعمدة.',
  empty_header_column:
    'صف العناوين يحتوي عمودًا فارغًا في الوسط. أزل العمود أو أكمل عنوانه ثم حاول مجددًا.',
  no_data_rows: 'لا توجد بيانات بعد صف العناوين.',
  too_many_rows: `تجاوزت الحد الأقصى للسطور (${MAX_IMPORT_ROWS}).`,
};

const STEP_TITLE: Record<WizardStep, string> = {
  upload: 'استيراد ملف — اختيار الملف',
  map: 'استيراد ملف — ربط الأعمدة',
  preview: 'استيراد ملف — معاينة وتحقق',
  done: 'تمت العملية',
};

// Mounting: parent renders this only when the wizard should be open. We
// never accept an `open` prop and never early-return null. That keeps
// every hook unconditional (Rules of Hooks) and lets unmount-on-close
// be the natural reset mechanism. Each step lives in its own file under
// bulk-import-steps/; this component is the state machine that drives
// them.
export function BulkImportDialog({
  categories,
  existingRows,
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [defaultChannel, setDefaultChannel] = useState<SourceChannelKey>('referral');
  const [defaultReferral, setDefaultReferral] = useState<string>('');

  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [skipInvalidConfirmed, setSkipInvalidConfirmed] = useState(false);
  const [submittedSummary, setSubmittedSummary] =
    useState<{ ok: number; skipped: number } | null>(null);

  // ---------- Upload ----------

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    setParsing(true);
    try {
      const result = await parseFile(file);
      setParsed(result);
      setMapping(autoMap(result.headers));
      setStep('map');
    } catch (err) {
      const code = err instanceof Error ? err.message.split(':')[0] : 'parse_failed';
      setParseError(PARSE_ERRORS_AR[code] ?? 'تعذّر قراءة الملف.');
    } finally {
      setParsing(false);
    }
  };

  // ---------- Mapping ----------

  const setMappingFor = (column: string, role: ColumnRole) => {
    setMapping((prev) =>
      prev.map((m) => (m.column === column ? { ...m, role } : m)),
    );
  };

  const mappingErrors = useMemo(() => {
    const errs: string[] = [];
    const roleCounts = new Map<ColumnRole, number>();
    for (const m of mapping) {
      if (UNIQUE_ROLES.includes(m.role)) {
        roleCounts.set(m.role, (roleCounts.get(m.role) ?? 0) + 1);
      }
    }
    for (const [role, count] of roleCounts) {
      if (count > 1) errs.push(`عمود "${ROLE_LABEL_AR[role]}" مستخدم أكثر من مرة.`);
    }
    if (!Array.from(roleCounts.keys()).includes('name')) errs.push('يجب ربط عمود الاسم.');
    if (!Array.from(roleCounts.keys()).includes('category')) errs.push('يجب ربط عمود الفئة.');
    return errs;
  }, [mapping]);

  // ---------- Preview / validation ----------

  // Lifted out of the `validatedRows` memo: the dup-index only depends on
  // the server-provided list, so we don't want to rebuild it every time
  // the operator types into the referral text field below.
  const duplicateIndex = useMemo(
    () => buildDuplicateIndex(existingRows),
    [existingRows],
  );

  const validatedRows = useMemo<ValidatedRow[]>(() => {
    if (!parsed) return [];
    if (mappingErrors.length > 0) return [];
    return validateRows(parsed, mapping, {
      defaultChannel,
      defaultReferral: defaultReferral.trim() || null,
      categories,
      duplicateIndex,
    });
  }, [parsed, mapping, mappingErrors, defaultChannel, defaultReferral, categories, duplicateIndex]);

  const counts = useMemo(() => {
    let ok = 0, warning = 0, error = 0;
    for (const r of validatedRows) {
      if (r.status === 'ok') ok += 1;
      else if (r.status === 'warning') warning += 1;
      else error += 1;
    }
    return { ok, warning, error, total: validatedRows.length };
  }, [validatedRows]);

  const visibleRows = showOnlyIssues
    ? validatedRows.filter((r) => r.status !== 'ok')
    : validatedRows;

  const canSubmit = counts.total > 0 && (counts.error === 0 || skipInvalidConfirmed);

  // ---------- Submit (FE-only stub) ----------

  const onSubmit = () => {
    const accepted = validatedRows.filter((r) => r.status !== 'error');
    const skipped = counts.error;
    // PII (name/email/phone) must never reach a production console — even
    // for admin-only flows it widens the privacy/compliance surface
    // (CodeRabbit-flagged). Dev gets the full payload for shape verification.
    if (process.env.NODE_ENV !== 'production') {
      console.log('[bulk import — FE only, no DB write]', {
        filename: parsed?.filename,
        defaultChannel,
        defaultReferral: defaultReferral.trim() || null,
        mapping,
        accepted_rows: accepted.map((r) => r.values),
        skipped_count: skipped,
      });
    }
    setSubmittedSummary({ ok: accepted.length, skipped });
    setStep('done');
    onCreated(accepted.length);
  };

  // ---------- Render ----------

  return (
    <DialogShell onClose={onClose} size="wide">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold">{STEP_TITLE[step]}</h3>
        <StepDots step={step} />
      </div>

      {step === 'upload' && (
        <UploadStep
          parsing={parsing}
          parseError={parseError}
          onPickFile={onPickFile}
        />
      )}

      {step === 'map' && parsed && (
        <MapStep
          parsed={parsed}
          mapping={mapping}
          onChangeMapping={setMappingFor}
          defaultChannel={defaultChannel}
          onChangeChannel={setDefaultChannel}
          defaultReferral={defaultReferral}
          onChangeReferral={setDefaultReferral}
          mappingErrors={mappingErrors}
          onBack={() => setStep('upload')}
          onNext={() => setStep('preview')}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          parsed={parsed}
          rows={visibleRows}
          counts={counts}
          showOnlyIssues={showOnlyIssues}
          onToggleShowOnlyIssues={() => setShowOnlyIssues((v) => !v)}
          skipInvalidConfirmed={skipInvalidConfirmed}
          onToggleSkipInvalid={() => setSkipInvalidConfirmed((v) => !v)}
          canSubmit={canSubmit}
          onBack={() => setStep('map')}
          onSubmit={onSubmit}
        />
      )}

      {step === 'done' && submittedSummary && (
        <DoneStep summary={submittedSummary} onClose={onClose} />
      )}
    </DialogShell>
  );
}
