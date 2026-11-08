import Link from 'next/link';
import { Logo } from './logo';
import { t } from '@/lib/site';

export function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-30 border-b border-line">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Inicio" className="shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex min-w-0 items-center gap-1 text-[15px] font-medium text-muted">
          <Link href="/search" className="rounded-full px-3 py-2 hover:bg-surface-muted hover:text-ink">
            {t.web.explore}
          </Link>
          <Link href="/recetas" className="rounded-full px-3 py-2 hover:bg-surface-muted hover:text-ink">
            {t.web.recipes}
          </Link>
          <form action="/search" method="get" role="search" className="ml-2 hidden lg:block">
            <label htmlFor="header-q" className="sr-only">
              {t.common.search}
            </label>
            <input
              id="header-q"
              name="q"
              type="search"
              minLength={2}
              required
              placeholder={t.common.search}
              className="h-10 w-52 rounded-full border border-line bg-surface px-4 text-[14px] text-ink outline-none placeholder:text-faint focus:border-primary focus:ring-4 focus:ring-primary-soft"
            />
          </form>
          <Link
            href="/#app"
            className="ml-1 whitespace-nowrap rounded-full bg-primary px-4 py-2 font-semibold text-on-primary shadow-sm hover:bg-primary-pressed"
          >
            <span className="hidden sm:inline">{t.web.getApp}</span>
            <span className="sm:hidden">{t.web.getAppShort}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
