import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNumber, type Basis, type FoodMatch, type NutrientValues } from '@repo/core';
import { communityRecipeNutrition, saveCommunityRecipe, type CommunityRecipe } from '@repo/data';
import { motion } from '@repo/design';
import { MacroTrio } from '@/components/cards';
import { FoodImage } from '@/components/food-image';
import { FoodPicker } from '@/components/food-picker';
import { Icon } from '@/components/icons';
import { SentForReview } from '@/components/publish';
import { Button, IconButton, Notice, PressableScale, Row, SegmentedControl, Skeleton, Text, fontFor, haptic } from '@/components/ui';
import { pickAndUpload, removeMedia, useCommunityRecipe, useMediaUrl } from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { categoryArt, foodImageUri } from '@/lib/media';
import { useSession } from '@/lib/session';
import { showToast } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { radius, shadow, space, usePalette } from '@/lib/theme';

interface Ingredient {
  key: string;
  kind: 'generic_food' | 'product';
  foodId: string;
  label: string;
  grams: string;
  basis: Basis;
  per100: NutrientValues;
  imageUri: string | null;
  category: string | null;
}

/** Recipe editor: catalogue ingredients only, drafts, and review before publishing. */
export default function RecipeEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useCommunityRecipe(id);
  const p = usePalette();
  if (id && existing.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.background }}>
        <Skeleton height={300} style={{ borderRadius: 0 }} />
        <Skeleton height={36} width="70%" style={{ margin: space.md }} />
      </View>
    );
  }
  return <RecipeEditor key={existing.data?.id ?? 'new'} initial={existing.data ?? null} />;
}

const HERO = 300;

