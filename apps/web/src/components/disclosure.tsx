import type { ReactNode } from 'react';

/** Level-3 detail: native <details>, works without JavaScript and keeps content indexable. */
export function Disclosure({ title, summary, children, open = false }: { title: string; summary?: string | null; children: ReactNode; open?: boolean }) {
  return (
    <details className="card group overflow-hidden p-0" open={open}>
      <summary className="flex items-center gap-3 px-5 py-4 hover:bg-surface-muted/60">
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold text-ink">{title}</span>
          {summary ? <span className="block truncate text-[13px] text-muted group-open:hidden">{summary}</span> : null}
        </span>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="fy-chevron shrink-0 text-faint transition-transform">
          <path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
