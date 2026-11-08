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
 * The Fudyu Score at a glance: big ring in the level colour on a soft tinted
 * disc, the number counting up to its real value, and a human label.
 * Unscored products show "Sin puntuación" — never a made-up number.
 */
export function FudyuScoreRing({ result, size = 176 }: { result: FudyuScoreResult; size?: number }) {
  const p = usePalette();
  const { t, f } = useT();
  const scored = result.status === 'scored';
  const shown = useCountUp(scored ? result.score : null);
  const tone = scored ? scaleTone(p, result.level) : null;
  const stroke = Math.round(size * 0.075);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = scored && shown != null ? Math.max(0, Math.min(1, shown / 100)) : 0;
  const label = scored ? t.score.levels[result.level] : t.score.unscored;

  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={scored ? f(t.score.a11y, { score: result.score, level: label }) : `${t.score.title}: ${label}`}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone?.soft ?? p.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}
      >
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r - stroke * 0.6} fill={p.surface} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={scored ? p.surface : p.borderStrong}
            strokeOpacity={scored ? 0.9 : 1}
            strokeWidth={stroke}
            strokeDasharray={scored ? undefined : '4 8'}
            fill="none"
          />
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
          <>
            <Text variant="hero" style={{ color: tone!.text, fontVariant: ['tabular-nums'] }}>
              {Math.round(shown ?? result.score)}
            </Text>
            <Text variant="micro" color="textTertiary" style={{ marginTop: -4 }}>
              {t.score.outOf}
            </Text>
          </>
        ) : (
          <Text variant="title" color="textTertiary">
            —
          </Text>
        )}
      </View>
      <View style={{ alignItems: 'center', gap: 2, paddingHorizontal: space.md }}>
        <Text variant="section" style={{ color: tone?.text ?? p.textSecondary }} align="center">
          {label}
        </Text>
        <Text variant="secondary" color="textSecondary" align="center">
          {scored ? t.score.sentences[result.level] : t.score.unscoredReasons[result.reason]}
        </Text>
      </View>
    </View>
  );
}

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

/** "¿Por qué?" — the 2–3 real reasons behind the score, signed. */
export function ScoreExplanation({ result, unit }: { result: Extract<FudyuScoreResult, { status: 'scored' }>; unit: 'g' | 'ml' }) {
  const p = usePalette();
  const { t } = useT();
  const label = useFactorLabel(unit);
  const factors = topFactors(result);
  if (factors.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="bodyStrong">{t.score.why}</Text>
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
