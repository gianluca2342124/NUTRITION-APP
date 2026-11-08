import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  formatNumber,
  topFactors,
  type FudyuScoreResult,
  type PersonalNote,
  type ScoreFactor,
  type ScoreLevel,
  type AdditiveInfo,
} from '@repo/core';
import { scaleTone } from '@repo/design';
import { Icon } from './icons';
import { useCountUp } from './motion';
import { Text } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * The Fudyu Score as the brand's signature: a big number in the level colour,
 * the level in bold capitals and a ring that fills on reveal, on a soft tint.
 * Unscored products show "Sin puntuación" — never a made-up number.
 */
export function ScoreDial({ result, size = 138 }: { result: FudyuScoreResult; size?: number }) {
  const p = usePalette();
  const { t, f } = useT();
  const scored = result.status === 'scored';
  const shown = useCountUp(scored ? result.score : null);
  const tone = scored ? scaleTone(p, result.level) : null;
  const stroke = Math.round(size * 0.08);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = scored && shown != null ? Math.max(0, Math.min(1, shown / 100)) : 0;
  const label = scored ? t.score.levels[result.level] : t.score.unscored;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={scored ? f(t.score.a11y, { score: result.score, level: label }) : `${t.score.title}: ${label}`}
      style={{ alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.lg, backgroundColor: tone?.soft ?? p.surfaceMuted }}
    >
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={scored ? 'rgba(255,255,255,0.75)' : p.borderStrong} strokeWidth={stroke} strokeDasharray={scored ? undefined : '4 8'} fill="none" />
          {scored && progress > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={tone!.fill}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - progress)}
              fill="none"
            />
          ) : null}
        </Svg>
        {scored ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text variant="score" style={{ color: tone!.strong, fontVariant: ['tabular-nums'], fontSize: size * 0.4, lineHeight: size * 0.42 }}>
              {Math.round(shown ?? result.score)}
            </Text>
            <Text variant="secondaryStrong" style={{ color: tone!.text, marginBottom: size * 0.05, marginLeft: 1 }}>
              /100
            </Text>
          </View>
        ) : (
          <Text variant="title" color="textTertiary">
            —
          </Text>
        )}
      </View>
      <Text variant="section" align="center" style={{ color: tone?.strong ?? p.textSecondary, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {!scored ? (
        <Text variant="caption" color="textSecondary" align="center" numberOfLines={3} style={{ maxWidth: 200 }}>
          {t.score.unscoredReasons[result.reason]}
        </Text>
      ) : null}
    </View>
  );
}

/** @deprecated Kept for compatibility; prefer ScoreDial. */
export const FudyuScoreRing = ScoreDial;

/** Compact score for lists and comparisons. */
export function ScoreBadge({ score, level, compact }: { score: number | null; level: ScoreLevel | null; compact?: boolean }) {
  const p = usePalette();
  const { t } = useT();
  const tone = level ? scaleTone(p, level) : null;
  return (
    <View
      accessible
      accessibilityLabel={score == null || !level ? `${t.score.title}: ${t.score.unscored}` : `${t.score.title} ${score}: ${t.score.levels[level]}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 5,
        borderRadius: radius.pill,
        backgroundColor: tone?.soft ?? p.surfaceMuted,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone?.fill ?? p.borderStrong }} />
      <Text variant={compact ? 'caption' : 'secondaryStrong'} style={{ color: tone?.text ?? p.textSecondary, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
        {score == null ? '—' : score}
      </Text>
      {!compact && level ? (
        <Text variant="caption" style={{ color: tone!.text }}>
          {t.score.levels[level]}
        </Text>
      ) : null}
    </View>
  );
}

export function useFactorLabel(unit: 'g' | 'ml' = 'g') {
  const { t, f, locale } = useT();
  return (factor: ScoreFactor): { title: string; detail: string | null } => {
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
        title = f(fx[factor.key], { codes: (factor.codes ?? []).join(', ') });
        break;
      default:
        title = fx[factor.key];
    }
    let detail: string | null = null;
    if (factor.value != null && factor.unit) {
      const digits = factor.unit === 'kcal' ? 0 : 1;
      detail =
        factor.unit === '%'
          ? `≈ ${formatNumber(factor.value, locale, 0)} %`
          : `${formatNumber(factor.value, locale, digits)} ${factor.unit} ${f(t.score.perUnit, { unit })}`;
    }
    return { title, detail };
  };
}

/** The real reasons behind the score, signed (shown in "Análisis completo"). */
export function ScoreExplanation({ result, unit, max = 3 }: { result: Extract<FudyuScoreResult, { status: 'scored' }>; unit: 'g' | 'ml'; max?: number }) {
  const p = usePalette();
  const label = useFactorLabel(unit);
  const factors = topFactors(result, max);
  if (factors.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      {factors.map((factor) => {
        const { title, detail } = label(factor);
        const positive = factor.sign > 0;
        return (
          <View key={factor.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: positive ? p.scaleGreenSoft : p.scaleOrangeSoft,
              }}
            >
              <Icon name={positive ? 'plus' : 'minus'} size={16} color={positive ? p.scaleGreenText : p.scaleOrangeText} strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="secondaryStrong">{title}</Text>
              {detail ? (
                <Text variant="caption" color="textSecondary">
                  {detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** One additive: understandable name first, E-number second, status if any. */
export function AdditiveRow({ info, onPress }: { info: AdditiveInfo; onPress: () => void }) {
  const p = usePalette();
  const { t, locale } = useT();
  const name = (locale === 'en' ? (info.nameEn ?? info.nameEs) : (info.nameEs ?? info.nameEn)) ?? info.eNumber;
  const klass = info.classes[0];
  const status =
    info.euStatus === 'not_authorised'
      ? { text: t.product.notAuthorisedChip, bg: p.scaleCoralSoft, fg: p.scaleCoralText }
      : info.exposureConcern
        ? { text: t.product.exposureChip, bg: p.scaleAmberSoft, fg: p.scaleAmberText }
        : null;
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="secondaryStrong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="textSecondary">
          {[info.eNumber, klass ? (t.additiveClasses[klass as keyof typeof t.additiveClasses] ?? klass) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {status ? (
        <View style={{ backgroundColor: status.bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text variant="micro" style={{ color: status.fg }}>
            {status.text}
          </Text>
        </View>
      ) : null}
      <Icon name="chevronRight" size={16} color={p.textTertiary} />
    </Pressable>
  );
}

/** "Para ti" — personal fit, clearly separate from the score. */
export function PersonalFit({ notes, unit }: { notes: PersonalNote[]; unit: 'g' | 'ml' }) {
  const p = usePalette();
  const { t, f } = useT();
  const shown = notes.filter((n) => n.key !== 'contains_allergen' && n.key !== 'may_contain_allergen');
  if (shown.length === 0) return null;
  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: p.primarySoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        <Icon name="user" size={18} color={p.primaryText} />
        <Text variant="bodyStrong" color="primaryText">
          {t.personal.title}
        </Text>
      </View>
      {shown.map((n) => (
        <Text key={n.key} variant="secondary">
          {f(t.personal[n.key], {
            list: (n.allergens ?? []).map((a) => t.allergens[a].toLowerCase()).join(', '),
            value: n.value ?? '',
            unit,
          })}
        </Text>
      ))}
      <Text variant="caption" color="textSecondary">
        {t.personal.basedOn}
      </Text>
    </View>
  );
}
