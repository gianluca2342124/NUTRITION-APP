import { useState } from 'react';
import { View } from 'react-native';
import { formatNumber, scaleNutrients, type CatalogProduct, type NutrientKey } from '@repo/core';
import { submitContribution } from '@repo/data';
import { NUTRIENT_STATS } from '@repo/design';
import { AmountPicker, amountOptions } from './amount-picker';
import { MacroLine } from './nutrition';
import { BottomSheet } from './sheet';
import { Button, Chip, Field, Notice, Text, haptic } from './ui';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

/**
 * Two different actions, never mixed:
 *  · AmountSheet — personal: shows the values for another amount. Nothing is
 *    saved or logged.
 *  · CorrectionSheet — public data: proposes what the package says. It becomes
 *    a contribution pending moderation; the catalogue does not change.
 */
export function AmountSheet({
  product,
  amount,
  onApply,
  onClose,
}: {
  product: CatalogProduct;
  amount: number;
  onApply: (grams: number) => void;
  onClose: () => void;
}) {
  const { t, f, locale } = useT();
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const [grams, setGrams] = useState(amount);
  const values = scaleNutrients(product.nutrientsPer100, grams);
  return (
    <BottomSheet visible onClose={onClose} title={t.stats.editAmountTitle}>
      <View style={{ gap: space.md }}>
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
        <View style={{ gap: 2 }}>
          <Text variant="caption" color="textSecondary">
            {f(t.stats.forAmount, { amount: `${formatNumber(grams, locale)} ${unit}` })}
          </Text>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {values.energy_kcal == null ? t.stats.unknown : `${formatNumber(values.energy_kcal, locale)} kcal`}
          </Text>
          <MacroLine values={values} />
        </View>
        <Button
          title={t.stats.apply}
          icon="check"
          onPress={() => {
            onApply(grams);
            haptic.success();
            onClose();
          }}
        />
      </View>
    </BottomSheet>
  );
}

export function CorrectionSheet({ product, onClose }: { product: CatalogProduct; onClose: () => void }) {
  const { t, f, locale } = useT();
  const unit = product.basis === '100ml' ? 'ml' : 'g';
  const [nutrient, setNutrient] = useState<NutrientKey>('energy_kcal');
  const [proposal, setProposal] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const stat = NUTRIENT_STATS.find((s) => s.key === nutrient)!;
  const current = product.nutrientsPer100[nutrient];
  const currentText = current == null ? t.stats.unknown : `${formatNumber(current, locale, nutrient === 'energy_kcal' ? 0 : 1)} ${stat.unit}`;

  const send = async () => {
    const value = Number(proposal.replace(',', '.'));
    if (!proposal.trim() || !Number.isFinite(value) || value < 0 || value > (nutrient === 'energy_kcal' ? 900 : 100)) {
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
        payload: { field: nutrient, basis: product.basis, current, proposed: value, source: 'app_correction', productUpdatedAt: product.updatedAt },
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
    <BottomSheet visible onClose={onClose} title={t.stats.correctionTitle}>
      <View style={{ gap: space.md }}>
        <Text variant="secondary" color="textSecondary">
          {f(t.stats.correctionHint, { unit })}
        </Text>
        {state === 'sent' ? (
          <>
            <Notice tone="success" text={t.stats.correctionSent} />
            <Button title={t.common.close} variant="soft" onPress={onClose} />
          </>
        ) : (
          <>
            <View style={{ gap: space.xs }}>
              <Text variant="secondaryStrong" color="textSecondary">
                {t.stats.correctionPick}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {NUTRIENT_STATS.map((s) => (
                  <Chip
                    key={s.key}
                    label={t.stats.labels[s.key]}
                    selected={s.key === nutrient}
                    onPress={() => {
                      setNutrient(s.key);
                      setProposal('');
                      setState('idle');
                    }}
                  />
                ))}
              </View>
            </View>
            <Field
              label={f(t.stats.correctionField, { unit })}
              value={proposal}
              onChangeText={(v) => {
                setProposal(v);
                if (state === 'invalid') setState('idle');
              }}
              keyboardType="decimal-pad"
              suffix={stat.unit}
            />
            <Text variant="caption" color="textTertiary" style={{ marginTop: -space.sm }}>
              {f(t.stats.correctionNow, { value: currentText })}
            </Text>
            {state === 'invalid' ? <Notice tone="warning" text={t.stats.correctionInvalid} /> : null}
            {error ? <Notice tone="error" text={error} /> : null}
            <Button title={t.stats.correctionSend} variant="secondary" loading={state === 'sending'} onPress={send} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}
