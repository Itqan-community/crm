'use client';

import type { CountryCode } from 'libphonenumber-js/min';
import type { FormCategoryRow, FormFieldRow, Lang } from '@/types/database';
import { Label } from './Label';
import { CategoryChip } from './CategoryChip';
import { FieldRenderer } from './fields/FieldRenderer';

type FieldValue = string | string[] | undefined;

type Props = {
  step: FormFieldRow[];
  values: Record<string, FieldValue>;
  errors: Record<string, string | null>;
  onFieldChange: (fieldId: string, value: FieldValue) => void;
  direction: 1 | -1;
  lang: Lang;
  category: FormCategoryRow | null;
  onChangeCategory: () => void;
  phoneDefaultCountry?: CountryCode;
};

export function StepCard({
  step,
  values,
  errors,
  onFieldChange,
  direction,
  lang,
  category,
  onChangeCategory,
  phoneDefaultCountry,
}: Props) {
  const cls = direction === -1 ? 'slide-in-rtl' : 'slide-in-ltr';
  // A stable key per step-shape + language keeps the slide-in animation
  // honest and forces inputs like the phone picker to remount with the
  // right defaultCountry when the step changes.
  const stepKey = step.map((f) => f.id).join('|') + '-' + lang;

  return (
    <div className={'w-full ' + cls} key={stepKey}>
      {category && <CategoryChip category={category} onChange={onChangeCategory} lang={lang} />}
      <div className="space-y-6 md:space-y-8">
        {step.map((field, i) => (
          <div key={field.id}>
            <Label field={field} lang={lang} compact={step.length > 1} />
            <FieldRenderer
              field={field}
              value={values[field.id]}
              onChange={(v) => onFieldChange(field.id, v)}
              error={errors[field.id]}
              autoFocus={i === 0}
              lang={lang}
              phoneDefaultCountry={phoneDefaultCountry}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
