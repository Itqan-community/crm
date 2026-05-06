'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  FormCategoryRow,
  FormFieldRow,
  Lang,
  SourceChannelKey,
} from '@/types/database';
import { SOURCE_CHANNELS } from '@/lib/source-channels';
import { EMAIL_REGEX, parsePhoneSmart } from '@/lib/validation';
import { createManualSubmission } from '@/lib/admin-actions';
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
  categories: FormCategoryRow[];
  fieldsByCategory: Record<string, FormFieldRow[]>;
  onClose: () => void;
  onCreated: (refNo: string) => void;
};

type FieldValue = string | string[] | undefined;

const SERVER_ERRORS_AR: Record<string, string> = {
  name_required: 'الاسم مطلوب',
  contact_required: 'أدخل البريد أو رقم الهاتف على الأقل',
  invalid_email: 'بريد غير صحيح',
  invalid_phone: 'رقم هاتف غير صحيح',
  invalid_channel: 'قناة المصدر غير صحيحة',
  unknown_category: 'الفئة غير معروفة',
  unauthenticated: 'يلزم تسجيل الدخول',
  forbidden: 'لا تملك صلاحية الإنشاء',
  migration_required:
    'لم يتم تفعيل خاصية المصدر على قاعدة البيانات بعد. شغّل migration 0011 ثم أعد المحاولة.',
};

function translateError(msg: string): string {
  return SERVER_ERRORS_AR[msg] ?? `تعذّر حفظ الطلب: ${msg}`;
}

// Calls the createManualSubmission server action and lets the parent
// know what the new reference number is so it can show a success toast.
//
// Mounting: this dialog is rendered ONLY when the parent decides it
// should be open — the parent does `{open && <CreateSubmissionDialog ... />}`.
// We never accept an `open` prop and never early-return null. That's
// deliberate: an early return inside a hooks-bearing component is the
// React Rules-of-Hooks footgun (hook count differs between renders).
// Letting the parent control mount/unmount also means closing the
// dialog tears down all local state automatically — no manual reset.
export function CreateSubmissionDialog({
  categories,
  fieldsByCategory,
  onClose,
  onCreated,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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
    submit?: string;
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

    const phoneE164 = phone.trim() ? parsePhoneSmart(phone.trim()).e164 ?? null : null;

    const customAnswersPayload: Record<string, string | string[] | null> = {};
    for (const f of customFields) {
      const v = customValues[f.id];
      if (v == null) continue;
      if (typeof v === 'string') customAnswersPayload[f.id] = v;
      else if (Array.isArray(v)) customAnswersPayload[f.id] = v;
    }

    setErrors((prev) => ({ ...prev, submit: undefined }));
    startTransition(async () => {
      try {
        const created = await createManualSubmission({
          category_id: categoryId,
          language,
          submitter_name: name.trim(),
          submitter_email: email.trim() || null,
          submitter_phone: phoneE164,
          source: {
            channel,
            referral: referral.trim() || null,
          },
          custom_answers: customAnswersPayload,
          notes: notes.trim() || null,
        });
        // Parent unmounts the dialog on `onCreated`, which tears down our
        // local state for free — no manual reset needed.
        onCreated(created.reference_no);
        // Pull the latest list back from the server so the new row appears.
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        setErrors((prev) => ({ ...prev, submit: translateError(msg) }));
      }
    });
  };

  return (
    <DialogShell onClose={() => { if (!pending) onClose(); }}>
      <h3 className="text-[16px] font-semibold mb-1">طلب يدوي</h3>
      <p className="text-[12.5px] mb-4" style={{ color: 'var(--muted)' }}>
        أضف طلبًا وصلكم خارج النموذج العام، وحدد كيف وصل إليكم.
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
            placeholder="مثال: لقاء في مؤتمر الذكاء الاصطناعي"
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

      {errors.submit && (
        <div className="mt-3 text-[13px]" style={{ color: 'var(--danger)' }}>
          {errors.submit}
        </div>
      )}

      <DialogActions
        onCancel={onClose}
        onSave={onSave}
        pending={pending}
        saveLabel={pending ? 'جارٍ الحفظ…' : 'إضافة'}
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
