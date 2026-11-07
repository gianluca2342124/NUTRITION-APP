import Link from 'next/link';
import { Logo } from './logo';
import { t } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Inicio" className="rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-[15px] font-medium text-muted">
          <Link href="/search" className="rounded-full px-3 py-2 hover:bg-surface-muted hover:text-ink">
            {t.web.explore}
          </Link>
          <Link
            href="/#app"
            className="ml-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 font-semibold text-on-primary shadow-sm hover:bg-primary-pressed"
          >
            <span className="hidden sm:inline">{t.web.getApp}</span>
            <span className="sm:hidden">App</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
