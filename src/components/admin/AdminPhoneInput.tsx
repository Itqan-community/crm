'use client';

import { useMemo } from 'react';
import { PhoneInput as IntlPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { getPhoneCountries } from '@/lib/phone-countries';

type Props = {
  value: string;
  onChange: (v: string) => void;
};

// Slim wrapper around react-international-phone tuned for the admin dialog
// chrome (small font, transparent bg, --rule borders). Stores the value as
// E.164 and exposes the country flag picker so the user can't enter an
// out-of-format number.
export function AdminPhoneInput({ value, onChange }: Props) {
  const countries = useMemo(() => getPhoneCountries('ar'), []);

  return (
    <div className="phone-admin-wrap">
      <IntlPhoneInput
        defaultCountry="sa"
        value={value || ''}
        onChange={onChange}
        countries={countries}
        inputProps={{
          dir: 'ltr',
          autoComplete: 'tel',
          name: 'phone',
          inputMode: 'tel',
        }}
      />
      <style jsx global>{`
        .phone-admin-wrap .react-international-phone-input-container {
          border: 1px solid var(--rule);
          border-radius: 0.5rem;
          background: transparent;
          overflow: hidden;
        }
        .phone-admin-wrap .react-international-phone-input-container:focus-within {
          border-color: var(--accent);
        }
        .phone-admin-wrap .react-international-phone-country-selector-button {
          background: transparent;
          border: none;
          padding: 0 8px;
          height: auto;
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown {
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--rule);
          z-index: 50;
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item {
          color: var(--fg);
          min-height: 36px;
          padding: 6px 10px;
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item:hover,
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item--focused {
          background: var(--rule-soft);
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item-dial-code {
          color: var(--muted);
        }
        .phone-admin-wrap .react-international-phone-input {
          background: transparent;
          border: none;
          color: var(--fg);
          padding: 0.5rem 0.75rem;
          font-size: 13.5px;
          width: 100%;
          outline: none;
        }
        .phone-admin-wrap .react-international-phone-input::placeholder {
          color: var(--muted);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
