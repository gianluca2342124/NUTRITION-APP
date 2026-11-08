import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Share, Switch, View } from 'react-native';
import { formatNumber } from '@repo/core';
import { Button, Card, Divider, Field, IconButton, ListRow, Notice, Row, Screen, Text } from '@/components/ui';
import { hapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { setCelebrationsEnabled, useCelebrationsSetting } from '@/lib/prefs';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { queryClient, today, useConsents, useGamification, useRecordConsent, useSetGamification, useSetTarget, useTarget } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';

function ask(message: string, onYes: () => void, yes: string, no: string) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert('', message, [
    { text: no, style: 'cancel' },
    { text: yes, style: 'destructive', onPress: onYes },
  ]);
}

/** Account, targets, privacy and app preferences (the person's public page is the Perfil tab). */
export default function SettingsScreen() {
  const { t, f, locale } = useT();
  const session = useSession();
  const consents = useConsents();
  const game = useGamification();
  const setGame = useSetGamification();
  const p = usePalette();
  const record = useRecordConsent();
  const target = useTarget(today());
  const setTarget = useSetTarget();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ energy: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [haptics, setHaptics] = useState(hapticsEnabled);
  const celebrations = useCelebrationsSetting();

  const startEditing = () => {
    const d = target.data;
    setDraft({
      energy: d?.energyKcal?.toString() ?? '',
      protein: d?.proteinG?.toString() ?? '',
      carbs: d?.carbsG?.toString() ?? '',
      fat: d?.fatG?.toString() ?? '',
      fiber: d?.fiberG?.toString() ?? '',
    });
    setEditing(true);
  };

  const run = async (key: string, fn: () => Promise<void>, success?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      if (success) setMessage({ tone: 'success', text: success });
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error && !('code' in e) ? e.message : errorMessage(e, t) });
    } finally {
      setBusy(null);
    }
  };

  const int = (v: string) => (v.trim() ? Math.round(Number(v.replace(',', '.'))) : null);
  const energyValid = (() => {
    const e = int(draft.energy);
    return e == null || (e >= 1000 && e <= 6000);
  })();

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
        <Text variant="cardTitle">{t.settings.title}</Text>
        <View style={{ width: 44 }} />
      </Row>

      {message && (
        <View style={{ marginTop: space.md }}>
          <Notice tone={message.tone} text={message.text} />
        </View>
      )}

      <Card style={{ marginTop: space.md, gap: space.sm }}>
        {session.isAnonymous ? (
          <>
            <Text variant="cardTitle">{t.profile.guest}</Text>
            <Text variant="secondary" color="textSecondary">
              {t.profile.guestBody}
            </Text>
            <Field label={t.profile.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Field label={t.profile.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
            <Button
              title={t.profile.createAccount}
              loading={busy === 'create'}
              disabled={!email.includes('@') || password.length < 8}
              onPress={() => run('create', () => session.createAccount(email.trim(), password), t.review.saved)}
            />
            <Button
              title={t.profile.signIn}
              variant="ghost"
              size="md"
              disabled={!email.includes('@') || password.length < 8}
              onPress={() => run('signin', async () => {
                await session.signIn(email.trim(), password);
                await queryClient.invalidateQueries();
              })}
            />
          </>
        ) : (
          <>
            <Text variant="cardTitle">{session.session?.user.email}</Text>
            <Button
              title={t.profile.signOut}
              icon="logout"
              variant="secondary"
              size="md"
              loading={busy === 'signout'}
              onPress={() =>
                run('signout', async () => {
                  await session.signOut();
                  queryClient.clear();
                  router.replace('/');
                })
              }
            />
          </>
        )}
      </Card>

      <Card style={{ marginTop: space.md, gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="cardTitle">{t.profile.targets}</Text>
          <Button title={editing ? t.common.cancel : t.profile.editTargets} variant="ghost" size="md" onPress={() => (editing ? setEditing(false) : startEditing())} />
        </Row>
        {editing ? (
          <>
            <Field label={t.nutrients.energy_kcal} value={draft.energy} onChangeText={(v) => setDraft({ ...draft, energy: v })} keyboardType="number-pad" suffix="kcal" />
            <Row gap={space.sm}>
              <View style={{ flex: 1 }}>
                <Field label={t.nutrients.protein_g} value={draft.protein} onChangeText={(v) => setDraft({ ...draft, protein: v })} keyboardType="number-pad" suffix="g" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.nutrients.carbs_g} value={draft.carbs} onChangeText={(v) => setDraft({ ...draft, carbs: v })} keyboardType="number-pad" suffix="g" />
              </View>
            </Row>
            <Row gap={space.sm}>
              <View style={{ flex: 1 }}>
                <Field label={t.nutrients.fat_g} value={draft.fat} onChangeText={(v) => setDraft({ ...draft, fat: v })} keyboardType="number-pad" suffix="g" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t.nutrients.fiber_g} value={draft.fiber} onChangeText={(v) => setDraft({ ...draft, fiber: v })} keyboardType="number-pad" suffix="g" />
              </View>
            </Row>
            {!energyValid && <Notice tone="warning" text="1000–6000 kcal" />}
            <Button
              title={t.common.save}
              disabled={!energyValid}
              loading={setTarget.isPending}
              onPress={() =>
                setTarget.mutate(
                  {
                    effectiveFrom: today(),
                    energyKcal: int(draft.energy),
                    proteinG: int(draft.protein),
                    carbsG: int(draft.carbs),
                    fatG: int(draft.fat),
                    fiberG: int(draft.fiber),
                  },
                  { onSuccess: () => setEditing(false), onError: (e) => setMessage({ tone: 'error', text: errorMessage(e, t) }) },
                )
              }
            />
          </>
        ) : target.data ? (
          <Text variant="body" color="textSecondary">
            {`${target.data.energyKcal != null ? `${formatNumber(target.data.energyKcal, locale)} kcal` : '—'} · ${t.nutrients.protein_g} ${target.data.proteinG ?? '—'} g · ${t.nutrients.carbs_g} ${target.data.carbsG ?? '—'} g · ${t.nutrients.fat_g} ${target.data.fatG ?? '—'} g`}
          </Text>
        ) : (
          <Text variant="body" color="textSecondary">
            {t.today.noTarget}
          </Text>
        )}
        <Text variant="caption" color="textTertiary">
          {t.onboarding.methodology}
        </Text>
      </Card>

      <Card style={{ marginTop: space.md, paddingVertical: 0 }}>
        <ListRow
          title={t.profile.healthData}
          subtitle={consents.data?.health_data ? t.profile.healthDataOn : t.profile.healthDataOff}
          right={
            consents.data?.health_data ? (
              <Button
                title={t.common.remove}
                variant="danger"
                size="md"
                onPress={() => ask(t.profile.revokeHealth + '?', () => record.mutate({ type: 'health_data', granted: false }), t.common.remove, t.common.cancel)}
              />
            ) : undefined
          }
        />
        <Divider />
        <ListRow
          title={t.profile.gamification}
          subtitle={t.profile.gamificationHint}
          right={
            <Switch
              value={game.data?.enabled !== false}
              disabled={!game.data || setGame.isPending}
              onValueChange={(v) => setGame.mutate(v)}
              trackColor={{ true: p.primary, false: p.borderStrong }}
              accessibilityLabel={t.profile.gamification}
            />
          }
        />
        <Divider />
        <ListRow
          title={t.settings.celebrations}
          subtitle={t.settings.celebrationsHint}
          right={
            <Switch
              value={celebrations}
              onValueChange={setCelebrationsEnabled}
              trackColor={{ true: p.primary, false: p.borderStrong }}
              accessibilityLabel={t.settings.celebrations}
            />
          }
        />
        <Divider />
        <ListRow
          title={t.settings.haptics}
          subtitle={t.settings.hapticsHint}
          right={
            <Switch
              value={haptics}
              onValueChange={(v) => {
                setHapticsEnabled(v);
                setHaptics(v);
              }}
              trackColor={{ true: p.primary, false: p.borderStrong }}
              accessibilityLabel={t.settings.haptics}
            />
          }
        />
        <Divider />
        <ListRow
          title={t.profile.aiProcessing}
          subtitle={consents.data?.ai_processing ? t.profile.healthDataOn : t.profile.healthDataOff}
          right={
            consents.data?.ai_processing ? (
              <Button title={t.common.remove} variant="danger" size="md" onPress={() => record.mutate({ type: 'ai_processing', granted: false })} />
            ) : undefined
          }
        />
      </Card>

      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Button
          title={t.profile.exportData}
          icon="download"
          variant="secondary"
          loading={busy === 'export'}
          onPress={() =>
            run('export', async () => {
              const data = await apiClient().exportAccount();
              await Share.share({ message: JSON.stringify(data, null, 2) });
            })
          }
        />
        <Button
          title={t.profile.deleteAccount}
          icon="trash"
          variant="danger"
          loading={busy === 'delete'}
          onPress={() =>
            ask(
              t.profile.deleteConfirm,
              () =>
                run('delete', async () => {
                  await apiClient().deleteAccount();
                  await session.signOut();
                  queryClient.clear();
                  router.replace('/onboarding');
                }),
              t.common.delete,
              t.common.cancel,
            )
          }
        />
      </View>

      <Text variant="caption" color="textTertiary" style={{ marginTop: space.lg }}>
        {f(t.profile.version, { version: Constants.expoConfig?.version ?? '0.1.0' })} · {t.web.sourcesBody}
      </Text>
    </Screen>
  );
}
