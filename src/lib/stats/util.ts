// Small utilities shared across every source/* module.

/**
 * Render any thrown value as a one-line string suitable for the
 * stats error banner. Handles Error, plain {message}/{error} objects,
 * and arbitrary throws. Stays compact (≤300 chars) so a malformed
 * payload doesn't blow up the banner layout.
 */
export function describeError(err: unknown): string {
  if (!err) return 'unknown';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    return String(obj.message ?? obj.error ?? JSON.stringify(obj).slice(0, 300));
  }
  return String(err);
}
