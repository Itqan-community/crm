import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// ESLint v9 flat config. We bridge to next/core-web-vitals (which itself
// pulls in react-hooks/rules-of-hooks as `error`) via FlatCompat — that
// preset is still distributed in the legacy "extends" format.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      '*.config.{js,cjs,mjs,ts}',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      // Promote the hooks rule by name in case the preset ever ships it
      // as a warning. A hooks-of-rules violation is a runtime crash
      // waiting to happen, not a style issue.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
