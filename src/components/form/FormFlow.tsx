'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import type { FormCategoryRow, FormFieldRow, Lang } from '@/types/database';
import { pick, UI, stepOf } from '@/lib/i18n';
import { validateField } from '@/lib/validation';
import { resolveDefaultCountry } from '@/lib/phone-detect';
import { buildStepPlan } from '@/lib/step-plan';
import { ProgressBar } from './ProgressBar';
import { LangToggle } from './LangToggle';
import { CategoryPicker } from './CategoryPicker';
import { StepCard } from './StepCard';
import { ThankYou } from './ThankYou';
import { ArrowRight, ArrowLeft, Enter } from './icons';

type FieldValue = string | string[] | undefined;

type FormSchema = {
  categories: FormCategoryRow[];
  fieldsByCategory: Record<string, FormFieldRow[]>;
};

export function FormFlow({ schema }: { schema: FormSchema }) {
  const [lang, setLang] = useState<Lang>('ar');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [direction, setDirection] = useState<1 | -1>(1);
  const [done, setDone] = useState(false);
  const [refNo, setRefNo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Initialize lang from URL or localStorage; sync to <html>.
  useEffect(() => {
    let initial: Lang = 'ar';
    try {
      const url = new URLSearchParams(window.location.search).get('lang');
      const ls = window.localStorage.getItem('itqan_lang');
      const candidate = url || ls || 'ar';
      initial = candidate === 'en' ? 'en' : 'ar';
    } catch {}
    setLang(initial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    try {
      window.localStorage.setItem('itqan_lang', lang);
    } catch {}
    document.title = lang === 'en' ? 'Itqan — Contact' : 'إتقان — نموذج التواصل';
  }, [lang]);

  // Track how much the on-screen keyboard (iOS) is eating off the layout
  // viewport so the sticky bottom nav can hover just above the keyboard
  // instead of being hidden underneath it. visualViewport also fires when
  // Safari's form-assist toolbar shows, which is exactly the overlap the
  // user hit on iPhone.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);
    };
    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  const fields = categoryId ? schema.fieldsByCategory[categoryId] || [] : [];
  const stepPlan = useMemo(() => buildStepPlan(fields), [fields]);
  const totalSteps = stepPlan.length;
  const atFormStart = categoryId == null && !done;
  const atField = !atFormStart && !done;
  const currentStep = atField ? stepPlan[stepIndex] : null;
  const category = categoryId ? schema.categories.find((c) => c.id === categoryId) || null : null;

  const progressPct = useMemo(() => {
    if (done) return 100;
    if (atFormStart) return 2;
    return Math.round(((stepIndex + 1) / (totalSteps + 1)) * 100);
  }, [done, atFormStart, stepIndex, totalSteps]);

  // The phone input uses this to pre-select the correct country when the
  // user reaches that step. Resolution order: an answered location field
  // (free-text, parsed for country keywords) → the UI language → SA as a
  // final fallback.
  const phoneDefaultCountry = useMemo(() => {
    const locationField = fields.find((f) => f.semantic_role === 'location');
    const raw = locationField ? values[locationField.id] : undefined;
    const locationText = typeof raw === 'string' ? raw : null;
    return resolveDefaultCountry({ location: locationText, lang });
  }, [fields, values, lang]);

  const setVal = (id: string, v: FieldValue) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) setErrors((prev) => ({ ...prev, [id]: null }));
  };

  const goNext = async () => {
    if (!currentStep || currentStep.length === 0) return;
    // Validate every field in the current step before advancing. Collect
    // errors together so the user sees all the problems at once, not one
    // pop at a time.
    const stepErrors: Record<string, string | null> = {};
    let hasError = false;
    for (const f of currentStep) {
      const err = validateField(f, values[f.id], lang);
      if (err) {
        stepErrors[f.id] = err;
        hasError = true;
      }
    }
    if (hasError) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      return;
    }
    setDirection(1);
    if (stepIndex + 1 >= totalSteps) {
      await submit();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const submit = async () => {
    if (!categoryId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        category_id: categoryId,
        language: lang,
        answers: fields.map((f) => ({
          field_id: f.id,
          field_key: f.key,
          field_label: { ar: f.label_ar, en: f.label_en },
          value: values[f.id] ?? null,
          semantic_role: f.semantic_role,
        })),
      };
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'submit_failed');
      }
      const data = await res.json();
      setRefNo(data.reference_no);
      setDone(true);
    } catch (e) {
      console.error(e);
      setSubmitError(pick(UI.errSubmit, lang));
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    setDirection(-1);
    if (stepIndex === 0) setCategoryId(null);
    else setStepIndex(stepIndex - 1);
  };

  const pickCategory = (id: string) => {
    setCategoryId(id);
    setStepIndex(0);
    setValues({});
    setErrors({});
    setDirection(1);
  };

  const reset = () => {
    setDone(false);
    setCategoryId(null);
    setStepIndex(0);
    setValues({});
    setErrors({});
    setRefNo(null);
    setDirection(-1);
  };

  // Enter to advance. Use a ref so the listener is attached once instead of
  // on every render — handler reads always-fresh state via the ref.
  const advanceRef = useRef<() => void>(() => {});
  advanceRef.current = () => {
    if (atField) void goNext();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === 'TEXTAREA') return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const Forward = lang === 'en' ? ArrowRight : ArrowLeft;
  const Back = lang === 'en' ? ArrowLeft : ArrowRight;

  const stepOfText = atField ? stepOf(stepIndex + 1, totalSteps, lang) : '';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top: logo + lang + progress */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg)' }}>
        <div className="max-w-5xl mx-auto px-6 md:px-10 pt-5 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg overflow-hidden relative"
              style={{ boxShadow: '0 0 0 1px var(--rule)' }}
            >
              <Image
                src="/itqan_logo_square.png"
                alt={lang === 'en' ? 'Itqan' : 'مجتمع إتقان'}
                width={40}
                height={40}
                priority
                className="w-full h-full object-cover"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--fg)' }}>
                {lang === 'en' ? 'Itqan' : 'مجتمع إتقان لتقنيات القرآن'}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {category ? pick({ ar: category.label_ar, en: category.label_en }, lang) : pick(UI.headerSubtitle, lang)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-[12.5px]" style={{ color: 'var(--muted)' }}>
              {atField && stepOfText}
              {atFormStart && pick(UI.pickCategory, lang)}
              {done && pick(UI.done, lang)}
            </div>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </div>
        <ProgressBar value={progressPct} lang={lang} />
      </div>

      <main
        className="flex-1 flex items-start md:items-center justify-center px-6 md:px-10 py-8 md:py-16 overflow-hidden"
        style={{
          // Extra bottom padding when the keyboard is open so the focused
          // input never lands flush with Safari's form-assist bar.
          paddingBottom: keyboardOffset > 0 ? keyboardOffset + 24 : undefined,
        }}
      >
        <div className="w-full max-w-3xl">
          {atFormStart && <CategoryPicker categories={schema.categories} onPick={pickCategory} lang={lang} />}
          {atField && currentStep && (
            <StepCard
              step={currentStep}
              values={values}
              errors={errors}
              onFieldChange={setVal}
              direction={direction}
              lang={lang}
              category={category}
              onChangeCategory={() => {
                setDirection(-1);
                setCategoryId(null);
              }}
              phoneDefaultCountry={phoneDefaultCountry}
            />
          )}
          {done && refNo && <ThankYou refNo={refNo} onReset={reset} lang={lang} />}
        </div>
      </main>

      {atField && (
        <div
          className="sticky z-20 border-t transition-transform safe-bottom"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--rule-soft)',
            // When the iOS keyboard is open, pin the nav just above it
            // instead of leaving it pinned to the (hidden) bottom of the
            // layout viewport. On desktop and keyboard-closed the offset
            // is 0 and this behaves like a normal sticky bottom.
            bottom: keyboardOffset,
          }}
        >
          {/* Submit error banner — visible on every viewport. Previously this
              lived inside a `hidden md:flex` row and was completely invisible
              on mobile, turning a failed submission into a silent failure. */}
          {submitError && (
            <div
              role="alert"
              className="max-w-3xl mx-auto px-6 md:px-10 pt-3 -mb-1 text-[13px] text-center"
              style={{ color: 'var(--danger)' }}
            >
              {submitError}
            </div>
          )}
          <div className="max-w-3xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
            <button
              onClick={goBack}
              disabled={submitting}
              className="form-nav-back inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[14px] transition disabled:opacity-50"
              style={{ color: 'var(--muted)' }}
            >
              <Back size={16} />
              {pick(UI.back, lang)}
            </button>

            {/* Step counter (mobile-visible, compact form) + desktop "Press
                Enter" hint. Previously the entire status text was
                `hidden sm:block`, leaving mobile users without any sense of
                progress beyond the 3px ProgressBar. */}
            <div className="flex items-center gap-3 text-[12px]" style={{ color: 'var(--muted)' }}>
              <span className="sm:hidden tabular-nums" aria-hidden="true">
                {stepIndex + 1}/{totalSteps}
              </span>
              {!submitError && (
                <span className="hidden md:inline-flex items-center gap-2">
                  <Enter size={14} />
                  {pick(UI.pressEnter, lang)}
                </span>
              )}
            </div>

            <button
              onClick={() => void goNext()}
              disabled={submitting}
              className="form-nav-next inline-flex items-center gap-2 px-6 py-3 rounded-lg text-[14.5px] font-semibold transition disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'var(--accent-fg)' }}
            >
              {submitting
                ? pick(UI.submitting, lang)
                : stepIndex + 1 >= totalSteps
                  ? pick(UI.submit, lang)
                  : pick(UI.next, lang)}
              <Forward size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
