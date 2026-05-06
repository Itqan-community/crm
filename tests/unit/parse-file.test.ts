// Tests run in node env (no FileReader/File polyfill needed for the
// pure helpers we exercise here). We don't test parseFile() end-to-end
// because that requires a browser File object and the third-party
// libraries are tested upstream.

import { describe, it, expect } from 'vitest';

// Re-import only the matrix helper. parse-file's matrixToParsed is
// the heart of the failure-mode logic; we test it directly via a tiny
// re-export in a moment. For now, exercise via parseFile would require
// File polyfills — instead, ensure the public function rejects an
// unsupported format synchronously for fast-failure regression coverage.

import { parseFile, matrixToParsed } from '@/lib/bulk-import/parse-file';

class FakeFile {
  constructor(public readonly name: string, public readonly type: string = '') {}
}

describe('parseFile — format gating', () => {
  it('rejects .xls because read-excel-file v9 only handles .xlsx', async () => {
    // CodeRabbit finding: the previous code routed .xls to the Excel
    // parser even though the library does not support legacy binary
    // .xls. We now surface that as `unsupported_format` instead.
    await expect(parseFile(new FakeFile('legacy.xls') as unknown as File)).rejects.toThrow(
      'unsupported_format',
    );
  });

  it('rejects an unknown extension with `unsupported_format`', async () => {
    await expect(
      parseFile(new FakeFile('archive.zip') as unknown as File),
    ).rejects.toThrow('unsupported_format');
  });
});

describe('matrixToParsed — header validation', () => {
  it('rejects an empty file', () => {
    expect(() => matrixToParsed('x.csv', [])).toThrow('empty_file');
  });

  it('rejects a header row with all-empty cells', () => {
    expect(() => matrixToParsed('x.csv', [['', '', '']])).toThrow('no_headers');
  });

  it('rejects a mid-row empty header — would misalign downstream cells', () => {
    // CodeRabbit finding: silently filtering out an empty header in the
    // middle of the row makes the data row's column-index → header-name
    // mapping wrong. Better to fail loudly.
    expect(() =>
      matrixToParsed('x.csv', [
        ['Name', '', 'Email'],
        ['Sara', 'unused', 'sara@x.x'],
      ]),
    ).toThrow('empty_header_column');
  });

  it('tolerates trailing empty headers (Excel pads them)', () => {
    const out = matrixToParsed('x.csv', [
      ['Name', 'Email', '', ''],
      ['Sara', 'sara@x.x', '', ''],
    ]);
    expect(out.headers).toEqual(['Name', 'Email']);
    expect(out.rows).toEqual([{ Name: 'Sara', Email: 'sara@x.x' }]);
  });

  it('rejects a file with header row but no data rows', () => {
    expect(() => matrixToParsed('x.csv', [['Name', 'Email']])).toThrow('no_data_rows');
  });

  it('drops fully-empty data rows (Excel padding) without erroring', () => {
    const out = matrixToParsed('x.csv', [
      ['Name'],
      ['Sara'],
      [''],
      ['Ahmad'],
      [''],
    ]);
    expect(out.rows.map((r) => r.Name)).toEqual(['Sara', 'Ahmad']);
  });
});
