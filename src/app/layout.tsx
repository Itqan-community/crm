import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const SITE_URL = 'https://join.itqan.dev';
const TITLE = 'مجتمع إتقان - شاركنا في خدمة التقنيات القرآنية';
const DESCRIPTION =
  'انضم إلى مجتمع إتقان: شاركنا في خدمة القرآن الكريم عبر التقنية. سواء كنت صاحب محتوى أو تطبيق، مطوّراً أو مصمماً أو إدارياً — اختر ما يصفك وسنوجّهك بفرص واضحة للمساهمة.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · مجتمع إتقان',
  },
  description: DESCRIPTION,
  applicationName: 'مجتمع إتقان',
  authors: [{ name: 'مجتمع إتقان', url: 'https://itqan.dev' }],
  creator: 'مجتمع إتقان',
  publisher: 'مجتمع إتقان',
  keywords: [
    'مجتمع إتقان', 'إتقان', 'تقنيات القرآن', 'القرآن الكريم',
    'تطوير قرآني', 'مفتوح المصدر', 'Itqan', 'Quran technology',
  ],

  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    alternateLocale: ['en_US'],
    url: SITE_URL,
    siteName: 'تواصل معنا | مجتمع إتقان لتقنيات القرآن',
    title: TITLE,
    description: DESCRIPTION,
    // The OG image is generated dynamically by opengraph-image.tsx in this
    // same directory — Next.js auto-injects it. No need to declare images
    // here.
  },

  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    site: '@itqan_community',
    creator: '@itqan_community',
  },

  icons: {
    icon: [
      { url: '/itqan_logo_square.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/itqan_logo_square.png',
  },

  alternates: {
    canonical: SITE_URL,
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },

  formatDetection: {
    email: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAF6F0' },
    { media: '(prefers-color-scheme: dark)',  color: '#122A20' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="olive">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&family=Scheherazade+New:wght@400;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
