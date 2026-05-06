import type { Lang, SourceChannelKey } from '@/types/database';

// Roles a CSV/Excel column can be mapped to. Per-row category means the
// custom-field schema varies per row, so we map columns to *roles* rather
// than to specific field IDs and resolve to fields at submit time using
// each row's category.
export type ColumnRole =
  | 'name'
  | 'email'
  | 'phone'
  | 'category'
  | 'language'
  | 'channel'
  | 'referral'
  | 'notes'
  | 'custom'
  | 'ignore';

export type ColumnMapping = {
  column: string;
  role: ColumnRole;
};

export type ParsedFile = {
  filename: string;
  headers: string[];
  // One entry per data row; each is a header → cell-value map.
  rows: Record<string, string>[];
};

export type RowValues = {
  name: string;
  email: string | null;
  phone: string | null; // E.164 once validated
  category_key: string | null;
  category_id: string | null;
  language: Lang;
  channel: SourceChannelKey;
  referral: string | null;
  notes: string | null;
  // Header → value, resolved to field_id at submit using the row's category.
  custom_answers: Record<string, string>;
};

export type RowStatus = 'ok' | 'warning' | 'error';

export type ValidatedRow = {
  rowIndex: number; // 1-based, matches the spreadsheet row label minus the header
  raw: Record<string, string>;
  values: RowValues;
  status: RowStatus;
  // User-facing Arabic strings.
  errors: string[];
  warnings: string[];
};
