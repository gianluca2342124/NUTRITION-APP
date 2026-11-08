import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brand } from '@repo/config';
import { themeStylesheet } from '@repo/design';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { siteUrl } from '@/lib/site';
import './globals.css';

// Brand typeface (SIL Open Font License), self-hosted by next/font.
const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${brand.brandName} — ${brand.taglineEs}`, template: `%s · ${brand.brandName}` },
  description: 'Consulta qué contienen los alimentos, compara productos y registra tu nutrición con datos verificables.',
  applicationName: brand.brandName,
  openGraph: { siteName: brand.brandName, locale: 'es_ES', type: 'website' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: brand.backgroundColor },
    { media: '(prefers-color-scheme: dark)', color: '#0A0F1E' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${jakarta.variable} h-full`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStylesheet() }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
