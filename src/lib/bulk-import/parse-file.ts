import Papa from 'papaparse';
import readXlsxFile from 'read-excel-file/browser';
import type { ParsedFile } from './types';

// Cap how many rows we'll accept from a single file. The wizard renders the
// whole sheet in-memory and validates client-side, so this guards both the
// browser tab and the eventual server payload from a runaway upload.
export const MAX_IMPORT_ROWS = 2_000;

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || file.type === 'text/csv') {
    return parseCsv(file);
  }
  if (ext === 'xlsx' || ext === 'xls' || file.type.includes('spreadsheet')) {
    return parseExcel(file);
  }
  throw new Error('unsupported_format');
}

async function parseCsv(file: File): Promise<ParsedFile> {
  const text = await file.text();
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: 'greedy',
    // We pull the header row ourselves so the row shape stays consistent
    // with the Excel path (which gives us a 2D array).
    header: false,
  });
  if (result.errors.length > 0) {
    // Hard-fail on structural errors (mismatched quotes, etc.). Soft errors
    // like trailing commas are rare with greedy skipEmptyLines.
    throw new Error(`csv_parse_failed: ${result.errors[0].message}`);
  }
  return matrixToParsed(file.name, result.data);
}

async function parseExcel(file: File): Promise<ParsedFile> {
  // read-excel-file resolves cells to native types; we coerce everything to
  // string for the wizard so the mapping/validation code only deals with
  // text. Numbers, dates, booleans all become their .toString() form.
  // The published .d.ts types claim `Sheet<number>[]` but the runtime
  // returns the first sheet's 2D row array directly (with default options).
  // Cast through `unknown` and validate the shape we actually got.
  const result = (await readXlsxFile(file)) as unknown;
  const matrix = pickSheetMatrix(result);
  const stringMatrix = matrix.map((r) =>
    r.map((cell) => (cell == null ? '' : String(cell))),
  );
  return matrixToParsed(file.name, stringMatrix);
}

function pickSheetMatrix(result: unknown): unknown[][] {
  if (!Array.isArray(result)) return [];
  // Already a 2D row array.
  if (result.length === 0 || Array.isArray(result[0])) {
    return result as unknown[][];
  }
  // Sheet[] shape: take the first sheet's `data`.
  const first = result[0] as { data?: unknown[][] };
  return Array.isArray(first?.data) ? first.data : [];
}

function matrixToParsed(filename: string, matrix: string[][]): ParsedFile {
  if (matrix.length === 0) {
    throw new Error('empty_file');
  }
  const headers = (matrix[0] ?? []).map((h) => h.trim()).filter((h) => h.length > 0);
  if (headers.length === 0) {
    throw new Error('no_headers');
  }
  const dataRows = matrix.slice(1);
  if (dataRows.length === 0) {
    throw new Error('no_data_rows');
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error('too_many_rows');
  }
  // Drop fully-empty rows that survived parsing (Excel often pads with blanks).
  const rows: Record<string, string>[] = [];
  for (const r of dataRows) {
    const obj: Record<string, string> = {};
    let nonEmpty = false;
    for (let i = 0; i < headers.length; i += 1) {
      const v = (r[i] ?? '').toString().trim();
      obj[headers[i]] = v;
      if (v.length > 0) nonEmpty = true;
    }
    if (nonEmpty) rows.push(obj);
  }
  return { filename, headers, rows };
}
