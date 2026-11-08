import { brand } from '@repo/config';
import {
  CHARACTER_VIEWBOX,
  ILLUSTRATION_VIEWBOX,
  MARK_BOWL,
  MARK_BOWL_WIDTH,
  MARK_RADIUS,
  MARK_SEED,
  MARK_VIEWBOX,
  characterShapes,
  illustrationShapes,
  type ArtShape,
  type ArtTone,
  type CharacterExpression,
  type IllustrationKey,
} from '@repo/design';

const TONE: Record<Exclude<ArtTone, 'body'>, string> = {
  face: '#FFFFFF',
  white: '#FFFFFF',
  seed: 'var(--fy-secondary)',
  lime: 'var(--fy-scale-lime)',
  amber: 'var(--fy-scale-amber)',
  primary: 'var(--fy-primary)',
  primaryDeep: 'var(--fy-primary-pressed)',
  tint: 'var(--fy-primary-soft)',
  tintStrong: 'var(--fy-primary-tint)',
};

function color(tone: ArtTone | undefined, gradientId: string): string | undefined {
  if (!tone) return undefined;
  return tone === 'body' ? `url(#${gradientId})` : TONE[tone];
}

function Shapes({ shapes, gradientId }: { shapes: ArtShape[]; gradientId: string }) {
  return shapes.map((s, i) => {
    const common = {
      fill: color(s.fill, gradientId) ?? 'none',
      stroke: color(s.stroke, gradientId),
      strokeWidth: s.sw,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      opacity: s.opacity,
    };
    switch (s.t) {
      case 'circle':
        return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
      case 'ellipse':
        return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined} {...common} />;
      case 'rect':
        return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
      case 'path':
        return <path key={i} d={s.d} {...common} />;
    }
  });
}

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={brand.markGradient[0]} />
        <stop offset="1" stopColor={brand.markGradient[1]} />
      </linearGradient>
    </defs>
  );
}

/** Brand mark (bowl + seed) drawn inline. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`} aria-hidden="true">
      <Gradient id="fy-mark" />
      <rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={MARK_RADIUS} fill="url(#fy-mark)" />
      <path d={MARK_BOWL} fill="none" stroke="#FFFFFF" strokeWidth={MARK_BOWL_WIDTH} strokeLinecap="round" />
      <circle cx={MARK_SEED.cx} cy={MARK_SEED.cy} r={MARK_SEED.r} fill={brand.secondaryColor} />
    </svg>
  );
}

/** The Fudyu character, used sparingly (welcome, empty states, positive moments). */
export function Character({ expression = 'smile', size = 96, className }: { expression?: CharacterExpression; size?: number; className?: string }) {
  const id = `fy-char-${expression}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CHARACTER_VIEWBOX} ${CHARACTER_VIEWBOX}`} aria-hidden="true" className={className}>
      <Gradient id={id} />
      <Shapes shapes={characterShapes(expression)} gradientId={id} />
    </svg>
  );
}

/** Original fallback illustration (food category, meal, product, recipe). */
export function Illustration({ name, className }: { name: IllustrationKey; className?: string }) {
  const id = `fy-ill-${name}`;
  return (
    <div className={`flex items-center justify-center bg-primary-soft ${className ?? ''}`}>
      <svg viewBox={`0 0 ${ILLUSTRATION_VIEWBOX} ${ILLUSTRATION_VIEWBOX}`} aria-hidden="true" className="h-[62%] w-[62%]">
        <Gradient id={id} />
        <Shapes shapes={illustrationShapes(name)} gradientId={id} />
      </svg>
    </div>
  );
}
