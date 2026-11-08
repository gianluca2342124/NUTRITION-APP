import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ACTIVITY_LEVELS,
  ADULT_MIN_AGE,
  BUDGETS,
  COOKING_TIMES,
  DIET_PATTERNS,
  EU_ALLERGENS,
  GOALS,
  SEXES,
  SPAIN_STORES,
  USAGE_MODES,
  computeDailyTargets,
  formatNumber,
  minimumHealthyWeightKg,
  type Goal,
} from '@repo/core';
import type { CharacterExpression } from '@repo/design';
import { BrandMark, FudyuCharacter } from '@/components/art';
import { Icon, type IconName } from '@/components/icons';
import { ProgressBar } from '@/components/rings';
import { Button, Card, Choice, Field, Notice, Row, Text } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useSaveOnboarding } from '@/lib/queries';
import { clearOnboarding, updateOnboarding, useOnboardingAnswers } from '@/lib/stores';
import { space, usePalette } from '@/lib/theme';

type StepId = 'welcome' | 'goals' | 'primary' | 'health' | 'about' | 'body' | 'activity' | 'food' | 'likes' | 'habits' | 'where' | 'summary';

const toggle = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function Onboarding() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const a = useOnboardingAnswers();
  const save = useSaveOnboarding();
  const [step, setStep] = useState<StepId>('welcome');
  const [history, setHistory] = useState<StepId[]>([]);
  const [likeDraft, setLikeDraft] = useState('');
  const [dislikeDraft, setDislikeDraft] = useState('');

  const isMinor = a.ageYears != null && a.ageYears < ADULT_MIN_AGE;
  const flow = useMemo<StepId[]>(() => {
    const steps: StepId[] = ['welcome', 'goals'];
    if (a.goals.length > 1) steps.push('primary');
    steps.push('health');
    if (a.healthDataConsent) {
      steps.push('about');
      if (!isMinor) steps.push('body', 'activity');
    }
    steps.push('food', 'likes', 'habits', 'where', 'summary');
    return steps;
  }, [a.goals.length, a.healthDataConsent, isMinor]);

  const index = Math.max(0, flow.indexOf(step));
  const go = (next: StepId | undefined) => {
    if (!next) return;
    setHistory((h) => [...h, step]);
    setStep(next);
  };
  const next = () => go(flow[index + 1]);
  const back = () => {
    const prev = history[history.length - 1];
    if (prev) {
      setHistory((h) => h.slice(0, -1));
      setStep(prev);
    }
  };

  const minWeight = a.heightCm ? minimumHealthyWeightKg(a.heightCm) : null;
  const targetTooLow = a.targetWeightKg != null && minWeight != null && a.targetWeightKg < minWeight;
  const targets = computeDailyTargets(
    { sex: a.sex ?? undefined, ageYears: a.ageYears ?? undefined, heightCm: a.heightCm ?? undefined, weightKg: a.weightKg ?? undefined, activity: a.activity ?? undefined },
    a.primaryGoal,
  );

  const canContinue: Record<StepId, boolean> = {
    welcome: true,
    goals: a.goals.length > 0,
    primary: a.goals.includes(a.primaryGoal),
    health: true,
    about: a.ageYears != null && a.ageYears >= 13 && a.ageYears <= 110 && (isMinor || a.sex != null),
    body: a.heightCm != null && a.weightKg != null && !targetTooLow,
    activity: a.activity != null,
    food: true,
    likes: true,
    habits: true,
    where: true,
    summary: true,
  };

  const finish = async () => {
    try {
      await save.mutateAsync({ ...a, healthDataConsent: a.healthDataConsent && !isMinor });
      clearOnboarding();
      router.replace('/');
    } catch {
      // Error shown below from mutation state.
    }
  };

  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) ? n : null;
  };

  let body: ReactNode;
  switch (step) {
    case 'welcome':
      body = (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.lg }}>
          <FudyuCharacter expression="smile" size={148} />
          <Text variant="largeTitle" align="center">
            {t.onboarding.welcomeTitle}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 300 }}>
            {t.onboarding.welcomeBody}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm }}>
            <BrandMark size={22} />
            <Text variant="bodyStrong" color="textSecondary">
              fudyu
            </Text>
          </View>
        </View>
      );
      break;
    case 'goals':
      body = (
        <Question title={t.onboarding.goalsTitle} hint={t.onboarding.goalsHint} expression="curious">
          {GOALS.map((g) => (
            <Choice
              key={g}
              label={t.goals[g]}
              selected={a.goals.includes(g)}
              onPress={() => {
                const goals = toggle(a.goals, g);
                updateOnboarding({ goals, primaryGoal: goals.includes(a.primaryGoal) ? a.primaryGoal : (goals[0] ?? 'eat_balanced') });
              }}
            />
          ))}
        </Question>
      );
      break;
    case 'primary':
      body = (
        <Question title={t.onboarding.primaryGoalTitle}>
          {a.goals.map((g: Goal) => (
            <Choice key={g} label={t.goals[g]} selected={a.primaryGoal === g} onPress={() => updateOnboarding({ primaryGoal: g })} />
          ))}
        </Question>
      );
      break;
    case 'health':
      body = (
        <Question title={t.onboarding.healthIntroTitle} hint={t.onboarding.healthIntroBody} expression="thinking">
          <Choice label={t.onboarding.healthConsent} selected={a.healthDataConsent} onPress={() => updateOnboarding({ healthDataConsent: !a.healthDataConsent })} />
          <Choice
            label={t.onboarding.healthSkip}
            selected={!a.healthDataConsent}
            onPress={() => updateOnboarding({ healthDataConsent: false, ageYears: null, sex: null, heightCm: null, weightKg: null, targetWeightKg: null, activity: null })}
          />
        </Question>
      );
      break;
    case 'about':
      body = (
        <Question title={t.onboarding.aboutTitle} expression="smile">
          <Field
            label={t.onboarding.ageTitle}
            keyboardType="number-pad"
            value={a.ageYears?.toString() ?? ''}
            onChangeText={(v) => updateOnboarding({ ageYears: num(v) })}
            suffix={locale === 'es' ? 'años' : 'years'}
            accessibilityLabel={t.onboarding.ageTitle}
          />
          {isMinor ? (
            <Notice tone="info" text={t.onboarding.minorNotice} />
          ) : (
            <>
              <Text variant="secondaryStrong" color="textSecondary" style={{ marginTop: space.sm }}>
                {t.onboarding.sexTitle}
              </Text>
              <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                {SEXES.map((sx) => (
                  <Choice key={sx} compact label={t.sex[sx]} selected={a.sex === sx} onPress={() => updateOnboarding({ sex: sx })} />
                ))}
              </Row>
              <Text variant="caption" color="textTertiary">
                {t.onboarding.sexHint}
              </Text>
            </>
          )}
        </Question>
      );
      break;
    case 'body':
      body = (
        <Question title={t.onboarding.bodyTitle} expression="thinking">
          <Field label={t.onboarding.height} keyboardType="decimal-pad" value={a.heightCm?.toString() ?? ''} onChangeText={(v) => updateOnboarding({ heightCm: num(v) })} suffix="cm" />
          <Field label={t.onboarding.weight} keyboardType="decimal-pad" value={a.weightKg?.toString() ?? ''} onChangeText={(v) => updateOnboarding({ weightKg: num(v) })} suffix="kg" />
          {(a.goals.includes('lose_weight') || a.goals.includes('gain_weight')) && (
            <Field
              label={`${t.onboarding.targetWeight} · ${t.common.optional}`}
              keyboardType="decimal-pad"
              value={a.targetWeightKg?.toString() ?? ''}
              onChangeText={(v) => updateOnboarding({ targetWeightKg: num(v) })}
              suffix="kg"
            />
          )}
          {targetTooLow && minWeight != null && <Notice tone="warning" text={f(t.onboarding.targetWeightTooLow, { min: formatNumber(minWeight, locale, 1) })} />}
        </Question>
      );
      break;
    case 'activity':
      body = (
        <Question title={t.onboarding.activityTitle} expression="smile">
          {ACTIVITY_LEVELS.map((lvl) => (
            <Choice key={lvl} label={t.activity[lvl]} hint={t.activity[`${lvl}Hint`]} selected={a.activity === lvl} onPress={() => updateOnboarding({ activity: lvl })} />
          ))}
          <Text variant="secondaryStrong" color="textSecondary" style={{ marginTop: space.md }}>
            {t.onboarding.workoutsTitle}
          </Text>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Choice key={n} compact label={String(n)} selected={a.weeklyWorkouts === n} onPress={() => updateOnboarding({ weeklyWorkouts: n })} />
            ))}
          </Row>
        </Question>
      );
      break;
    case 'food':
      body = (
        <Question title={t.onboarding.dietTitle} expression="attention">
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {DIET_PATTERNS.map((d) => (
              <Choice key={d} compact label={t.diet[d]} selected={a.diet === d} onPress={() => updateOnboarding({ diet: d })} />
            ))}
          </Row>
          <Text variant="section" style={{ marginTop: space.lg }}>
            {t.onboarding.allergiesTitle}
          </Text>
          <Text variant="secondary" color="textSecondary">
            {t.onboarding.allergiesHint}
          </Text>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {EU_ALLERGENS.map((al) => (
              <Choice key={al} compact label={t.allergens[al]} selected={a.allergies.includes(al)} onPress={() => updateOnboarding({ allergies: toggle(a.allergies, al) })} />
            ))}
          </Row>
        </Question>
      );
      break;
    case 'likes':
      body = (
        <Question title={t.onboarding.likesTitle} expression="smile">
          <TagInput
            value={likeDraft}
            onChange={setLikeDraft}
            tags={a.likes}
            placeholder={t.onboarding.likesPlaceholder}
            addLabel={t.common.add}
            onAdd={(v) => updateOnboarding({ likes: Array.from(new Set([...a.likes, v])).slice(0, 20) })}
            onRemove={(v) => updateOnboarding({ likes: a.likes.filter((x) => x !== v) })}
          />
          <Text variant="section" style={{ marginTop: space.lg }}>
            {t.onboarding.dislikesTitle}
          </Text>
          <TagInput
            value={dislikeDraft}
            onChange={setDislikeDraft}
            tags={a.dislikes}
            placeholder={t.onboarding.likesPlaceholder}
            addLabel={t.common.add}
            onAdd={(v) => updateOnboarding({ dislikes: Array.from(new Set([...a.dislikes, v])).slice(0, 20) })}
            onRemove={(v) => updateOnboarding({ dislikes: a.dislikes.filter((x) => x !== v) })}
          />
        </Question>
      );
      break;
    case 'habits':
      body = (
        <Question title={t.onboarding.mealsTitle} expression="thinking">
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {[2, 3, 4, 5, 6].map((n) => (
              <Choice key={n} compact label={String(n)} selected={a.mealsPerDay === n} onPress={() => updateOnboarding({ mealsPerDay: n })} />
            ))}
          </Row>
          <Text variant="section" style={{ marginTop: space.lg }}>
            {t.onboarding.cookingTitle}
          </Text>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {COOKING_TIMES.map((c) => (
              <Choice key={c} compact label={t.cooking[c]} selected={a.cookingTime === c} onPress={() => updateOnboarding({ cookingTime: c })} />
            ))}
          </Row>
          <Text variant="section" style={{ marginTop: space.lg }}>
            {t.onboarding.budgetTitle}
          </Text>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {BUDGETS.map((b) => (
              <Choice key={b} compact label={t.budget[b]} selected={a.budget === b} onPress={() => updateOnboarding({ budget: b })} />
            ))}
          </Row>
        </Question>
      );
      break;
    case 'where':
      body = (
        <Question title={t.onboarding.usageTitle} expression="curious">
          {USAGE_MODES.map((u) => (
            <Choice key={u} label={t.usage[u]} selected={a.usage.includes(u)} onPress={() => updateOnboarding({ usage: toggle(a.usage, u) })} />
          ))}
          <Text variant="section" style={{ marginTop: space.lg }}>
            {t.onboarding.countryTitle}
          </Text>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {(['ES', 'PT', 'FR', 'IT', 'DE', 'GB', 'US', 'MX'] as const).map((c) => (
              <Choice key={c} compact label={c} selected={a.country === c} onPress={() => updateOnboarding({ country: c })} />
            ))}
          </Row>
          <Field label={`${t.onboarding.region} · ${t.common.optional}`} value={a.region ?? ''} onChangeText={(v) => updateOnboarding({ region: v.trim() ? v.slice(0, 60) : null })} />
          {a.country === 'ES' && (
            <>
              <Text variant="section" style={{ marginTop: space.lg }}>
                {t.onboarding.storesTitle}
              </Text>
              <Text variant="secondary" color="textSecondary">
                {t.onboarding.storesHint}
              </Text>
              <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
                {SPAIN_STORES.map((s) => (
                  <Choice key={s} compact label={s.charAt(0).toUpperCase() + s.slice(1)} selected={a.stores.includes(s)} onPress={() => updateOnboarding({ stores: toggle(a.stores, s) })} />
                ))}
              </Row>
            </>
          )}
        </Question>
      );
      break;
    case 'summary': {
      const prefs = [a.diet ? t.diet[a.diet] : null, ...a.usage.slice(0, 2).map((u) => t.usage[u])].filter(Boolean).join(' · ');
      body = (
        <View style={{ gap: space.md, alignItems: 'stretch' }}>
          <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.md }}>
            <FudyuCharacter expression="celebrate" size={112} />
            <Text variant="largeTitle" align="center">
              {t.onboarding.summaryTitle}
            </Text>
            <Text variant="body" color="textSecondary" align="center">
              {t.onboarding.summarySubtitle}
            </Text>
          </View>
          <SummaryRow icon="leaf" label={t.onboarding.summaryGoal} value={t.goals[a.primaryGoal]} />
          <SummaryRow
            icon="heart"
            label={t.onboarding.summaryPreferences}
            value={prefs || t.onboarding.summaryNoPreferences}
            note={a.allergies.length ? f(t.onboarding.summaryAllergies, { list: a.allergies.map((x) => t.allergens[x].toLowerCase()).join(', ') }) : undefined}
          />
          <SummaryRow icon="scan" label={t.onboarding.summaryFirstAction} value={t.onboarding.summaryFirstActionBody} />
          {targets.status === 'ok' && a.healthDataConsent && !isMinor ? (
            <View style={{ gap: space.xs }}>
              <Text variant="caption" color="textSecondary" align="center">
                {f(t.onboarding.summaryTargetLine, { kcal: formatNumber(targets.energyKcal ?? 0, locale) })}
              </Text>
              {targets.notes.map((n) => (
                <Notice key={n} tone="info" text={t.onboarding.targetNotes[n]} />
              ))}
            </View>
          ) : (
            <Text variant="caption" color="textSecondary" align="center">
              {isMinor ? t.onboarding.minorNotice : t.onboarding.summaryNoTargets}
            </Text>
          )}
          {save.isError && <Notice tone="error" text={errorMessage(save.error, t)} />}
        </View>
      );
      break;
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: p.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step !== 'welcome' && (
          <View style={{ paddingHorizontal: space.md, paddingTop: space.sm, gap: space.xs }}>
            <ProgressBar progress={index / (flow.length - 1)} color={p.primary} height={6} />
            <Text variant="caption" color="textTertiary">
              {f(t.onboarding.progress, { current: index, total: flow.length - 1 })}
            </Text>
          </View>
        )}
        <ScrollView key={step} contentContainerStyle={{ flexGrow: 1, padding: space.md, gap: space.sm }} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
        <View style={{ padding: space.md, gap: space.xs }}>
          {step === 'summary' ? (
            <Button title={t.onboarding.finish} onPress={finish} loading={save.isPending} />
          ) : (
            <Button title={step === 'welcome' ? t.onboarding.start : t.common.continue} onPress={next} disabled={!canContinue[step]} />
          )}
          {history.length > 0 && <Button title={t.common.back} variant="ghost" size="md" onPress={back} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Question({ title, hint, children, expression }: { title: string; hint?: string; children: ReactNode; expression?: CharacterExpression }) {
  return (
    <View style={{ gap: space.sm }}>
      {expression ? <FudyuCharacter expression={expression} size={56} style={{ marginTop: space.sm }} /> : null}
      <Text variant="title" style={{ marginTop: space.sm }}>
        {title}
      </Text>
      {hint ? (
        <Text variant="body" color="textSecondary" style={{ marginBottom: space.xs }}>
          {hint}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function TagInput({
  value,
  onChange,
  tags,
  placeholder,
  addLabel,
  onAdd,
  onRemove,
}: {
  value: string;
  onChange: (v: string) => void;
  tags: string[];
  placeholder: string;
  addLabel: string;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const submit = () => {
    const v = value.trim().slice(0, 40);
    if (v) onAdd(v);
    onChange('');
  };
  return (
    <View style={{ gap: space.xs }}>
      <Row gap={space.xs}>
        <View style={{ flex: 1 }}>
          <Field value={value} onChangeText={onChange} placeholder={placeholder} onSubmitEditing={submit} returnKeyType="done" />
        </View>
        <Button title={addLabel} size="md" variant="secondary" onPress={submit} />
      </Row>
      <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
        {tags.map((tag) => (
          <Choice key={tag} compact label={`${tag} ×`} selected onPress={() => onRemove(tag)} />
        ))}
      </Row>
    </View>
  );
}

function SummaryRow({ icon, label, value, note }: { icon: IconName; label: string; value: string; note?: string }) {
  const p = usePalette();
  return (
    <Card style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} color={p.primaryText} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="caption" color="textSecondary">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
        {note ? (
          <Text variant="caption" color="textSecondary">
            {note}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
