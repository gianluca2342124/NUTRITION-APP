import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { formatNumber, type Basis, type FoodMatch, type NutrientValues } from '@repo/core';
import { communityRecipeNutrition, saveCommunityRecipe, type CommunityRecipe } from '@repo/data';
import { motion } from '@repo/design';
import { FoodPicker } from '@/components/food-picker';
import { MacroLine } from '@/components/nutrition';
import { EditorHeader, ImageSlot, SentForReview } from '@/components/publish';
import { Button, Card, Field, IconButton, Notice, Row, Screen, Skeleton, Text, haptic } from '@/components/ui';
import { pickAndUpload, removeMedia, useCommunityRecipe } from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { showToast } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

interface Ingredient {
  key: string;
  kind: 'generic_food' | 'product';
  foodId: string;
  label: string;
  grams: string;
  basis: Basis;
  per100: NutrientValues;
}

/** Recipe editor: catalogue ingredients only, drafts, and review before publishing. */
export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useCommunityRecipe(id);
  const { t } = useT();
  if (id && existing.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EditorHeader title={t.publish.recipeEdit} />
        <Skeleton height={180} style={{ marginTop: space.md }} />
      </Screen>
    );
  }
  return <RecipeEditor key={existing.data?.id ?? 'new'} initial={existing.data ?? null} />;
}

