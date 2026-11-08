import { brand } from '@repo/config';
import { BrandMark } from './art';

export { BrandMark };

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={30} />
      <span className="text-[22px] font-extrabold tracking-[-0.04em] text-ink">{brand.wordmark}</span>
    </span>
  );
}
