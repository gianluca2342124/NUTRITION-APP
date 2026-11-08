import { formatNumber, topFactors, type FudyuScoreResult, type ScoreFactor, type ScoreLevel } from '@repo/core';
import { format } from '@repo/i18n';
import { LOCALE, t } from '@/lib/site';

const TONES: Record<ScoreLevel, { fill: string; soft: string; text: string }> = {
  excellent: { fill: 'var(--fy-scale-green)', soft: 'var(--fy-scale-green-soft)', text: 'var(--fy-scale-green-text)' },
  good: { fill: 'var(--fy-scale-lime)', soft: 'var(--fy-scale-lime-soft)', text: 'var(--fy-scale-lime-text)' },
  fair: { fill: 'var(--fy-scale-amber)', soft: 'var(--fy-scale-amber-soft)', text: 'var(--fy-scale-amber-text)' },
  poor: { fill: 'var(--fy-scale-orange)', soft: 'var(--fy-scale-orange-soft)', text: 'var(--fy-scale-orange-text)' },
  limit: { fill: 'var(--fy-scale-coral)', soft: 'var(--fy-scale-coral-soft)', text: 'var(--fy-scale-coral-text)' },
};

export function scoreTone(level: ScoreLevel) {
  return TONES[level];
}

/** Big ring in the level colour; "Sin puntuación" when the data is not enough. */
export function ScoreRing({ result, size = 180 }: { result: FudyuScoreResult; size?: number }) {
  const scored = result.status === 'scored';
  const tone = scored ? TONES[result.level] : null;
  const stroke = Math.round(size * 0.075);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const label = scored ? t.score.levels[result.level] : t.score.unscored;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        role="img"
        aria-label={scored ? format(t.score.a11y, { score: result.score, level: label }) : `${t.score.title}: ${label}`}
        className="relative flex items-center justify-center rounded-full"
        style={{ width: size, height: size, background: tone?.soft ?? 'var(--fy-surface-muted)' }}
      >
        <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r - stroke * 0.6} fill="var(--fy-surface)" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={scored ? 'var(--fy-surface)' : 'var(--fy-border-strong)'}
            strokeWidth={stroke}
            strokeDasharray={scored ? undefined : '4 8'}
          />
          {scored && result.score > 0 ? (
            <circle
              className="fy-ring-arc"
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={tone!.fill}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - result.score / 100)}
              style={{ ['--fy-ring-from' as string]: `${c}` }}
            />
          ) : null}
        </svg>
        <div className="relative flex flex-col items-center">
          {scored ? (
            <>
              <span className="tabular text-[56px] font-extrabold leading-none tracking-[-0.05em]" style={{ color: tone!.text, fontSize: size * 0.31 }}>
                {result.score}
              </span>
              <span className="mt-1 text-[11px] font-semibold text-faint">{t.score.outOf}</span>
            </>
          ) : (
            <span className="text-[28px] font-bold text-faint">—</span>
          )}
        </div>
      </div>
      <div className="max-w-xs">
        <p className="text-[20px] font-bold tracking-tight" style={{ color: tone?.text ?? 'var(--fy-text-secondary)' }}>
          {label}
        </p>
        <p className="mt-0.5 text-[14px] text-muted">{scored ? t.score.sentences[result.level] : t.score.unscoredReasons[result.reason]}</p>
      </div>
    </div>
  );
}

export function ScoreBadge({ result }: { result: FudyuScoreResult }) {
  if (result.status !== 'scored') {
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-muted">{t.score.unscored}</span>;
  }
  const tone = TONES[result.level];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={{ background: tone.soft, color: tone.text }}
      aria-label={`${t.score.title} ${result.score}: ${t.score.levels[result.level]}`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: tone.fill }} aria-hidden="true" />
      <span className="tabular">{result.score}</span>
      <span className="font-semibold">{t.score.levels[result.level]}</span>
    </span>
  );
}

export function factorText(factor: ScoreFactor, unit: 'g' | 'ml'): { title: string; detail: string | null } {
  const fx = t.score.factors;
  let title: string;
  switch (factor.key) {
    case 'sugars':
    case 'saturated_fat':
    case 'saturated_fat_ratio':
    case 'salt':
    case 'energy':
      title = fx[factor.key][factor.intensity ?? 'high'];
      break;
    case 'additive_not_authorised':
    case 'additive_exposure':
      title = format(fx[factor.key], { codes: (factor.codes ?? []).join(', ') });
      break;
    default:
      title = fx[factor.key];
  }
  let detail: string | null = null;
  if (factor.value != null && factor.unit) {
    detail =
      factor.unit === '%'
        ? `≈ ${formatNumber(factor.value, LOCALE, 0)} %`
        : `${formatNumber(factor.value, LOCALE, factor.unit === 'kcal' ? 0 : 1)} ${factor.unit} ${format(t.score.perUnit, { unit })}`;
  }
  return { title, detail };
}

/** "¿Por qué?" — up to three real, signed reasons. */
export function ScoreReasons({ result, unit }: { result: Extract<FudyuScoreResult, { status: 'scored' }>; unit: 'g' | 'ml' }) {
  const factors = topFactors(result);
  if (!factors.length) return null;
  return (
    <div>
      <p className="text-[16px] font-semibold text-ink">{t.score.why}</p>
      <ul className="mt-3 space-y-3">
        {factors.map((f) => {
          const { title, detail } = factorText(f, unit);
          const positive = f.sign > 0;
          return (
            <li key={f.key} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[17px] font-bold ${positive ? 'bg-scale-green-soft text-scale-green-text' : 'bg-scale-orange-soft text-scale-orange-text'}`}
              >
                {positive ? '+' : '−'}
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ink">
                  <span className="sr-only">{positive ? '+ ' : '− '}</span>
                  {title}
                </span>
                {detail ? <span className="block text-[13px] text-muted">{detail}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
