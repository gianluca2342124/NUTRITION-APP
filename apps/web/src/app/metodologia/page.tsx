import type { Metadata } from 'next';
import { FUDYU_SCORE_VERSION, SCORE_LEVELS } from '@repo/core';
import { format } from '@repo/i18n';
import { Character } from '@/components/art';
import { scoreTone } from '@/components/score';
import { t } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Cómo se calcula el Fudyu Score',
  description: 'Metodología del Fudyu Score: Nutri-Score 2023, ajustes por procesamiento y aditivos, y qué hacemos cuando faltan datos.',
  alternates: { canonical: '/metodologia' },
};

const RANGES = { excellent: '80–100', good: '60–79', fair: '40–59', poor: '20–39', limit: '0–19' } as const;

export default function MethodologyPage() {
  const m = t.methodology;
  const steps: [string, string][] = [
    [m.step1Title, m.step1Body],
    [m.step2Title, m.step2Body],
    [m.step3Title, m.step3Body],
    [m.personalTitle, m.personalBody],
    [m.sourcesTitle, m.sourcesBody],
  ];
  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Character expression="thinking" size={72} />
      <h1 className="mt-4 text-[38px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[46px]">{t.web.methodologyTitle}</h1>
      <p className="mt-4 text-[18px] leading-relaxed text-muted">{m.intro}</p>
      <section className="card mt-8 p-6">
        <h2 className="text-[17px] font-bold text-ink">{m.levelsTitle}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {SCORE_LEVELS.map((level) => {
            const tone = scoreTone(level);
            return (
              <li key={level} className="flex items-center gap-3">
                <span className="tabular w-20 rounded-full py-1 text-center text-[13px] font-bold" style={{ background: tone.soft, color: tone.text }}>
                  {RANGES[level]}
                </span>
                <span className="text-[15px] font-semibold text-ink">{t.score.levels[level]}</span>
              </li>
            );
          })}
        </ul>
      </section>
      {steps.map(([title, body]) => (
        <section key={title} className="mt-8">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">{title}</h2>
          <p className="mt-2 text-[16px] leading-relaxed text-muted">{body}</p>
        </section>
      ))}
      <p className="mt-10 text-[13px] text-faint">
        {format(m.version, { version: FUDYU_SCORE_VERSION })} · {t.score.disclaimer}
      </p>
    </article>
  );
}