function RecipeEditor({ initial }: { initial: CommunityRecipe | null }) {
  const { t, f, locale } = useT();
  const qc = useQueryClient();
  const { userId } = useSession();
  const [id] = useState(() => initial?.id ?? uuid());
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [imagePath, setImagePath] = useState<string | null>(initial?.imagePath ?? null);
  const [minutes, setMinutes] = useState(initial?.minutes ? String(initial.minutes) : '');
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : ['']);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (initial?.ingredients ?? []).map((i) => ({ key: uuid(), kind: i.kind, foodId: i.foodId, label: i.label, grams: String(i.grams), basis: i.basis, per100: i.per100 })),
  );
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const parsed = ingredients.map((i) => ({ ...i, amount: Number(i.grams.replace(',', '.')) })).filter((i) => Number.isFinite(i.amount) && i.amount > 0);
  const nutrition = parsed.length ? communityRecipeNutrition({ servings, ingredients: parsed.map((i) => ({ ...i, grams: i.amount })) }) : null;
  const mins = Number(minutes);
  const missing = [
    title.trim().length < 3 ? t.publish.needTitle : null,
    parsed.length === 0 ? t.publish.needIngredients : null,
    steps.every((s) => !s.trim()) ? t.publish.needSteps : null,
    !(mins >= 1 && mins <= 600) ? t.publish.needMinutes : null,
  ].filter((x): x is string => !!x);

  const addPhoto = async () => {
    if (!userId) return;
    setUploading(true);
    setError(null);
    try {
      const path = await pickAndUpload('community-media', userId);
      if (path) {
        if (imagePath && imagePath !== initial?.imagePath) removeMedia('community-media', imagePath);
        setImagePath(path);
      }
    } catch {
      setError(t.publish.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const onPick = (m: FoodMatch) => {
    setPicking(false);
    haptic.light();
    const grams = m.portions[0]?.grams ?? m.servingQuantity ?? 100;
    setIngredients((list) => [...list, { key: uuid(), kind: m.kind, foodId: m.id, label: m.name, grams: String(grams), basis: m.basis, per100: m.nutrientsPer100 }]);
  };

  const save = async (submit: boolean) => {
    setError(null);
    if (submit && missing.length) {
      haptic.warning();
      setError(f(t.publish.missing, { list: missing.join(', ') }));
      return;
    }
    if (title.trim().length < 3) {
      setError(f(t.publish.missing, { list: t.publish.needTitle }));
      return;
    }
    setBusy(submit ? 'submit' : 'draft');
    try {
      await saveCommunityRecipe(
        supabase(),
        {
          id,
          title: title.trim(),
          summary: summary.trim() || null,
          imagePath,
          minutes: mins >= 1 && mins <= 600 ? Math.round(mins) : null,
          servings,
          steps,
          ingredients: parsed.map((i) => ({ kind: i.kind, foodId: i.foodId, label: i.label, grams: i.amount })),
        },
        submit,
      );
      await Promise.all([qc.invalidateQueries({ queryKey: ['my-recipes'] }), qc.invalidateQueries({ queryKey: ['community-recipe', id] })]);
      haptic.success();
      if (submit) setSent(true);
      else showToast(t.publish.draftSaved, 'success');
    } catch (e) {
      haptic.error();
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  };

  if (sent) {
    return (
      <Screen edges={['top', 'bottom']}>
        <SentForReview />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']} bottomInset={48}>
      <EditorHeader title={initial ? t.publish.recipeEdit : t.publish.recipeNew} />
      {initial?.status === 'published' ? <Notice tone="info" text={t.publish.editPublishedNote} /> : null}
      {initial?.status === 'rejected' && initial.reviewNote ? <Notice tone="warning" text={f(t.publish.reviewNote, { note: initial.reviewNote })} /> : null}

      <View style={{ gap: space.md, marginTop: space.md }}>
        <ImageSlot path={imagePath} label={t.publish.photo} busy={uploading} onPick={addPhoto} />
        <Field label={t.publish.title} value={title} onChangeText={setTitle} maxLength={90} />
        <Field label={t.publish.summary} value={summary} onChangeText={setSummary} maxLength={280} multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Field label={t.publish.minutes} value={minutes} onChangeText={setMinutes} keyboardType="number-pad" suffix="min" />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text variant="secondaryStrong" color="textSecondary">
              {t.publish.servings}
            </Text>
            <Row gap={space.xs} style={{ height: 52 }}>
              <IconButton icon="minus" label={`${t.publish.servings} −`} size={40} onPress={() => setServings((s) => Math.max(1, s - 1))} />
              <Text variant="title" style={{ flex: 1, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                {servings}
              </Text>
              <IconButton icon="plus" label={`${t.publish.servings} +`} size={40} onPress={() => setServings((s) => Math.min(20, s + 1))} />
            </Row>
          </View>
        </Row>
      </View>

      <Text variant="section" style={{ marginTop: space.xl }}>
        {t.publish.ingredients}
      </Text>
      <Text variant="caption" color="textTertiary" style={{ marginBottom: space.sm }}>
        {t.publish.ingredientsHint}
      </Text>
      <View style={{ gap: space.xs }}>
        {ingredients.map((ing) => (
          <Animated.View key={ing.key} entering={FadeIn.duration(motion.micro)} exiting={FadeOut.duration(motion.fast)} layout={LinearTransition.duration(motion.base)}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs }}>
              <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                {ing.label}
              </Text>
              <View style={{ width: 104 }}>
                <Field
                  value={ing.grams}
                  onChangeText={(v) => setIngredients((list) => list.map((x) => (x.key === ing.key ? { ...x, grams: v } : x)))}
                  keyboardType="decimal-pad"
                  suffix={ing.basis === '100ml' ? 'ml' : 'g'}
                  accessibilityLabel={`${ing.label}: ${ing.basis === '100ml' ? 'ml' : 'g'}`}
                />
              </View>
              <IconButton icon="trash" tone="clear" size={36} label={`${t.common.delete}: ${ing.label}`} onPress={() => setIngredients((list) => list.filter((x) => x.key !== ing.key))} />
            </Card>
          </Animated.View>
        ))}
        <Button title={t.publish.addIngredient} icon="plus" variant="soft" size="md" onPress={() => setPicking(true)} />
      </View>

      {nutrition ? (
        <Card style={{ marginTop: space.md, gap: 4 }}>
          <Text variant="eyebrow" color="textSecondary">
            {t.publish.perServing}
          </Text>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {nutrition.perServing.energy_kcal == null ? '—' : `${formatNumber(nutrition.perServing.energy_kcal, locale)} kcal`}
          </Text>
          <MacroLine values={nutrition.perServing} />
          <Text variant="caption" color="textTertiary">
            {t.publish.nutritionNote}
          </Text>
        </Card>
      ) : null}

      <Text variant="section" style={{ marginTop: space.xl, marginBottom: space.sm }}>
        {t.publish.steps}
      </Text>
      <View style={{ gap: space.xs }}>
        {steps.map((s, i) => (
          <Row key={i} gap={space.xs} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field
                label={f(t.publish.step, { n: i + 1 })}
                value={s}
                onChangeText={(v) => setSteps((list) => list.map((x, j) => (j === i ? v : x)))}
                multiline
                maxLength={600}
                style={{ minHeight: 56, textAlignVertical: 'top' }}
              />
            </View>
            {steps.length > 1 ? (
              <View style={{ paddingTop: 30 }}>
                <IconButton icon="trash" tone="clear" size={36} label={`${t.common.delete}: ${f(t.publish.step, { n: i + 1 })}`} onPress={() => setSteps((list) => list.filter((_, j) => j !== i))} />
              </View>
            ) : null}
          </Row>
        ))}
        {steps.length < 30 ? <Button title={t.publish.addStep} icon="plus" variant="ghost" size="md" onPress={() => setSteps((list) => [...list, ''])} /> : null}
      </View>

      {error ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="error" text={error} />
        </View>
      ) : null}
      <View style={{ marginTop: space.lg, gap: space.xs }}>
        <Button title={t.publish.submit} icon="check" onPress={() => save(true)} loading={busy === 'submit'} disabled={busy != null || uploading} />
        <Button title={t.publish.saveDraft} variant="soft" onPress={() => save(false)} loading={busy === 'draft'} disabled={busy != null || uploading} />
        {missing.length ? (
          <Text variant="caption" color="textTertiary" align="center">
            {f(t.publish.missing, { list: missing.join(', ') })}
          </Text>
        ) : null}
      </View>

      <FoodPicker visible={picking} onPick={onPick} onClose={() => setPicking(false)} />
    </Screen>
  );
}
