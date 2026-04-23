'use client';

import type { CountryCode } from 'libphonenumber-js/min';
import type { FormCategoryRow, FormFieldRow, Lang } from '@/types/database';
import { Label } from './Label';
import { CategoryChip } from './CategoryChip';
import { FieldRenderer } from './fields/FieldRenderer';

type FieldValue = string | string[] | undefined;

type Props = {
  field: FormFieldRow;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  error?: string | null;
  autoFocus?: boolean;
  direction: 1 | -1;
  lang: Lang;
  category: FormCategoryRow | null;
  onChangeCategory: () => void;
  phoneDefaultCountry?: CountryCode;
};

export function StepCard({ field, value, onChange, error, autoFocus, direction, lang, category, onChangeCategory, phoneDefaultCountry }: Props) {
  const cls = direction === -1 ? 'slide-in-rtl' : 'slide-in-ltr';
  return (
    <div className={'w-full ' + cls} key={field.id + '-' + lang}>
      {category && <CategoryChip category={category} onChange={onChangeCategory} lang={lang} />}
      <Label field={field} lang={lang} />
      <FieldRenderer field={field} value={value} onChange={onChange} error={error} autoFocus={autoFocus} lang={lang} phoneDefaultCountry={phoneDefaultCountry} />
    </div>
  );
}
