import { brand } from '@repo/config';

/** Brand mark (bowl + seed) drawn inline so it inherits no external assets. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
        <linearGradient id="fy-mark-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B6EFF" />
          <stop offset="1" stopColor="#1E4FE6" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="236" fill="url(#fy-mark-bg)" />
      <path d="M286 488 A226 226 0 0 0 738 488" fill="none" stroke="#FFFFFF" strokeWidth="100" strokeLinecap="round" />
      <circle cx="610" cy="326" r="78" fill="#17C995" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={30} />
      <span className="text-[22px] font-extrabold tracking-[-0.04em] text-ink">{brand.wordmark}</span>
    </span>
  );
}