function RecipeEditor({ initial }: { initial: CommunityRecipe | null }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const { userId } = useSession();
  const [id] = useState(() => initial?.id ?? uuid());
  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [imagePath, setImagePath] = useState<string | null>(initial?.imagePath ?? null);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 20);
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : ['']);
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (initial?.ingredients ?? []).map((i) => ({
      key: uuid(),
      kind: i.kind,
      foodId: i.foodId,
      label: i.label,
      grams: String(i.grams),
      basis: i.basis,
      per100: i.per100,
      imageUri: i.imageUrl ?? foodImageUri(i.slug),
      category: i.category,
    })),
  );
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const cover = useMediaUrl('community-media', imagePath);

  const parsed = ingredients.map((i) => ({ ...i, amount: Number(i.grams.replace(',', '.')) })).filter((i) => Number.isFinite(i.amount) && i.amount > 0);
  const nutrition = parsed.length ? communityRecipeNutrition({ servings, ingredients: parsed.map((i) => ({ ...i, grams: i.amount })) }) : null;
  const filledSteps = steps.map((s) => s.trim()).filter(Boolean);
  const missing = [
    title.trim().length < 3 ? t.publish.needTitle : null,
    parsed.length === 0 ? t.publish.needIngredients : null,
    filledSteps.length === 0 ? t.publish.needSteps : null,
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
        haptic.light();
      }
    } catch {
      setError(t.publish.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const onPick = (m: FoodMatch, visual: { imageUri: string | null; category: string | null }) => {
    setPicking(false);
    haptic.light();
    const grams = m.portions[0]?.grams ?? m.servingQuantity ?? 100;
    setIngredients((list) => [
      ...list,
      { key: uuid(), kind: m.kind, foodId: m.id, label: m.name, grams: String(grams), basis: m.basis, per100: m.nutrientsPer100, imageUri: visual.imageUri, category: visual.category },
    ]);
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
          minutes,
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
      <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top, paddingHorizontal: space.md }}>
        <SentForReview />
      </View>
    );
  }

  const unit = (b: Basis) => (b === '100ml' ? 'ml' : 'g');
  const barHeight = 76 + Math.max(insets.bottom, space.sm);

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: barHeight + space.xl }}>
        {/* Cover: the author's own photo, full bleed */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={cover ? t.publish.changePhoto : t.publish.coverPrompt}
          onPress={addPhoto}
          disabled={uploading || mode === 'preview'}
          style={{ height: HERO + insets.top, backgroundColor: p.primarySoft, overflow: 'hidden' }}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingTop: insets.top, paddingHorizontal: space.xl }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={uploading ? 'refresh' : 'camera'} size={28} color={p.primaryText} />
              </View>
              <Text variant="bodyStrong" style={{ color: p.primaryText }}>
                {t.publish.coverPrompt}
              </Text>
              <Text variant="caption" align="center" style={{ color: p.primaryText, opacity: 0.8 }}>
                {t.publish.coverHint}
              </Text>
            </View>
          )}
          {cover && mode === 'edit' ? (
            <View style={{ position: 'absolute', right: space.md, bottom: space.xl + 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,15,30,0.62)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Icon name="camera" size={15} color="#FFFFFF" />
              <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                {t.publish.changePhoto}
              </Text>
            </View>
          ) : null}
        </PressableScale>

        {/* Sheet over the cover */}
        <View style={{ marginTop: -space.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: p.background, paddingHorizontal: space.md, paddingTop: space.md }}>
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'edit', label: t.publish.edit },
              { value: 'preview', label: t.publish.preview },
            ]}
          />
          {initial?.status === 'published' ? <View style={{ marginTop: space.sm }}><Notice tone="info" text={t.publish.editPublishedNote} /></View> : null}
          {initial?.status === 'rejected' && initial.reviewNote ? <View style={{ marginTop: space.sm }}><Notice tone="warning" text={f(t.publish.reviewNote, { note: initial.reviewNote })} /></View> : null}

          {mode === 'edit' ? (
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t.publish.titlePlaceholder}
              placeholderTextColor={p.textTertiary}
              maxLength={90}
              multiline
              accessibilityLabel={t.publish.title}
              style={[styles.titleInput, { color: p.ink, fontFamily: fontFor('800') }, noRing]}
            />
          ) : (
            <Text variant="largeTitle" style={{ marginTop: space.md }}>
              {title.trim() || '—'}
            </Text>
          )}
          {mode === 'edit' ? (
            <TextInput
              value={summary}
              onChangeText={setSummary}
              placeholder={t.publish.summaryPlaceholder}
              placeholderTextColor={p.textTertiary}
              maxLength={280}
              multiline
              accessibilityLabel={t.publish.summary}
              style={[styles.summaryInput, { color: p.textSecondary, fontFamily: fontFor('500') }, noRing]}
            />
          ) : summary.trim() ? (
            <Text variant="body" color="textSecondary" style={{ marginTop: space.xs }}>
              {summary.trim()}
            </Text>
          ) : null}

          {/* Meta as tappable chips */}
          <Row gap={space.xs} style={{ marginTop: space.md, flexWrap: 'wrap' }}>
            <Stepper icon="clock" label={f(t.publish.minutesValue, { value: minutes })} onMinus={() => setMinutes((m) => Math.max(5, m - 5))} onPlus={() => setMinutes((m) => Math.min(600, m + 5))} readOnly={mode === 'preview'} a11y={t.publish.minutes} />
            <Stepper
              icon="user"
              label={servings === 1 ? t.publish.servingsOne : f(t.publish.servingsValue, { value: servings })}
              onMinus={() => setServings((s) => Math.max(1, s - 1))}
              onPlus={() => setServings((s) => Math.min(20, s + 1))}
              readOnly={mode === 'preview'}
              a11y={t.publish.servings}
            />
          </Row>

          {/* Live nutrition from catalogue data */}
          <View style={[{ marginTop: space.lg, borderRadius: radius.lg, backgroundColor: p.surface, padding: space.md, gap: space.sm }, shadow(p, 'card')]}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="eyebrow" color="textSecondary">
                {t.publish.perServing}
              </Text>
              <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {nutrition?.perServing.energy_kcal == null ? '—' : `${formatNumber(nutrition.perServing.energy_kcal, locale)} kcal`}
              </Text>
            </Row>
            <MacroTrio protein={nutrition?.perServing.protein_g ?? null} carbs={nutrition?.perServing.carbs_g ?? null} fat={nutrition?.perServing.fat_g ?? null} />
            <Text variant="caption" color="textTertiary">
              {t.publish.nutritionNote}
            </Text>
          </View>

          {/* Ingredients with their pictures */}
          <Text variant="section" style={{ marginTop: space.xl }}>
            {t.publish.ingredients}
          </Text>
          {mode === 'edit' ? (
            <Text variant="caption" color="textTertiary" style={{ marginBottom: space.sm }}>
              {t.publish.ingredientsHint}
            </Text>
          ) : null}
          <View style={{ gap: space.xs, marginTop: mode === 'preview' ? space.sm : 0 }}>
            {ingredients.map((ing) => (
              <Animated.View key={ing.key} entering={FadeIn.duration(motion.micro)} exiting={FadeOut.duration(motion.fast)} layout={LinearTransition.duration(motion.base)}>
                <Row gap={space.sm} style={{ backgroundColor: p.surface, borderRadius: radius.md, padding: 6, paddingRight: space.xs }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
                    <FoodImage uri={ing.imageUri} fallback={categoryArt(ing.category)} width={48} height={48} radius={12} fit={ing.kind === 'product' ? 'contain' : 'cover'} />
                  </View>
                  <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
                    {ing.label}
                  </Text>
                  {mode === 'edit' ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', height: 40, width: 92, borderRadius: radius.pill, backgroundColor: p.surfaceMuted, paddingHorizontal: 12 }}>
                        <TextInput
                          value={ing.grams}
                          onChangeText={(v) => setIngredients((list) => list.map((x) => (x.key === ing.key ? { ...x, grams: v } : x)))}
                          keyboardType="decimal-pad"
                          accessibilityLabel={f(t.publish.ingredientAmount, { name: ing.label })}
                          maxLength={6}
                          style={[{ width: 46, textAlign: 'right', fontSize: 16, color: p.ink, fontFamily: fontFor('700'), paddingVertical: 0 }, noRing]}
                        />
                        <Text variant="secondaryStrong" color="textSecondary">
                          {' '}
                          {unit(ing.basis)}
                        </Text>
                      </View>
                      <IconButton icon="close" tone="clear" size={34} label={f(t.publish.removeIngredient, { name: ing.label })} onPress={() => setIngredients((list) => list.filter((x) => x.key !== ing.key))} />
                    </>
                  ) : (
                    <Text variant="secondaryStrong" color="textSecondary" style={{ paddingRight: space.xs }}>
                      {ing.grams} {unit(ing.basis)}
                    </Text>
                  )}
                </Row>
              </Animated.View>
            ))}
            {mode === 'edit' ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t.publish.addIngredient}
                onPress={() => setPicking(true)}
                style={{ height: 56, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Icon name="plus" size={18} color={p.primaryText} />
                <Text variant="bodyStrong" style={{ color: p.primaryText }}>
                  {t.publish.addIngredient}
                </Text>
              </PressableScale>
            ) : null}
          </View>

          {/* Steps as numbered bubbles */}
          <Text variant="section" style={{ marginTop: space.xl, marginBottom: space.sm }}>
            {t.publish.preparation}
          </Text>
          <View style={{ gap: space.sm }}>
            {(mode === 'edit' ? steps : filledSteps).map((s, i) => (
              <Row key={i} gap={space.sm} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                  <Text variant="secondaryStrong" style={{ color: p.onPrimary }}>
                    {i + 1}
                  </Text>
                </View>
                {mode === 'edit' ? (
                  <View style={{ flex: 1, backgroundColor: p.surface, borderRadius: radius.md, paddingHorizontal: space.sm, paddingVertical: 6, minHeight: 48, flexDirection: 'row', alignItems: 'flex-start' }}>
                    <TextInput
                      value={s}
                      onChangeText={(v) => setSteps((list) => list.map((x, j) => (j === i ? v : x)))}
                      placeholder={t.publish.stepPlaceholder}
                      placeholderTextColor={p.textTertiary}
                      multiline
                      maxLength={600}
                      accessibilityLabel={f(t.publish.step, { n: i + 1 })}
                      style={[{ flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, color: p.ink, fontFamily: fontFor('500'), paddingVertical: 6 }, noRing]}
                    />
                    {steps.length > 1 ? (
                      <IconButton icon="close" tone="clear" size={30} label={`${t.common.delete}: ${f(t.publish.step, { n: i + 1 })}`} onPress={() => setSteps((list) => list.filter((_, j) => j !== i))} />
                    ) : null}
                  </View>
                ) : (
                  <Text variant="body" style={{ flex: 1, marginTop: 10 }}>
                    {s}
                  </Text>
                )}
              </Row>
            ))}
            {mode === 'edit' && steps.length < 30 ? (
              <Button title={t.publish.addStep} icon="plus" variant="ghost" size="md" onPress={() => setSteps((list) => [...list, ''])} />
            ) : null}
          </View>

          {error ? (
            <View style={{ marginTop: space.md }}>
              <Notice tone="error" text={error} />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Close, over the cover */}
      <View style={{ position: 'absolute', top: insets.top + space.xs, left: space.md }}>
        <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
      </View>

      {/* Sticky actions */}
      <View
        style={[
          { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.sm), backgroundColor: p.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.border, gap: 6 },
          shadow(p, 'floating'),
        ]}
      >
        <Text variant="caption" color={missing.length ? 'textTertiary' : 'secondaryText'} align="center" numberOfLines={1}>
          {missing.length ? f(t.publish.stillMissing, { list: missing.join(', ') }) : t.publish.ready}
        </Text>
        <Row gap={space.xs}>
          <Button title={t.publish.saveDraft} variant="soft" size="md" style={{ flex: 1 }} onPress={() => save(false)} loading={busy === 'draft'} disabled={busy != null || uploading} />
          <Button title={t.publish.submit} icon="check" size="md" style={{ flex: 1.3 }} onPress={() => save(true)} loading={busy === 'submit'} disabled={busy != null || uploading} />
        </Row>
      </View>

      <FoodPicker visible={picking} onPick={onPick} onClose={() => setPicking(false)} />
    </View>
  );
}

