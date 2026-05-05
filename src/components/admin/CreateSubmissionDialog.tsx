'use client';

import { useMemo, useState } from 'react';
import type {
  FormCategoryRow,
  FormFieldRow,
  Lang,
  SourceChannelKey,
  StatusRow,
} from '@/types/database';
import type { SubmissionListRow } from '@/lib/admin-queries';
import { SOURCE_CHANNELS } from '@/lib/source-channels';
import { EMAIL_REGEX, parsePhoneSmart } from '@/lib/validation';
import { FieldRenderer } from '@/components/form/fields/FieldRenderer';
import { AdminPhoneInput } from './AdminPhoneInput';
import {
  DialogShell,
  DialogActions,
  DialogField,
  DialogInput,
  DialogSelect,
} from './DialogPrimitives';

type Props = {
  open: boolean;
  categories: FormCategoryRow[];
  fieldsByCategory: Record<string, FormFieldRow[]>;
  statuses: StatusRow[];
  onClose: () => void;
  onCreated: (row: SubmissionListRow) => void;
};

type FieldValue = string | string[] | undefined;

// FE-only stub. Builds a SubmissionListRow client-side and hands it to the
// parent for local merging. No DB write. The console-logged payload is the
// shape we'd want a real `createManualSubmission` server action to accept
// once the backend phase lands.
export function CreateSubmissionDialog({
  open,
  categories,
  fieldsByCategory,
  statuses,
  onClose,
  onCreated,
}: Props) {
  const [channel, setChannel] = useState<SourceChannelKey>('phone');
  const [referral, setReferral] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [language, setLanguage] = useState<Lang>('ar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<{
    name?: string;
    contact?: string;
    email?: string;
    phone?: string;
    category?: string;
  }>({});

  const customFields = useMemo<FormFieldRow[]>(() => {
    if (!categoryId) return [];
    // All custom fields are optional in manual entry — clone with is_required
    // forced to false so the existing FieldRenderer + validation treat them
    // as optional even when the form schema says otherwise.
    return (fieldsByCategory[categoryId] ?? [])
      .filter((f) => !['name', 'email', 'phone'].includes(f.semantic_role ?? ''))
      .map((f) => ({ ...f, is_required: false }));
  }, [categoryId, fieldsByCategory]);

  if (!open) return null;

  const reset = () => {
    setChannel('phone');
    setReferral('');
    setCategoryId('');
    setLanguage('ar');
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setCustomValues({});
    setErrors({});
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'الاسم مطلوب';
    if (!email.trim() && !phone.trim()) {
      next.contact = 'أدخل البريد أو رقم الهاتف على الأقل';
    } else {
      if (email.trim() && !EMAIL_REGEX.test(email.trim())) next.email = 'بريد غير صحيح';
      if (phone.trim()) {
        const r = parsePhoneSmart(phone.trim());
        if (!r.valid) next.phone = 'رقم هاتف غير صحيح';
      }
    }
    if (!categoryId) next.category = 'اختر الفئة';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSave = () => {
    if (!validate()) return;
    const category = categories.find((c) => c.id === categoryId);
    const status = statuses.find((s) => s.is_default) ?? statuses[0];
    if (!category || !status) return;

    const now = new Date().toISOString();
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2));
    const ref =
      'ITQ-MANUAL-' +
      Math.random().toString(36).slice(2, 5).toUpperCase();

    const phoneE164 = phone.trim() ? parsePhoneSmart(phone.trim()).e164 ?? phone.trim() : '';

    const row: SubmissionListRow = {
      id,
      reference_no: ref,
      category_id: category.id,
      language,
      status_id: status.id,
      assignee_id: null,
      submitter_name: name.trim(),
      submitter_email: email.trim(),
      newsletter_optin: false,
      created_at: now,
      updated_at: now,
      source: {
        channel,
        referral: referral.trim() ? referral.trim() : null,
      },
      category: { key: category.key, label_ar: category.label_ar, label_en: category.label_en },
      status: { key: status.key, label_ar: status.label_ar, label_en: status.label_en, color: status.color },
      assignee: null,
    };

    // Mirror the shape the eventual server action will consume.
    const answersPayload = customFields.map((f) => ({
      field_id: f.id,
      field_key: f.key,
      field_label: { ar: f.label_ar, en: f.label_en },
      value: customValues[f.id] ?? null,
      semantic_role: f.semantic_role,
    }));

    // eslint-disable-next-line no-console
    console.log('[manual submission — FE only, no DB write]', {
      submission: {
        category_id: category.id,
        language,
        submitter_name: name.trim(),
        submitter_email: email.trim(),
        submitter_phone: phoneE164 || null,
        source: row.source,
        notes: notes.trim() || null,
      },
      answers: answersPayload,
    });

    onCreated(row);
    reset();
  };

  return (
    <DialogShell onClose={() => { reset(); onClose(); }}>
      <h3 className="text-[16px] font-semibold mb-1">طلب يدوي</h3>
      <p className="text-[12.5px] mb-4" style={{ color: 'var(--muted)' }}>
        محلي فقط — لن يُحفظ في قاعدة البيانات بعد.
      </p>

      <div className="space-y-3 text-[13px]">
        <DialogField label="القناة">
          <DialogSelect<SourceChannelKey>
            value={channel}
            onChange={setChannel}
            options={SOURCE_CHANNELS.filter((c) => c.key !== 'form').map((c) => ({
              value: c.key,
              label: `${c.icon}  ${c.label_ar}`,
            }))}
          />
        </DialogField>

        <DialogField label="ملاحظة المصدر (اختياري)">
          <DialogInput
            value={referral}
            onChange={setReferral}
            placeholder="مثال: لقاء في معرض LEAP 2026"
          />
        </DialogField>

        <DialogField label="الفئة *">
          <DialogSelect<string>
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: '', label: '— اختر الفئة —' },
              ...categories.map((c) => ({ value: c.id, label: c.label_ar })),
            ]}
          />
          {errors.category && <ErrText>{errors.category}</ErrText>}
        </DialogField>

        <DialogField label="اللغة">
          <div className="flex gap-4 text-[13px]">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={language === 'ar'}
                onChange={() => setLanguage('ar')}
              />
              العربية
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="radio"
                checked={language === 'en'}
                onChange={() => setLanguage('en')}
              />
              الإنجليزية
            </label>
          </div>
        </DialogField>

        <div className="border-t pt-3" style={{ borderColor: 'var(--rule-soft)' }}>
          <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>
            معلومات التواصل
          </div>
          <div className="space-y-2">
            <DialogField label="الاسم *">
              <DialogInput value={name} onChange={setName} />
              {errors.name && <ErrText>{errors.name}</ErrText>}
            </DialogField>
            <DialogField label="البريد">
              <DialogInput value={email} onChange={setEmail} dir="ltr" />
              {errors.email && <ErrText>{errors.email}</ErrText>}
            </DialogField>
            <DialogField label="الهاتف">
              <AdminPhoneInput value={phone} onChange={setPhone} />
              {errors.phone && <ErrText>{errors.phone}</ErrText>}
            </DialogField>
            {errors.contact && <ErrText>{errors.contact}</ErrText>}
          </div>
        </div>

        <DialogField label="ملاحظات إضافية (اختياري)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="أي تفاصيل أو سياق يفيد الفريق…"
            className="w-full px-3 py-2 rounded-lg border bg-transparent outline-none text-[13.5px] resize-y leading-6"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg)' }}
          />
        </DialogField>

        {customFields.length > 0 && (
          <div className="border-t pt-3" style={{ borderColor: 'var(--rule-soft)' }}>
            <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>
              حقول الفئة (اختيارية)
            </div>
            <div className="space-y-3">
              {customFields.map((f) => (
                <div key={f.id}>
                  <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>
                    {language === 'en' ? f.label_en : f.label_ar}
                  </div>
                  <FieldRenderer
                    field={f}
                    value={customValues[f.id]}
                    onChange={(v) => setCustomValues((prev) => ({ ...prev, [f.id]: v }))}
                    lang={language}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogActions
        onCancel={() => { reset(); onClose(); }}
        onSave={onSave}
        saveLabel="إضافة"
        cancelLabel="إلغاء"
      />
    </DialogShell>
  );
}

function ErrText({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] mt-1" style={{ color: 'var(--danger)' }}>
      {children}
    </div>
  );
}
