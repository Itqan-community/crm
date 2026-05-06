'use client';

import { useMemo, useState } from 'react';
import type {
  FormCategoryRow,
  SourceChannelKey,
} from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { selectableChannels } from '@/lib/source-channels';
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
import { Tag } from './Tag';

type Step = 'upload' | 'map' | 'preview' | 'done';

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
  no_data_rows: 'لا توجد بيانات بعد صف العناوين.',
  too_many_rows: `تجاوزت الحد الأقصى للسطور (${MAX_IMPORT_ROWS}).`,
};

const ROLE_LABEL_AR: Record<ColumnRole, string> = {
  name: 'الاسم',
  email: 'البريد',
  phone: 'الهاتف',
  category: 'الفئة',
  language: 'اللغة',
  channel: 'القناة',
  referral: 'ملاحظة المصدر',
  notes: 'ملاحظات داخلية',
  custom: 'حقل إضافي',
  ignore: 'تجاهل',
};

const ROLE_OPTIONS: ColumnRole[] = [
  'ignore',
  'name',
  'email',
  'phone',
  'category',
  'language',
  'channel',
  'referral',
  'notes',
  'custom',
];

const UNIQUE_ROLES: ColumnRole[] = [
  'name', 'email', 'phone', 'category', 'language', 'channel', 'referral', 'notes',
];

// Mounting: parent renders this only when the wizard should be open. We
// never accept an `open` prop and never early-return null. That keeps all
// hooks unconditional (Rules of Hooks) and lets unmount-on-close be the
// natural reset mechanism — no manual setStep/setParsed/etc. cleanup.
export function BulkImportDialog({
  categories,
  existingRows,
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [defaultChannel, setDefaultChannel] = useState<SourceChannelKey>('referral');
  const [defaultReferral, setDefaultReferral] = useState<string>('');

  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [skipInvalidConfirmed, setSkipInvalidConfirmed] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<{ ok: number; skipped: number } | null>(null);

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
    console.log('[bulk import — FE only, no DB write]', {
      filename: parsed?.filename,
      defaultChannel,
      defaultReferral: defaultReferral.trim() || null,
      mapping,
      accepted_rows: accepted.map((r) => r.values),
      skipped_count: skipped,
    });
    setSubmittedSummary({ ok: accepted.length, skipped });
    setStep('done');
    onCreated(accepted.length);
  };

  // ---------- Render ----------

  const stepTitle: Record<Step, string> = {
    upload: 'استيراد ملف — اختيار الملف',
    map: 'استيراد ملف — ربط الأعمدة',
    preview: 'استيراد ملف — معاينة وتحقق',
    done: 'تمت العملية',
  };

  return (
    <DialogShell onClose={onClose} size="wide">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold">{stepTitle[step]}</h3>
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

// ---------- Step subcomponents ----------

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ['upload', 'map', 'preview', 'done'];
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-1.5">
      {order.map((s, i) => (
        <span
          key={s}
          className="w-2 h-2 rounded-full"
          style={{
            background: i <= idx ? 'var(--accent)' : 'var(--rule)',
          }}
        />
      ))}
    </div>
  );
}

function UploadStep({
  parsing,
  parseError,
  onPickFile,
}: {
  parsing: boolean;
  parseError: string | null;
  onPickFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <p className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
        اختر ملف CSV أو Excel. الصف الأول يجب أن يحتوي أسماء الأعمدة. حد الأسطر:{' '}
        {MAX_IMPORT_ROWS}.
      </p>
      <div
        className="rounded-xl border-2 border-dashed p-8 text-center"
        style={{ borderColor: 'var(--rule)' }}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={onPickFile}
          className="hidden"
          id="bulk-import-file-input"
        />
        <label
          htmlFor="bulk-import-file-input"
          className="inline-block px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          {parsing ? 'جارٍ القراءة…' : 'اختر ملفًا'}
        </label>
        <div className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>
          الصيغ المدعومة: .csv, .xlsx
        </div>
      </div>
      {parseError && (
        <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>
          {parseError}
        </div>
      )}
    </div>
  );
}