function Stepper({ icon, label, onMinus, onPlus, readOnly, a11y }: { icon: 'clock' | 'user'; label: string; onMinus: () => void; onPlus: () => void; readOnly: boolean; a11y: string }) {
  const p = usePalette();
  return (
    <View
      accessible={readOnly}
      accessibilityLabel={readOnly ? label : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', height: 40, borderRadius: radius.pill, backgroundColor: p.surface, paddingHorizontal: readOnly ? 14 : 4, gap: 4 }}
    >
      {readOnly ? null : <IconButton icon="minus" tone="clear" size={32} label={`${a11y} −`} onPress={onMinus} />}
      <Icon name={icon} size={15} color={p.textSecondary} />
      <Text variant="secondaryStrong" style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={`${a11y}: ${label}`}>
        {label}
      </Text>
      {readOnly ? null : <IconButton icon="plus" tone="clear" size={32} label={`${a11y} +`} onPress={onPlus} />}
    </View>
  );
}

/** Borderless inputs show the caret and their container instead of the browser ring. */
const noRing = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  titleInput: { fontSize: 28, lineHeight: 34, marginTop: space.md, paddingVertical: 4 },
  summaryInput: { fontSize: 16, lineHeight: 22, marginTop: 2, paddingVertical: 4 },
});
