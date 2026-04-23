'use client';

import type { CountryCode } from 'libphonenumber-js/min';
import type { FormFieldRow, Lang } from '@/types/database';
import { TextInput } from './TextInput';
import { TextArea } from './TextArea';
import { PhoneInput } from './PhoneInput';
import { RadioGroup } from './RadioGroup';
import { CheckboxGroup } from './CheckboxGroup';

type FieldValue = string | string[] | undefined;

type Props = {
  field: FormFieldRow;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
  error?: string | null;
  autoFocus?: boolean;
  lang: Lang;
  phoneDefaultCountry?: CountryCode;
};

export function FieldRenderer({ field, value, onChange, error, autoFocus, lang, phoneDefaultCountry }: Props) {
  switch (field.kind) {
    case 'text':
      return (
        <TextInput
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
          autoFocus={autoFocus}
          lang={lang}
        />
      );
    case 'email':
      return (
        <TextInput
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
          autoFocus={autoFocus}
          lang={lang}
          type="email"
        />
      );
    case 'url':
      return (
        <TextInput
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
          autoFocus={autoFocus}
          lang={lang}
          type="url"
        />
      );
    case 'phone':
      return (
        <PhoneInput
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
          autoFocus={autoFocus}
          lang={lang}
          defaultCountry={phoneDefaultCountry}
        />
      );
    case 'textarea':
      return (
        <TextArea
          field={field}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          error={error}
          autoFocus={autoFocus}
          lang={lang}
        />
      );
    case 'radio':
      return (
        <RadioGroup
          field={field}
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          error={error}
          lang={lang}
        />
      );
    case 'checkbox':
      return (
        <CheckboxGroup
          field={field}
          value={Array.isArray(value) ? value : undefined}
          onChange={onChange}
          error={error}
          lang={lang}
        />
      );
    default:
      return null;
  }
}