function MapStep({
  parsed,
  mapping,
  onChangeMapping,
  defaultChannel,
  onChangeChannel,
  defaultReferral,
  onChangeReferral,
  mappingErrors,
  onBack,
  onNext,
}: {
  parsed: ParsedFile;
  mapping: ColumnMapping[];
  onChangeMapping: (column: string, role: ColumnRole) => void;
  defaultChannel: SourceChannelKey;
  onChangeChannel: (v: SourceChannelKey) => void;
  defaultReferral: string;
  onChangeReferral: (v: string) => void;
  mappingErrors: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4 text-[13px]">
      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
        الملف: <span style={{ color: 'var(--fg)' }}>{parsed.filename}</span> · {parsed.rows.length}{' '}
        سطر
      </div>

      <div className="grid grid-cols-2 gap-3 pb-3 border-b" style={{ borderColor: 'var(--rule-soft)' }}>
        <div>
          <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>
            القناة الافتراضية
          </div>
          <select
            value={defaultChannel}
            onChange={(e) => onChangeChannel(e.target.value as SourceChannelKey)}
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          >
            {selectableChannels().map((c) => (
              <option key={c.key} value={c.key}>
                {c.icon}  {c.label_ar}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>
            ملاحظة المصدر الافتراضية (اختياري)
          </div>
          <input
            value={defaultReferral}
            onChange={(e) => onChangeReferral(e.target.value)}
            placeholder="مثال: ملف من شريك سابق"
            className="w-full px-3 py-2 rounded-lg border bg-transparent text-[13.5px]"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          />
        </div>
      </div>

      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
        ربط أعمدة الملف بدور كل عمود. الأعمدة غير المعرّفة تُحفظ كحقول إضافية لكل سطر بحسب فئته.
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--rule)' }}>
        <table className="w-full text-[13px]">
          <thead style={{ background: 'var(--option-bg-selected)', color: 'var(--muted)' }}>
            <tr>
              <th className="text-start px-3 py-2 font-medium">العمود في الملف</th>
              <th className="text-start px-3 py-2 font-medium">الدور</th>
              <th className="text-start px-3 py-2 font-medium">عيّنة</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m) => {
              const sample = parsed.rows[0]?.[m.column] ?? '';
              return (
                <tr key={m.column} className="border-t" style={{ borderColor: 'var(--rule-soft)' }}>
                  <td className="px-3 py-2 font-medium">{m.column}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.role}
                      onChange={(e) => onChangeMapping(m.column, e.target.value as ColumnRole)}
                      className="px-2 py-1 rounded border bg-transparent text-[13px]"
                      style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL_AR[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 truncate max-w-[200px]" style={{ color: 'var(--muted)' }}>
                    {sample || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mappingErrors.length > 0 && (
        <ul className="text-[12px] space-y-1" style={{ color: 'var(--danger)' }}>
          {mappingErrors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          → الرجوع
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={mappingErrors.length > 0}
          className="px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          متابعة للمعاينة ←
        </button>
      </div>
    </div>
  );
}

function PreviewStep({
  parsed,
  rows,
  counts,
  showOnlyIssues,
  onToggleShowOnlyIssues,
  skipInvalidConfirmed,
  onToggleSkipInvalid,
  canSubmit,
  onBack,
  onSubmit,
}: {
  parsed: ParsedFile | null;
  rows: ValidatedRow[];
  counts: { ok: number; warning: number; error: number; total: number };
  showOnlyIssues: boolean;
  onToggleShowOnlyIssues: () => void;
  skipInvalidConfirmed: boolean;
  onToggleSkipInvalid: () => void;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-3 pb-2 border-b" style={{ borderColor: 'var(--rule-soft)' }}>
        <Pill color="#16A34A" label={`جاهز ${counts.ok}`} />
        <Pill color="#D97706" label={`تنبيهات ${counts.warning}`} />
        <Pill color="#DC2626" label={`أخطاء ${counts.error}`} />
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
          الإجمالي: {counts.total}
        </span>
        <label className="ms-auto inline-flex items-center gap-1.5 text-[12.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyIssues}
            onChange={onToggleShowOnlyIssues}
          />
          إظهار المشكلات فقط
        </label>
      </div>

      <div
        className="border rounded-lg overflow-auto max-h-[420px]"
        style={{ borderColor: 'var(--rule)' }}
      >
        <table className="w-full text-[12.5px]">
          <thead style={{ background: 'var(--option-bg-selected)', color: 'var(--muted)' }}>
            <tr>
              <th className="px-2 py-2 text-start font-medium w-10">#</th>
              <th className="px-2 py-2 text-start font-medium w-24">الحالة</th>
              <th className="px-2 py-2 text-start font-medium">الاسم</th>
              <th className="px-2 py-2 text-start font-medium">البريد</th>
              <th className="px-2 py-2 text-start font-medium">الهاتف</th>
              <th className="px-2 py-2 text-start font-medium">الفئة</th>
              <th className="px-2 py-2 text-start font-medium">المصدر</th>
              <th className="px-2 py-2 text-start font-medium">رسائل</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center" style={{ color: 'var(--muted)' }}>
                  {showOnlyIssues ? 'لا مشكلات.' : 'لا توجد سطور.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.rowIndex} className="border-t" style={{ borderColor: 'var(--rule-soft)' }}>
                <td className="px-2 py-1.5 font-mono" style={{ color: 'var(--muted)' }}>
                  {r.rowIndex}
                </td>
                <td className="px-2 py-1.5">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-2 py-1.5">{r.values.name || '—'}</td>
                <td className="px-2 py-1.5" dir="ltr">{r.values.email || '—'}</td>
                <td className="px-2 py-1.5" dir="ltr">{r.values.phone || '—'}</td>
                <td className="px-2 py-1.5">{r.values.category_key || '—'}</td>
                <td className="px-2 py-1.5">{r.values.channel}</td>
                <td className="px-2 py-1.5" style={{ color: 'var(--muted)' }}>
                  <ul className="space-y-0.5">
                    {r.errors.map((e) => (
                      <li key={`e-${e}`} style={{ color: 'var(--danger)' }}>• {e}</li>
                    ))}
                    {r.warnings.map((w) => (
                      <li key={`w-${w}`} style={{ color: '#D97706' }}>• {w}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {counts.error > 0 && (
        <label className="inline-flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={skipInvalidConfirmed} onChange={onToggleSkipInvalid} />
          تخطّي السطور الخاطئة وأكمل بـ{counts.ok + counts.warning} سطر
        </label>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-1.5 rounded-lg border text-[13px]"
          style={{ borderColor: 'var(--rule)' }}
        >
          → الرجوع للربط
        </button>
        <div className="flex gap-2 items-center">
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>
            {parsed?.filename}
          </span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-4 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
          >
            استيراد {counts.error === 0 ? counts.ok + counts.warning : counts.ok + counts.warning} سطر
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneStep({
  summary,
  onClose,
}: {
  summary: { ok: number; skipped: number };
  onClose: () => void;
}) {
  return (
    <div className="space-y-4 text-[13.5px]">
      <p>
        تم الاستيراد محليًا — لم يُحفظ في قاعدة البيانات بعد. payload في console للمراجعة.
      </p>
      <ul className="space-y-1">
        <li>• تم قبول {summary.ok} سطر.</li>
        {summary.skipped > 0 && <li>• تم تخطّي {summary.skipped} سطر بسبب أخطاء.</li>}
      </ul>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}

// Per-row status (ok | warning | error). Slightly smaller text than a
// regular Tag because the preview table is dense.
function StatusBadge({ status }: { status: ValidatedRow['status'] }) {
  const map: Record<ValidatedRow['status'], { label: string; color: string }> = {
    ok: { label: 'جاهز', color: '#16A34A' },
    warning: { label: 'تنبيه', color: '#D97706' },
    error: { label: 'خطأ', color: '#DC2626' },
  };
  const { label, color } = map[status];
  return <Tag color={color} className="text-[11.5px]">{label}</Tag>;
}

// Counter pill in the preview header (e.g. "جاهز 38").
function Pill({ color, label }: { color: string; label: string }) {
  return <Tag color={color}>{label}</Tag>;
}
