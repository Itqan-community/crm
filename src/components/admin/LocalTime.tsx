'use client';

import { useEffect, useState } from 'react';

type Mode = 'datetime' | 'date';

type Props = {
  iso: string;
  mode?: Mode;
  /**
   * Optional fallback shown during SSR / before hydration. If you don't pass
   * one, we render the ISO string so server and client markup match exactly,
   * avoiding hydration warnings; the user sees the local-time format the
   * moment hydration completes.
   */
  fallback?: string;
};

// All timestamps in the DB are stored in UTC. Server components render with
// the server's timezone (Vercel = UTC), which surprises users in other zones.
// This client wrapper reformats the timestamp using the browser's locale +
// timezone after hydration, so each user sees their own local time.
export function LocalTime({ iso, mode = 'datetime', fallback }: Props) {
  const [text, setText] = useState<string>(fallback ?? iso);

  useEffect(() => {
    setText(format(iso, mode));
  }, [iso, mode]);

  return (
    <time dateTime={iso} title={format(iso, 'datetime')}>
      {text}
    </time>
  );
}

function format(iso: string, mode: Mode): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (mode === 'date') {
    return d.toLocaleDateString('ar-EG-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleString('ar', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
