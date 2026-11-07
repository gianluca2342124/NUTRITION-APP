import Link from 'next/link';
import { siteUrl } from '@/lib/site';

export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${siteUrl()}${item.href}`,
    })),
  };
  return (
    <nav aria-label="Ruta" className="text-[14px] text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.href} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-ink">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-ink">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </nav>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'primary' | 'warning' | 'success' }) {
  const styles = {
    neutral: 'bg-surface-muted text-muted',
    primary: 'bg-primary-soft text-primary-text',
    warning: 'bg-warning-soft text-warning-text',
    success: 'bg-secondary-soft text-secondary-text',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold ${styles}`}>{children}</span>;
}
