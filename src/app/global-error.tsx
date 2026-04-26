'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <h2>حدث خطأ غير متوقع</h2>
        <p>نعتذر، حدث خطأ غير متوقع. تم إبلاغ الفريق التقني تلقائياً.</p>
      </body>
    </html>
  );
}
