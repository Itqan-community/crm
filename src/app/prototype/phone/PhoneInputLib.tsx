'use client';

import { useState } from 'react';
import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { normalizePhoneInput } from '@/lib/validation';
import { IconPhone } from '@/components/form/icons';
import { ErrorNote } from '@/components/form/fields/ErrorNote';

type Props = {
  defaultCountry: CountryCode;
};

type ParseResult = {
  raw: string;
  e164: string | null;
  international: string | null;
  type: string | null;
  country: string | null;
  valid: boolean;
  error: string | null;
};

function evaluate(raw: string, defaultCountry: CountryCode): ParseResult {
  const normalized = normalizePhoneInput(raw);
  if (!normalized) {
    return {
      raw,
      e164: null,
      international: null,
      type: null,
      country: null,
      valid: false,
      error: null,
    };
  }
  const parsed = parsePhoneNumberFromString(normalized, defaultCountry);
  if (!parsed) {
    return {
      raw,
      e164: null,
      international: null,
      type: null,
      country: null,
      valid: false,
      error: 'تعذّر تحليل الرقم. جرّب إضافة + ورمز الدولة.',
    };
  }
  if (!parsed.isValid()) {
    return {
      raw,
      e164: parsed.number,
      international: parsed.formatInternational(),
      type: parsed.getType() ?? null,
      country: parsed.country ?? null,
      valid: false,
      error: 'الرقم غير مكتمل أو خارج النطاق المقبول لهذه الدولة.',
    };
  }
  return {
    raw,
    e164: parsed.number,
    international: parsed.formatInternational(),
    type: parsed.getType() ?? null,
    country: parsed.country ?? null,
    valid: true,
    error: null,
  };
}

export function PhoneInputLib({ defaultCountry }: Props) {
  const [raw, setRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);

  const result = evaluate(raw, defaultCountry);
  const showError = touched && !focused && result.error;
  const borderColor = showError
    ? 'var(--danger)'
    : focused
      ? 'var(--accent)'
      : 'var(--rule)';

  return (
    <div className="w-full space-y-4">
      <div>
        <div
          className="flex items-center border-b-2 transition-colors"
          style={{ borderColor }}
        >
          <span className="shrink-0 pe-3" style={{ color: 'var(--muted)' }}>
            <IconPhone size={22} />
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={raw}
            placeholder="+966 5X XXX XXXX"
            onChange={(e) => setRaw(normalizePhoneInput(e.target.value))}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setTouched(true);
            }}
            dir="ltr"
            className="w-full bg-transparent outline-none text-[clamp(20px,2.4vw,26px)] font-medium pb-3 tracking-wide"
            style={{ color: 'var(--fg)', caretColor: 'var(--accent)', textAlign: 'left' }}
          />
        </div>
        <ErrorNote>{showError ? result.error : null}</ErrorNote>
      </div>

      <ResultPanel result={result} defaultCountry={defaultCountry} />
    </div>
  );
}

function ResultPanel({
  result,
  defaultCountry,
}: {
  result: ParseResult;
  defaultCountry: CountryCode;
}) {
  return (
    <div
      className="rounded-lg p-4 text-[13px] font-mono space-y-1.5"
      style={{ background: 'var(--rule-soft)', color: 'var(--fg)' }}
    >
      <Row label="Default country" value={defaultCountry} />
      <Row label="Raw input" value={result.raw || '—'} />
      <Row label="E.164 (to store)" value={result.e164 || '—'} highlight={result.valid} />
      <Row label="International" value={result.international || '—'} />
      <Row label="Detected country" value={result.country || '—'} />
      <Row label="Type" value={result.type || '—'} />
      <Row label="Valid" value={result.valid ? '✓ yes' : result.raw ? '✗ no' : '—'} />
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
