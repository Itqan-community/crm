'use client';

import { useMemo } from 'react';
import { PhoneInput as IntlPhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { getPhoneCountries } from '@/lib/phone-countries';

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** id forwarded to the underlying <input>, so a parent <label htmlFor=…> can associate. */
  id?: string;
  /** aria-label fallback when no visible <label> is associated. */
  'aria-label'?: string;
};

// Slim wrapper around react-international-phone tuned for the admin dialog
// chrome (small font, transparent bg, --rule borders). Stores the value as
// E.164 and exposes the country flag picker so the user can't enter an
// out-of-format number.
export function AdminPhoneInput({ value, onChange, id, ...rest }: Props) {
  const countries = useMemo(() => getPhoneCountries('ar'), []);

  return (
    <div className="phone-admin-wrap">
      <IntlPhoneInput
        defaultCountry="sa"
        value={value || ''}
        onChange={onChange}
        countries={countries}
        inputProps={{
          id,
          dir: 'ltr',
          autoComplete: 'tel',
          name: 'phone',
          inputMode: 'tel',
          'aria-label': rest['aria-label'],
        }}
      />
      <style jsx global>{`
        /* The country dropdown is rendered as a child of the input container,
           so the container must NOT clip overflow — otherwise the dropdown
           gets cut off and the flag in the selector button disappears. */
        .phone-admin-wrap .react-international-phone-input-container {
          display: flex;
          align-items: stretch;
          border: 1px solid var(--rule);
          border-radius: 0.5rem;
          background: transparent;
          height: 38px;
        }
        .phone-admin-wrap .react-international-phone-input-container:focus-within {
          border-color: var(--accent);
        }
        /* Stretch the country button to the full container height and center
           the flag inside, so it lines up with the input text vertically. */
        .phone-admin-wrap .react-international-phone-country-selector-button,
        .phone-admin-wrap .react-international-phone-country-selector-button:hover,
        .phone-admin-wrap .react-international-phone-country-selector-button:focus,
        .phone-admin-wrap .react-international-phone-country-selector-button:active {
          background: transparent;
          border: none;
          box-shadow: none;
          outline: none;
          padding: 0 10px;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          border-radius: 0;
        }
        .phone-admin-wrap .react-international-phone-country-selector-button:hover {
          background: var(--rule-soft);
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown {
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--rule);
          border-radius: 0.5rem;
          box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.18);
          z-index: 60;
          min-width: 260px;
          max-height: 280px;
          overflow-y: auto;
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
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item-country-name {
          color: var(--fg);
        }
        .phone-admin-wrap .react-international-phone-country-selector-dropdown__list-item-dial-code {
          color: var(--muted);
        }
        .phone-admin-wrap .react-international-phone-input {
          background: transparent;
          border: none;
          color: var(--fg);
          padding: 0 0.75rem;
          font-size: 13.5px;
          flex: 1;
          min-width: 0;
          outline: none;
          height: 100%;
        }
        .phone-admin-wrap .react-international-phone-input::placeholder {
          color: var(--muted);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
