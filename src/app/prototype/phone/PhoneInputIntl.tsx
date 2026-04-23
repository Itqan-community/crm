'use client';

import { useMemo, useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';

type Props = {
  defaultCountry: CountryCode;
};

export function PhoneInputIntl({ defaultCountry }: Props) {
  const [value, setValue] = useState('');

  const parsed = useMemo(() => {
    if (!value) return null;
    return parsePhoneNumberFromString(value);
  }, [value]);

  const valid = Boolean(parsed?.isValid());
  const e164 = parsed?.number ?? null;
  const international = parsed?.formatInternational() ?? null;
  const type = parsed?.getType() ?? null;
  const country = parsed?.country ?? null;

  return (
    <div className="w-full space-y-4">
      <div className="phone-intl-wrap">
        <PhoneInput
          defaultCountry={defaultCountry.toLowerCase() as Lowercase<CountryCode>}
          value={value}
          onChange={setValue}
          inputProps={{ dir: 'ltr' }}
          className="phone-intl-input"
        />
      </div>

      <div
        className="rounded-lg p-4 text-[13px] font-mono space-y-1.5"
        style={{ background: 'var(--rule-soft)', color: 'var(--fg)' }}
      >
        <Row label="Default country" value={defaultCountry} />
        <Row label="Raw value" value={value || '—'} />
        <Row label="E.164 (to store)" value={e164 || '—'} highlight={valid} />
        <Row label="International" value={international || '—'} />
        <Row label="Detected country" value={country || '—'} />
        <Row label="Type" value={type || '—'} />
        <Row label="Valid" value={valid ? '✓ yes' : value ? '✗ no' : '—'} />
      </div>

      <style jsx global>{`
        .phone-intl-wrap .react-international-phone-input-container {
          border-bottom: 2px solid var(--rule);
          transition: border-color 120ms ease;
        }
        .phone-intl-wrap .react-international-phone-input-container:focus-within {
          border-bottom-color: var(--accent);
        }
        .phone-intl-wrap .react-international-phone-country-selector-button {
          background: transparent;
          border: none;
          padding: 0 8px;
          height: auto;
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown {
          background: var(--bg);
          color: var(--fg);
          border: 1px solid var(--rule);
        }
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item:hover,
        .phone-intl-wrap .react-international-phone-country-selector-dropdown__list-item--focused {
          background: var(--rule-soft);
        }
        .phone-intl-wrap .react-international-phone-input {
          background: transparent;
          border: none;
          color: var(--fg);
          caret-color: var(--accent);
          font-size: clamp(20px, 2.4vw, 26px);
          font-weight: 500;
          padding: 0 0 12px 0;
          outline: none;
          letter-spacing: 0.02em;
          width: 100%;
        }
        .phone-intl-wrap .react-international-phone-input::placeholder {
          color: var(--muted);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex gap-3" dir="ltr">
      <span className="shrink-0 w-40" style={{ color: 'var(--muted)' }}>
        {label}
      </span>
      <span
        className="break-all"
        style={{
          color: highlight ? 'var(--accent)' : 'var(--fg)',
          fontWeight: highlight ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}
