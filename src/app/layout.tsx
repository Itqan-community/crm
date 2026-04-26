import type { Metadata, Viewport } from 'next';
import { Rubik, IBM_Plex_Sans_Arabic, Scheherazade_New } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

// Self-host the three fonts referenced by our theme tokens so we drop the
// render-blocking <link> to fonts.googleapis.com and pick up Next.js's
// font-display optimisation (no FOUT) automatically. The CSS variables
// below are consumed by globals.css via var(--font-rubik) etc.
const rubik = Rubik({
  subsets: ['latin', 'arabic'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-rubik',
  display: 'swap',
});

const ibmPlex = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-ibm-plex-arabic',
  display: 'swap',
});

const scheherazade = Scheherazade_New({
  subsets: ['arabic'],
  weight: ['400', '600', '700'],
  variable: '--font-scheherazade',
  display: 'swap',
});

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
  // viewport-fit=cover lets the page render under the iPhone notch /
  // Dynamic Island and the home-indicator strip; we then opt back into
  // safe areas explicitly via env(safe-area-inset-*) on the sticky bottom
  // nav (see .safe-bottom in globals.css). Without cover, iOS auto-pads
  // the layout and our sticky nav still lands behind the home indicator.
  viewportFit: 'cover',
  // Tell Chrome/Edge to shrink the layout viewport when the soft keyboard
  // opens so our sticky bottom nav lands above the keyboard instead of
  // hiding behind it. Safari ignores this key and relies on the
  // visualViewport listener in FormFlow instead; both cooperate without
  // conflict.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme="olive"
      className={`${rubik.variable} ${ibmPlex.variable} ${scheherazade.variable}`}
    >
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
