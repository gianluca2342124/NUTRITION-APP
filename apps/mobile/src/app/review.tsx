import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import {
  MEAL_TYPES,
  addDays,
  defaultMealForDate,
  formatNumber,
  scaleNutrients,
  sumNutrients,
  type DraftItem,
  type FoodMatch,
  type MealType,
} from '@repo/core';
import { AmountPicker, amountOptions } from '@/components/amount-picker';
import { MacroTrio } from '@/components/cards';
import { FoodPicker } from '@/components/food-picker';
import { AnimatedCounter, Appear } from '@/components/motion';
import { MacroLine } from '@/components/nutrition';
import { Button, Card, Choice, EmptyState, Field, IconButton, Notice, Row, Screen, SegmentedControl, Text, haptic } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { today, useSaveMeal } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { draftStore, useDraft } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { space, usePalette } from '@/lib/theme';

interface EditableItem extends DraftItem {
  id: string;
  touched: boolean;
}

export default function ReviewScreen() {
  const { t, f, locale } = useT();
  const p = usePalette();
  const pending = useDraft();
  const session = useSession();
  const save = useSaveMeal();
  const draft = pending?.draft ?? null;

  const [entryId] = useState(uuid);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [meal, setMeal] = useState<MealType>(draft?.mealType ?? defaultMealForDate(new Date()));
  const [items, setItems] = useState<EditableItem[]>(() => (draft?.items ?? []).map((i) => ({ ...i, id: uuid(), touched: false })));
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [picker, setPicker] = useState<{ key: string | null; query: string; suggestions: FoodMatch[] } | null>(null);
  const [keepPhoto, setKeepPhoto] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const date = addDays(today(), draft?.dayOffset ?? 0);
  const totals = useMemo(
    () => sumNutrients(items.filter((i) => i.match).map((i) => scaleNutrients(i.match!.nutrientsPer100, i.grams))),
    [items],
  );

  if (!draft) {
    return (
      <Screen>
        <EmptyState icon="info" title={t.review.emptyItems} action={<Button title={t.common.close} onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const update = (key: string, patch: Partial<EditableItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const unmatched = items.some((i) => !i.match);

  const answer = (qid: string, yes: boolean) => {
    const q = draft.questions.find((x) => x.id === qid);
    if (!q) return;
    setAnswers((a) => ({ ...a, [qid]: yes }));
    setItems((list) => {
      const without = list.filter((i) => i.key !== q.item.key);
      return yes ? [...without, { ...q.item, id: uuid(), touched: false }] : without;
    });
  };

  const onPick = (match: FoodMatch) => {
    if (!picker) return;
    if (picker.key) {
      update(picker.key, { match, touched: true });
    } else {
      const grams = match.portions[0]?.grams ?? match.servingQuantity ?? 100;
      setItems((list) => [
        ...list,
        {
          key: `added-${uuid()}`,
          id: uuid(),
          label: match.name,
          foodQuery: match.name,
          grams,
          gramsRange: null,
          quantityLabel: match.portions[0] ? (locale === 'en' ? match.portions[0].labelEn : match.portions[0].labelEs) : null,
          amountIsEstimate: false,
          confidence: null,
          visible: true,
          match,
          alternatives: [],
          touched: true,
        },
      ]);
    }
    setPicker(null);
  };

  const onSave = async () => {
    setSaveError(null);
    try {
      let photoPath: string | null = null;
      if (keepPhoto && pending?.photoUri && session.userId) {
        photoPath = `${session.userId}/${entryId}.jpg`;
        const body = await (await fetch(pending.photoUri)).arrayBuffer();
        const { error } = await supabase().storage.from('meal-photos').upload(photoPath, body, { contentType: 'image/jpeg', upsert: true });
        if (error) photoPath = null;
      }
      await save.mutateAsync({
        id: entryId,
        consumedOn: date,
        consumedAt: draft.dayOffset === 0 ? new Date().toISOString() : null,
        mealType: meal,
        title: title.trim() || null,
        method: draft.source === 'photo' ? 'photo' : draft.source === 'voice' ? 'voice' : 'text',
        photoPath,
        aiDraftId: /^[0-9a-f-]{36}$/i.test(draft.draftId) ? draft.draftId : null,
        items: items.map((i) => ({
          id: i.id,
          foodKind: i.match!.kind,
          genericFoodId: i.match!.kind === 'generic_food' ? i.match!.id : null,
          productId: i.match!.kind === 'product' ? i.match!.id : null,
          displayName: i.label,
          amount: i.grams,
          quantityLabel: i.quantityLabel,
          isEstimate: i.amountIsEstimate && !i.touched,
        })),
      });
      haptic.success();
      draftStore.set(null);
      router.back();
    } catch (e) {
      setSaveError(errorMessage(e, t));
    }
  };

  const subtitle = draft.source === 'photo' ? t.review.photoSubtitle : draft.source === 'voice' ? t.review.voiceSubtitle : t.review.textSubtitle;

  return (
    <Screen edges={['top', 'bottom']} bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text variant="title">{t.review.title}</Text>
          <Text variant="secondary" color="textSecondary">
            {subtitle}
          </Text>
        </View>
        <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
      </Row>

      {/* Reveal: the estimate at a glance, then everything editable below. */}
      <Appear index={0} style={{ marginTop: space.md }}>
        {pending?.photoUri ? (
          <Image source={{ uri: pending.photoUri }} style={{ width: '100%', height: 200, borderRadius: 24 }} contentFit="cover" />
        ) : null}
        <Card style={{ gap: space.sm, marginTop: pending?.photoUri ? -36 : 0, marginHorizontal: pending?.photoUri ? space.sm : 0 }}>
          <Text variant="caption" color="textSecondary">
            {t.review.total}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <AnimatedCounter value={Math.round(totals.values.energy_kcal ?? 0)} format={(n) => formatNumber(Math.round(n), locale)} variant="display" />
            <Text variant="bodyStrong" color="textSecondary">
              kcal
            </Text>
          </View>
          <MacroTrio protein={totals.values.protein_g} carbs={totals.values.carbs_g} fat={totals.values.fat_g} />
          {items.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
              {items.map((i) => (
                <View key={i.key} style={{ backgroundColor: i.match ? p.primarySoft : p.warningSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text variant="caption" style={{ color: i.match ? p.primaryText : p.warningText }}>
                    {i.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text variant="caption" color="textTertiary">
            {t.review.sourceNote}
          </Text>
        </Card>
      </Appear>
      {draft.transcript ? (
        <Card style={{ marginTop: space.md }}>
          <Text variant="caption" color="textSecondary">
            {t.voice.transcriptLabel}
          </Text>
          <Text variant="body">“{draft.transcript}”</Text>
        </Card>
      ) : null}

      <View style={{ gap: space.xs, marginTop: space.md }}>
        {draft.notices.map((n) => (
          <Notice key={n} tone={n === 'not_food' || n === 'not_a_food_log' ? 'warning' : 'info'} text={t.review.notices[n]} />
        ))}
        {draft.clarification ? <Notice tone="warning" text={draft.clarification} /> : null}
      </View>

      <Field label={t.review.item} value={title} onChangeText={setTitle} placeholder={t.review.title} />
      <View style={{ marginTop: space.md, gap: space.xs }}>
        <Text variant="secondaryStrong" color="textSecondary">
          {t.review.mealType} · {draft.dayOffset === 0 ? t.common.today : draft.dayOffset === -1 ? t.common.yesterday : date}
        </Text>
        <SegmentedControl value={meal} onChange={setMeal} options={MEAL_TYPES.map((m) => ({ value: m, label: t.meals[m] }))} />
      </View>

      {items.map((item) => {
        const values = item.match ? scaleNutrients(item.match.nutrientsPer100, item.grams) : null;
        return (
          <Card key={item.key} style={{ marginTop: space.sm, gap: space.sm, borderColor: item.match ? p.border : p.warning, borderWidth: item.match ? 0.5 : 1.5 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="cardTitle">{item.label}</Text>
                {item.match ? (
                  <Text variant="caption" color="textSecondary">
                    {f(t.review.matchedWith, { name: item.match.name })}
                  </Text>
                ) : (
                  <Text variant="caption" style={{ color: p.warningText }}>
                    {t.review.noMatch}
                  </Text>
                )}
              </View>
              <IconButton icon="trash" size={36} label={t.common.remove} onPress={() => setItems((l) => l.filter((x) => x.key !== item.key))} />
            </Row>
            {item.match ? (
              <>
                <AmountPicker
                  value={item.grams}
                  basis={item.match.basis}
                  options={amountOptions({ locale, portions: item.match.portions, servingQuantity: item.match.servingQuantity, basis: item.match.basis, t: { serving: t.product.serving, package: t.product.package } })}
                  onChange={(grams, label) => update(item.key, { grams, quantityLabel: label, touched: true })}
                />
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatNumber(values?.energy_kcal ?? 0, locale)} kcal
                    </Text>
                    {values && <MacroLine values={values} />}
                  </View>
                  {item.amountIsEstimate && !item.touched ? (
                    <Text variant="caption" style={{ color: p.warningText }}>
                      {item.gramsRange ? f(t.review.range, { min: item.gramsRange[0], max: item.gramsRange[1] }) : t.review.estimated}
                    </Text>
                  ) : null}
                </Row>
              </>
            ) : null}
            <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
              {item.alternatives.slice(0, 2).map((alt) => (
                <Choice key={alt.id} compact label={alt.name} selected={item.match?.id === alt.id} onPress={() => update(item.key, { match: alt, touched: true })} />
              ))}
              <Choice compact label={t.review.chooseFood} selected={false} onPress={() => setPicker({ key: item.key, query: item.foodQuery, suggestions: item.alternatives })} />
            </Row>
          </Card>
        );
      })}

      {draft.questions.length > 0 && (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          <Text variant="section">{t.review.questions}</Text>
          {draft.questions.map((q) => (
            <Card key={q.id} style={{ gap: space.sm }}>
              <Text variant="bodyStrong">{q.text}</Text>
              <Row gap={space.xs}>
                <Choice compact label={t.common.yes} selected={answers[q.id] === true} onPress={() => answer(q.id, true)} />
                <Choice compact label={t.common.no} selected={answers[q.id] === false} onPress={() => answer(q.id, false)} />
              </Row>
            </Card>
          ))}
        </View>
      )}

      <Button title={t.review.addItem} icon="plus" variant="secondary" style={{ marginTop: space.md }} onPress={() => setPicker({ key: null, query: '', suggestions: [] })} />


      {pending?.photoUri ? (
        <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
          <Text variant="body">{t.review.keepPhoto}</Text>
          <Switch value={keepPhoto} onValueChange={setKeepPhoto} trackColor={{ true: p.primary, false: p.surfaceMuted }} />
        </Row>
      ) : null}

      <View style={{ marginTop: space.lg, gap: space.xs }}>
        {unmatched && <Notice tone="warning" text={t.review.unmatchedBlocked} />}
        {saveError && <Notice tone="error" text={saveError} />}
        <Button title={t.review.save} icon="check" onPress={onSave} loading={save.isPending} disabled={items.length === 0 || unmatched} />
      </View>

      {picker && (
        <FoodPicker visible initialQuery={picker.query} suggestions={picker.suggestions} onPick={onPick} onClose={() => setPicker(null)} />
      )}
    </Screen>
  );
}
