import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { computeFudyuScore, FUDYU_SCORE_VERSION, formatNumber, localizedName, normalizeBarcode, quantityLabel, scoreInputFromProduct, shareFacts, type NutrientKey } from '@repo/core';
import { getProductByGtin } from '@repo/data';
import { MARK_BOWL, MARK_BOWL_WIDTH, MARK_RADIUS, MARK_SEED, MARK_VIEWBOX, palettes, scaleTone } from '@repo/design';
import { format } from '@repo/i18n';
import { handler, json, rateLimit } from '@/server/http';
import { supabaseConfigured } from '@/server/env';
import { publicClient } from '@/server/supabase';
import { LOCALE, t } from '@/lib/site';

/**
 * Vertical (9:16) share card for a product, made only of real data: the
 * product's own photo, name and brand, the Fudyu Score when it is backed by
 * the data (or "Sin puntuación"), three nutrition facts and the sources.
 */
const W = 1080;
const H = 1920;
const P = palettes.light;
const UNITS: Record<NutrientKey, string> = {
  energy_kcal: 'kcal',
  protein_g: 'g',
  carbs_g: 'g',
  sugars_g: 'g',
  fat_g: 'g',
  saturated_fat_g: 'g',
  fiber_g: 'g',
  salt_g: 'g',
};

let fonts: Promise<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: 'normal' }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([
      [500, 'PlusJakartaSans_500Medium.ttf'],
      [700, 'PlusJakartaSans_700Bold.ttf'],
      [800, 'PlusJakartaSans_800ExtraBold.ttf'],
    ] as const).map(async ([weight, file]) => ({
      name: 'Jakarta',
      data: await readFile(join(process.cwd(), 'assets/fonts', file)),
      weight,
      style: 'normal' as const,
    })),
  );
  return fonts;
}

/** The product's real photo as a data URL, or null (never a stand-in photo). */
async function productPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4_000_000) return null;
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export const GET = handler(async (request: Request, ctx: { params: Promise<{ code: string }> }) => {
  rateLimit(request, 'share-card', 30);
  const { code } = await ctx.params;
  const gtin = normalizeBarcode(decodeURIComponent(code));
  if (!gtin || !supabaseConfigured()) return json({ error: { code: 'not_found', message: 'Product not found' } }, { status: 404 });
  const product = await getProductByGtin(publicClient(), gtin);
  if (!product) return json({ error: { code: 'not_found', message: 'Product not found' } }, { status: 404 });

  const [fontData, photo] = await Promise.all([loadFonts(), productPhoto(product.imageUrl)]);
  const score = computeFudyuScore(scoreInputFromProduct(product));
  const scored = score.status === 'scored';
  const tone = scored ? scaleTone(P, score.level) : null;
  const name = localizedName(product, LOCALE) ?? product.gtin;
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const facts = shareFacts(product.nutrientsPer100, score);
  const ring = 236;
  const stroke = 22;
  const r = (ring - stroke) / 2;
  const c = 2 * Math.PI * r;
  const digits = (k: NutrientKey, v: number) => (k === 'energy_kcal' ? 0 : k === 'salt_g' && v < 1 ? 2 : 1);

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: P.background, padding: '72px 72px 60px', fontFamily: 'Jakarta', color: P.ink }}>
        {/* Discreet brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="52" height="52" viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}>
            <rect x="0" y="0" width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={MARK_RADIUS} fill={P.primary} />
            <path d={MARK_BOWL} stroke="#FFFFFF" strokeWidth={MARK_BOWL_WIDTH} strokeLinecap="round" fill="none" />
            <circle cx={MARK_SEED.cx} cy={MARK_SEED.cy} r={MARK_SEED.r} fill={P.secondary} />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>fudyu</div>
        </div>

        {/* The product's own photo */}
        <div style={{ marginTop: 44, height: 720, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', borderRadius: 56, boxShadow: '0 20px 60px rgba(23,32,51,0.10)' }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" style={{ maxWidth: 600, maxHeight: 600, objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', fontSize: 34, color: P.textTertiary }}>{t.share.noPhoto}</div>
          )}
        </div>

        <div style={{ marginTop: 40, display: 'flex', fontSize: 66, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>{name.length > 60 ? `${name.slice(0, 58)}…` : name}</div>
        <div style={{ marginTop: 12, display: 'flex', fontSize: 36, fontWeight: 500, color: P.textSecondary }}>{[product.brand, quantityLabel(product.quantityText)].filter(Boolean).join(' · ')}</div>

        {/* Score and level, or an honest "Sin puntuación" */}
        <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', gap: 40, padding: 32, borderRadius: 48, background: tone?.soft ?? P.surfaceMuted }}>
          <div style={{ width: ring, height: ring, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <svg width={ring} height={ring} style={{ position: 'absolute', top: 0, left: 0 }}>
              <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke={scored ? 'rgba(255,255,255,0.8)' : P.borderStrong} strokeWidth={stroke} strokeDasharray={scored ? undefined : '6 14'} />
              {scored && score.score > 0 ? (
                <circle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={r}
                  fill="none"
                  stroke={tone!.fill}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${(c * score.score) / 100} ${c}`}
                  transform={`rotate(-90 ${ring / 2} ${ring / 2})`}
                />
              ) : null}
            </svg>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ fontSize: 104, fontWeight: 800, color: tone?.strong ?? P.textTertiary, letterSpacing: -4, lineHeight: 1 }}>{scored ? String(score.score) : '—'}</div>
              {scored ? <div style={{ fontSize: 30, fontWeight: 700, color: tone!.text, marginBottom: 12, marginLeft: 2 }}>/100</div> : null}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 3, color: tone?.text ?? P.textSecondary }}>FUDYU SCORE</div>
            <div style={{ marginTop: 6, fontSize: scored ? 66 : 50, fontWeight: 800, letterSpacing: 1, color: tone?.strong ?? P.textSecondary }}>
              {(scored ? t.score.levels[score.level] : t.score.unscored).toUpperCase()}
            </div>
            {!scored ? <div style={{ marginTop: 8, fontSize: 28, color: P.textSecondary }}>{t.score.unscoredReasons[score.reason]}</div> : null}
          </div>
        </div>

        {/* Three facts */}
        <div style={{ marginTop: 24, display: 'flex', gap: 20 }}>
          {facts.map((k) => {
            const v = product.nutrientsPer100[k]!;
            return (
              <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 26px', borderRadius: 32, background: '#FFFFFF' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1.5, color: P.textSecondary }}>{t.stats.labels[k].toUpperCase()}</div>
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1 }}>{formatNumber(v, LOCALE, digits(k, v))}</div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: P.textSecondary, marginLeft: 8, marginBottom: 8 }}>{UNITS[k]}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, display: 'flex', fontSize: 28, color: P.textSecondary }}>{unit === 'ml' ? t.stats.per100ml : t.stats.per100g}</div>

        {/* Sources, readable */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 500, color: P.textSecondary }}>
            {t.share.sources}
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: P.textTertiary }}>{format(t.share.disclaimer, { version: FUDYU_SCORE_VERSION })}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: fontData,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
    },
  );
});
