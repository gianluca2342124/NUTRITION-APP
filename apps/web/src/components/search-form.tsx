import { t } from '@/lib/site';

/** Progressive-enhancement search: a plain GET form, works without JavaScript. */
export function SearchForm({ defaultValue = '', size = 'lg' }: { defaultValue?: string; size?: 'lg' | 'md' }) {
  const big = size === 'lg';
  return (
    <form action="/search" method="get" role="search" className="w-full">
      <label htmlFor="q" className="sr-only">
        {t.common.search}
      </label>
      <div
        className={`card flex items-center gap-3 rounded-full! pl-5 pr-2 focus-within:ring-4 focus-within:ring-primary-soft ${big ? 'h-16' : 'h-13'}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0 text-faint">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultValue}
          minLength={2}
          maxLength={80}
          required
          autoComplete="off"
          placeholder={t.web.searchPlaceholder}
          className={`min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint ${big ? 'text-[17px]' : 'text-[16px]'}`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-primary font-semibold text-on-primary hover:bg-primary-pressed ${big ? 'h-12 px-6 text-[16px]' : 'h-10 px-5 text-[15px]'}`}
        >
          {t.common.search}
        </button>
      </div>
    </form>
  );
}
