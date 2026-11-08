import { useState } from 'react';
import { View } from 'react-native';
import { formatNumber, scaleNutrients, type CatalogProduct, type NutrientKey } from '@repo/core';
import { submitContribution } from '@repo/data';
import { NUTRIENT_STATS } from '@repo/design';
import { AmountPicker, amountOptions } from './amount-picker';
import { BottomSheet } from './sheet';
import { Button, Divider, Field, Notice, Text, haptic } from './ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

/**
 * Editing from the product card keeps two things apart:
 *  A. my amount — personal, recalculates every value instantly;
 *  B. the product's data — never changed by one user: a correction becomes a
 *     contribution pending moderation, with provenance.
 */
export function NutrientEditSheet({
  product,
  nutrient,
  amount,
  onApplyAmount,
  onClose,
}: {
  product: CatalogProduct;
  /** Null opens the sheet for the amount only. */
  nutrient: NutrientKey | null;
  amount: number;
  onApplyAmount: (grams: number) => void;
  onClose: () => void;
}) {
  const { t, f, locale } = useT();
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const [grams, setGrams] = useState(amount);
  const [proposal, setProposal] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const stat = nutrient ? NUTRIENT_STATS.find((s) => s.key === nutrient) : null;
  const per100 = nutrient ? product.nutrientsPer100[nutrient] : null;
  const mine = nutrient ? scaleNutrients(product.nutrientsPer100, grams)[nutrient] : null;
  const fmt = (v: number | null) => (v == null ? t.stats.unknown : `${formatNumber(v, locale, nutrient === 'energy_kcal' ? 0 : 1)} ${stat?.unit ?? ''}`);

  const sendCorrection = async () => {
    const value = Number(proposal.replace(',', '.'));
    if (!nutrient || !proposal.trim() || !Number.isFinite(value) || value < 0 || value > (nutrient === 'energy_kcal' ? 900 : 100)) {
      setState('invalid');
      haptic.error();
      return;
    }
    setState('sending');
    setError(null);
    try {
      await submitContribution(supabase(), {
        kind: 'product_correction',
        gtin: product.gtin,
        productId: product.id,
        payload: { field: nutrient, basis: product.basis, current: per100, proposed: value, source: 'app_nutrient_edit', productUpdatedAt: product.updatedAt },
      });
      setState('sent');
      haptic.success();
    } catch (e) {
      setState('idle');
      setError(errorMessage(e, t));
      haptic.error();
    }
  };

  return (
    <BottomSheet visible onClose={onClose} title={stat ? t.stats.labels[stat.key] : t.stats.editAmountTitle}>
      <View style={{ gap: space.md }}>
        {nutrient ? (
          <View style={{ gap: 2 }}>
            <Text variant="metric" style={{ fontVariant: ['tabular-nums'] }}>
              {fmt(mine)}
            </Text>
            <Text variant="secondary" color="textSecondary">
              {f(t.stats.currentValue, { value: fmt(per100), unit })} · {f(t.stats.forYourAmount, { value: fmt(mine), amount: `${formatNumber(grams, locale)} ${unit}` })}
            </Text>
          </View>
        ) : null}

        <Text variant="cardTitle">{t.stats.editAmountTitle}</Text>
        <Text variant="secondary" color="textSecondary">
          {t.stats.editAmountHint}
        </Text>
        <AmountPicker
          value={grams}
          basis={product.basis}
          options={amountOptions({
            locale,
            servingQuantity: product.servingQuantity,
            netQuantity: product.netQuantity,
            basis: product.basis,
            t: { serving: t.product.serving, package: t.product.package },
          })}
          onChange={(g) => setGrams(g)}
        />
        <Button
          title={t.stats.apply}
          icon="check"
          onPress={() => {
            onApplyAmount(grams);
            haptic.success();
            onClose();
          }}
        />

        {nutrient ? (
          <>
            <Divider />
            <Text variant="cardTitle">{t.stats.correctionTitle}</Text>
            <Text variant="secondary" color="textSecondary">
              {t.stats.correctionHint}
            </Text>
            {state === 'sent' ? (
              <Notice tone="success" text={t.stats.correctionSent} />
            ) : (
              <>
                <Field
                  label={f(t.stats.correctionField, { unit })}
                  value={proposal}
                  onChangeText={(v) => {
                    setProposal(v);
                    if (state === 'invalid') setState('idle');
                  }}
                  keyboardType="decimal-pad"
                  suffix={stat?.unit}
                  placeholder={per100 == null ? '' : formatNumber(per100, locale, 1)}
                />
                {state === 'invalid' ? <Notice tone="warning" text={t.stats.correctionInvalid} /> : null}
                {error ? <Notice tone="error" text={error} /> : null}
                <Button title={t.stats.correctionSend} variant="secondary" loading={state === 'sending'} onPress={sendCorrection} />
              </>
            )}
          </>
        ) : null}
      </View>
    </BottomSheet>
  );
}
