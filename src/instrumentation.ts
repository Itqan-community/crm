export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Next.js 15 looks for `onRequestError`; in Sentry 10 the export is renamed.
export { captureRequestError as onRequestError } from '@sentry/nextjs';
