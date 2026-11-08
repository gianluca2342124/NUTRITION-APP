import type { Metadata } from 'next';
import Link from 'next/link';
import { CURATED_FOOD_IMAGES } from '@repo/data';
import { t } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Créditos de imágenes',
  description: 'Autoría y licencias de las fotografías reutilizadas en Fudyu.',
  alternates: { canonical: '/creditos' },
};

/** Attribution for every reused photo (title, author, source, licence, changes). */
export default function CreditsPage() {
  const entries = Object.entries(CURATED_FOOD_IMAGES).sort(([a], [b]) => a.localeCompare(b));
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="text-[38px] font-extrabold tracking-[-0.03em] text-ink">{t.web.creditsTitle}</h1>
      <p className="mt-3 text-[16px] text-muted">{t.web.creditsBody}</p>
      <ul className="card mt-8 divide-y divide-line p-0">
        {entries.map(([slug, image]) => (
          <li key={slug} className="px-5 py-4 text-[14px]">
            <Link href={`/ingredients/${slug}`} className="font-semibold text-ink hover:underline">
              {slug.replace(/-/g, ' ')}
            </Link>
            <p className="mt-1 text-muted">
              «
              <a href={image.credit.sourceUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener">
                {image.credit.title}
              </a>
              » · {image.credit.author} ·{' '}
              {image.credit.licenseUrl ? (
                <a href={image.credit.licenseUrl} className="underline underline-offset-2 hover:text-ink" rel="noopener license">
                  {image.credit.license}
                </a>
              ) : (
                image.credit.license
              )}{' '}
              · {image.credit.source} · recortada y redimensionada
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[13px] text-faint">Fotos de productos: Open Food Facts (CC BY-SA), mostradas en cada ficha.</p>
    </article>
  );
}
