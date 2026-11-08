import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import { ACHIEVEMENT_IDS, ACTIVITY_LEVELS, GOALS, formatNumber, type AchievementId, type Goal } from '@repo/core';
import { communityRecipeNutrition, type CommunityArticle, type CommunityRecipe } from '@repo/data';
import { AchievementBadge, AchievementGrid } from '@/components/achievements';
import { FudyuCharacter } from '@/components/art';
import { Avatar, MyAvatar } from '@/components/avatar';
import { ArticleCard, PublicationStatusPill, RecipeCardView } from '@/components/cards';
import { Icon } from '@/components/icons';
import { BottomSheet } from '@/components/sheet';
import { Button, Card, Choice, Field, IconButton, Notice, PressableScale, Row, Screen, SectionHeader, SegmentedControl, Text, haptic } from '@/components/ui';
import {
  mediaUrl,
  pickAndUpload,
  removeMedia,
  useDeletePublication,
  useMyArticles,
  useMyRecipes,
  usePublicAchievements,
  usePublicProfile,
  useSavePublicProfile,
} from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { useHealthProfile, useUpdatePersonal } from '@/lib/profile-data';
import { today, useConsents, useGamification, useProfile, useRecordConsent, useTarget } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { showToast } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { radius, space, usePalette } from '@/lib/theme';
import { updateProfile } from '@repo/data';

type FieldKey = 'goal' | 'sex' | 'age' | 'height' | 'weight' | 'activity';
type Publication = { kind: 'recipe'; item: CommunityRecipe } | { kind: 'article'; item: CommunityArticle };

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

/**
 * Perfil: who you are (photo, name, @usuario, bio), your private data (only
 * you see it), your publications and your achievements. "Vista pública" shows
 * exactly what others can see — never health data.
 */
export default function ProfileTab() {
  const { t } = useT();
  const pub = usePublicProfile();
  const profile = useProfile();
  const recipes = useMyRecipes();
  const articles = useMyArticles();
  const [tab, setTab] = useState<'mine' | 'public'>('mine');
  const [editing, setEditing] = useState(false);
  const [field, setField] = useState<FieldKey | null>(null);

  const name = pub.data?.displayName ?? profile.data?.displayName ?? null;
  const publications = useMemo<Publication[]>(
    () =>
      [
        ...(recipes.data ?? []).map((item) => ({ kind: 'recipe' as const, item })),
        ...(articles.data ?? []).map((item) => ({ kind: 'article' as const, item })),
      ].sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt)),
    [recipes.data, articles.data],
  );

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <Text variant="largeTitle" accessibilityRole="header">
          {t.me.title}
        </Text>
        <IconButton icon="settings" label={t.me.settings} onPress={() => router.push('/settings')} />
      </Row>

      <View style={{ alignItems: 'center', marginTop: space.sm, gap: 6 }}>
        <MyAvatar size={104} />
        <Text variant="title" align="center" style={{ marginTop: space.xs }}>
          {name ?? t.me.noName}
        </Text>
        {pub.data?.username ? (
          <Text variant="secondaryStrong" color="textSecondary">
            @{pub.data.username}
          </Text>
        ) : null}
        {pub.data?.bio ? (
          <Text variant="secondary" color="textSecondary" align="center" style={{ maxWidth: 320 }}>
            {pub.data.bio}
          </Text>
        ) : null}
        <Button title={t.me.editProfile} icon="edit" variant="soft" size="md" onPress={() => setEditing(true)} style={{ marginTop: space.xs }} />
      </View>

      <View style={{ marginTop: space.lg }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: t.me.myProfile },
            { value: 'public', label: t.me.publicView },
          ]}
        />
      </View>

      {tab === 'mine' ? <MyProfile publications={publications} onEditField={setField} /> : <PublicView publications={publications} />}

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title={t.me.editProfile}>
        {editing ? <ProfileEditor onDone={() => setEditing(false)} /> : null}
      </BottomSheet>
      <BottomSheet visible={field != null} onClose={() => setField(null)} title={field ? t.me.fields[field] : ''}>
        {field ? <PersonalFieldEditor field={field} onDone={() => setField(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

/* ------------------------------------------------------------------ mine */

function MyProfile({ publications, onEditField }: { publications: Publication[]; onEditField: (f: FieldKey) => void }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const profile = useProfile();
  const consents = useConsents();
  const health = useHealthProfile();
  const record = useRecordConsent();
  const game = useGamification();
  const remove = useDeletePublication();
  const earned = useMemo(() => new Set((game.data?.achievements ?? []).map((a) => a.id)), [game.data]);
  const h = health.data;
  const year = Number(today().slice(0, 4));
  const consented = consents.data?.health_data === true;

  const cards: { key: FieldKey; value: string | null; locked?: boolean }[] = [
    { key: 'goal', value: profile.data ? t.goals[profile.data.primaryGoal] : null },
    { key: 'sex', value: h?.sex ? t.sex[h.sex] : null, locked: !consented },
    { key: 'age', value: h?.birthYear ? f(t.me.ageValue, { value: year - h.birthYear }) : null, locked: !consented },
    { key: 'height', value: h?.heightCm ? `${formatNumber(h.heightCm, locale)} cm` : null, locked: !consented },
    { key: 'weight', value: h?.weightKg ? `${formatNumber(h.weightKg, locale, 1)} kg` : null, locked: !consented },
    { key: 'activity', value: h?.activity ? t.activity[h.activity as keyof typeof t.activity] : null, locked: !consented },
  ];

  return (
    <>
      <SectionHeader title={t.me.yourData} subtitle={t.me.yourDataPrivate} />
      {!consented && consents.data ? (
        <Card style={{ gap: space.sm, marginBottom: space.sm }}>
          <Row gap={space.xs}>
            <Icon name="lock" size={18} color={p.primaryText} />
            <Text variant="cardTitle" style={{ flex: 1 }}>
              {t.me.dataConsentTitle}
            </Text>
          </Row>
          <Text variant="secondary" color="textSecondary">
            {t.me.dataConsentBody}
          </Text>
          <Button title={t.me.dataConsentAction} size="md" loading={record.isPending} onPress={() => record.mutate({ type: 'health_data', granted: true })} />
        </Card>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.xs }}>
        {cards
          .filter((c) => !c.locked)
          .map((c) => (
            <PressableScale
              key={c.key}
              accessibilityRole="button"
              accessibilityLabel={`${f(t.me.editField, { field: t.me.fields[c.key] })}: ${c.value ?? t.me.notSet}`}
              onPress={() => {
                haptic.light();
                onEditField(c.key);
              }}
              style={{
                width: c.key === 'goal' ? '100%' : '49%',
                backgroundColor: p.surface,
                borderRadius: radius.md,
                padding: space.sm,
                gap: 4,
                borderWidth: 1,
                borderColor: p.border,
              }}
            >
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="eyebrow" color="textSecondary">
                  {t.me.fields[c.key]}
                </Text>
                <Icon name="edit" size={14} color={p.textTertiary} />
              </Row>
              <Text variant="bodyStrong" numberOfLines={2} color={c.value ? 'ink' : 'textTertiary'}>
                {c.value ?? t.me.notSet}
              </Text>
            </PressableScale>
          ))}
      </View>

      <SectionHeader title={t.me.publications} />
      {publications.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.lg }}>
          <FudyuCharacter expression="smile" size={76} />
          <Text variant="cardTitle" align="center" style={{ marginTop: space.xs }}>
            {t.me.publicationsEmptyTitle}
          </Text>
          <Text variant="secondary" color="textSecondary" align="center" style={{ maxWidth: 300 }}>
            {t.me.publicationsEmptyBody}
          </Text>
          <Button title={t.me.createRecipe} icon="plus" size="md" style={{ marginTop: space.sm }} onPress={() => router.push('/create/recipe')} />
          <Button title={t.me.writeArticle} variant="ghost" size="md" onPress={() => router.push('/create/article')} />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          {publications.map((pubItem) => (
            <PublicationCard
              key={`${pubItem.kind}:${pubItem.item.id}`}
              pub={pubItem}
              onEdit={() => router.push({ pathname: pubItem.kind === 'recipe' ? '/create/recipe' : '/create/article', params: { id: pubItem.item.id } })}
              onDelete={() =>
                ask(
                  f(t.me.deleteConfirm, { title: pubItem.item.title }),
                  () =>
                    remove.mutate(
                      { kind: pubItem.kind, id: pubItem.item.id },
                      {
                        onSuccess: () => {
                          haptic.medium();
                          removeMedia('community-media', pubItem.kind === 'recipe' ? pubItem.item.imagePath : pubItem.item.coverPath);
                          showToast(t.me.deleted, 'success');
                        },
                        onError: (e) => showToast(errorMessage(e, t), 'error'),
                      },
                    ),
                  t.common.delete,
                  t.common.cancel,
                )
              }
            />
          ))}
          <Row gap={space.xs}>
            <Button title={t.me.createRecipe} icon="plus" variant="soft" size="md" style={{ flex: 1 }} onPress={() => router.push('/create/recipe')} />
            <Button title={t.me.writeArticle} icon="article" variant="soft" size="md" style={{ flex: 1 }} onPress={() => router.push('/create/article')} />
          </Row>
        </View>
      )}

      <SectionHeader title={t.me.achievements} />
      {game.data && game.data.enabled !== false ? (
        <Card style={{ paddingVertical: space.lg }}>
          <AchievementGrid ids={ACHIEVEMENT_IDS} earned={earned} progress={{ ...game.data.counts, longestStreak: game.data.streak.longest }} />
        </Card>
      ) : game.data ? (
        <Notice tone="info" text={t.me.achievementsOff} />
      ) : null}
    </>
  );
}

function PublicationCard({ pub, onEdit, onDelete }: { pub: Publication; onEdit?: () => void; onDelete?: () => void }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const footer =
    onEdit || onDelete || pub.item.reviewNote ? (
      <View style={{ gap: 6, marginTop: 6 }}>
        {pub.item.status === 'rejected' && pub.item.reviewNote ? (
          <Text variant="caption" style={{ color: p.errorText }}>
            {f(t.publish.reviewNote, { note: pub.item.reviewNote })}
          </Text>
        ) : null}
        {onEdit || onDelete ? (
          <Row style={{ justifyContent: 'flex-end' }} gap={space.xs}>
            {onEdit ? <IconButton icon="edit" tone="soft" size={36} label={`${t.publish.edit}: ${pub.item.title}`} onPress={onEdit} /> : null}
            {onDelete ? <IconButton icon="trash" tone="clear" size={36} label={`${t.common.delete}: ${pub.item.title}`} onPress={onDelete} /> : null}
          </Row>
        ) : null}
      </View>
    ) : undefined;
  const badge = <PublicationStatusPill status={pub.item.status} />;
  if (pub.kind === 'recipe') {
    const r = pub.item;
    const n = r.ingredients.length ? communityRecipeNutrition(r) : null;
    const meta = [
      t.me.recipe,
      r.minutes ? f(t.recipes.minutes, { value: r.minutes }) : null,
      n?.perServing.energy_kcal != null ? `${formatNumber(n.perServing.energy_kcal, locale)} kcal` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return <RecipeCardView title={r.title} imageUri={mediaUrl('community-media', r.imagePath)} meta={meta} badge={badge} footer={footer} width="100%" onPress={onEdit ?? (() => undefined)} />;
  }
  const a = pub.item;
  return <ArticleCard title={a.title} excerpt={a.body.slice(0, 140) || null} coverUri={mediaUrl('community-media', a.coverPath)} badge={badge} footer={footer} onPress={onEdit ?? (() => undefined)} />;
}

/* ------------------------------------------------------------------ public */

function PublicView({ publications }: { publications: Publication[] }) {
  const { t } = useT();
  const p = usePalette();
  const { userId } = useSession();
  const pub = usePublicProfile();
  const save = useSavePublicProfile();
  const show = pub.data?.showAchievements === true;
  const achievements = usePublicAchievements(userId, show);
  const published = publications.filter((x) => x.item.status === 'published');
  const empty = !pub.data?.displayName && !pub.data?.username && !pub.data?.bio && !pub.data?.avatarPath;

  return (
    <>
      <SectionHeader title={t.me.publicTitle} />
      <Card style={{ alignItems: 'center', gap: 6, paddingVertical: space.lg }}>
        {empty ? (
          <Text variant="secondary" color="textSecondary" align="center">
            {t.me.publicEmpty}
          </Text>
        ) : (
          <>
            <Avatar path={pub.data?.avatarPath} name={pub.data?.displayName} size={84} />
            {pub.data?.displayName ? <Text variant="cardTitle">{pub.data.displayName}</Text> : null}
            {pub.data?.username ? (
              <Text variant="secondaryStrong" color="textSecondary">
                @{pub.data.username}
              </Text>
            ) : null}
            {pub.data?.bio ? (
              <Text variant="secondary" color="textSecondary" align="center">
                {pub.data.bio}
              </Text>
            ) : null}
          </>
        )}
        {show && (achievements.data ?? []).length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs, marginTop: space.sm }}>
            {(achievements.data ?? []).map((a) => (
              <AchievementBadge key={a.achievement} id={a.achievement as AchievementId} earned size={48} />
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: space.sm, paddingVertical: space.xs }}>
        <Row gap={space.sm} style={{ paddingVertical: space.xs }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t.me.showAchievements}</Text>
            <Text variant="caption" color="textSecondary">
              {t.me.showAchievementsHint}
            </Text>
          </View>
          <Switch
            value={show}
            disabled={save.isPending}
            onValueChange={(v) => save.mutate({ showAchievements: v })}
            trackColor={{ true: p.primary, false: p.borderStrong }}
            accessibilityLabel={t.me.showAchievements}
          />
        </Row>
      </Card>

      <SectionHeader title={t.me.publications} />
      {published.length ? (
        <View style={{ gap: space.sm }}>
          {published.map((x) => (
            <PublicationCard key={`${x.kind}:${x.item.id}`} pub={x} />
          ))}
        </View>
      ) : (
        <Text variant="secondary" color="textSecondary">
          {t.me.publicContentEmpty}
        </Text>
      )}

      <Row gap={space.xs} style={{ marginTop: space.lg, alignItems: 'flex-start' }}>
        <Icon name="lock" size={16} color={p.textTertiary} />
        <Text variant="caption" color="textTertiary" style={{ flex: 1 }}>
          {t.me.publicNote}
        </Text>
      </Row>
    </>
  );
}

/* --------------------------------------------------------------- editors */

const USERNAME = /^[a-z0-9_]{3,24}$/;

function ProfileEditor({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { userId } = useSession();
  const pub = usePublicProfile();
  const profile = useProfile();
  const save = useSavePublicProfile();
  const [name, setName] = useState(pub.data?.displayName ?? profile.data?.displayName ?? '');
  const [username, setUsername] = useState(pub.data?.username ?? '');
  const [bio, setBio] = useState(pub.data?.bio ?? '');
  const [avatarPath, setAvatarPath] = useState<string | null>(pub.data?.avatarPath ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = username.trim().replace(/^@/, '').toLowerCase();

  const changePhoto = async () => {
    if (!userId) return;
    setError(null);
    setUploading(true);
    try {
      const path = await pickAndUpload('avatars', userId, { square: true, maxSide: 720 });
      if (path) setAvatarPath(path);
    } catch {
      setError(t.publish.uploadError);
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    if (handle && !USERNAME.test(handle)) {
      setError(t.me.usernameInvalid);
      return;
    }
    const previous = pub.data?.avatarPath ?? null;
    try {
      await save.mutateAsync({ displayName: name, username: handle || null, bio, avatarPath });
      if (userId && name.trim()) await updateProfile(supabase(), userId, { displayName: name.trim() });
      if (previous && previous !== avatarPath) removeMedia('avatars', previous);
      await profile.refetch();
      haptic.success();
      onDone();
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === '23505' ? t.me.usernameTaken : errorMessage(e, t));
    }
  };

  return (
    <View style={{ gap: space.md }}>
      <Row gap={space.md}>
        <Avatar path={avatarPath} name={name} size={84} />
        <View style={{ flex: 1, gap: space.xs }}>
          <Button title={t.me.changePhoto} icon="camera" variant="soft" size="md" loading={uploading} onPress={changePhoto} />
          {avatarPath ? <Button title={t.me.removePhoto} variant="ghost" size="md" onPress={() => setAvatarPath(null)} /> : null}
        </View>
      </Row>
      <Field label={t.me.name} value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
      <Field label={t.me.username} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} placeholder="tu_usuario" />
      <Text variant="caption" color="textTertiary" style={{ marginTop: -space.sm }}>
        {t.me.usernameHint}
      </Text>
      <Field label={t.me.bio} value={bio} onChangeText={setBio} multiline maxLength={280} style={{ minHeight: 84, textAlignVertical: 'top' }} />
      <Notice tone="info" icon="eye" text={t.me.photoPublic} />
      {error ? <Notice tone="error" text={error} /> : null}
      <Button title={t.common.save} onPress={onSave} loading={save.isPending} disabled={uploading} />
    </View>
  );
}

const RANGES = { age: [14, 100], height: [120, 230], weight: [30, 300] } as const;

function PersonalFieldEditor({ field, onDone }: { field: FieldKey; onDone: () => void }) {
  const { t, f, locale } = useT();
  const profile = useProfile();
  const health = useHealthProfile();
  const target = useTarget(today());
  const update = useUpdatePersonal();
  const year = Number(today().slice(0, 4));
  const h = health.data;
  const initial =
    field === 'age' ? (h?.birthYear ? String(year - h.birthYear) : '') : field === 'height' ? (h?.heightCm ? String(h.heightCm) : '') : field === 'weight' ? (h?.weightKg ? formatNumber(h.weightKg, locale, 1) : '') : '';
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    haptic.success();
    if (target.data?.method !== 'user_defined') showToast(t.me.targetUpdated, 'success');
    onDone();
  };
  const run = (v: Parameters<typeof update.mutate>[0]) =>
    update.mutate(v, { onSuccess: done, onError: (e) => setError(errorMessage(e, t)) });

  if (field === 'goal') {
    const goals = profile.data?.goals ?? [];
    return (
      <View style={{ gap: space.xs }}>
        {GOALS.map((g: Goal) => (
          <Choice key={g} label={t.goals[g]} selected={profile.data?.primaryGoal === g} onPress={() => run({ goal: g, goals })} />
        ))}
        {error ? <Notice tone="error" text={error} /> : null}
      </View>
    );
  }
  if (field === 'sex') {
    return (
      <View style={{ gap: space.xs }}>
        {(['female', 'male', 'unspecified'] as const).map((s) => (
          <Choice key={s} label={t.sex[s]} selected={h?.sex === s} onPress={() => run({ health: { sex: s } })} />
        ))}
        {error ? <Notice tone="error" text={error} /> : null}
      </View>
    );
  }
  if (field === 'activity') {
    return (
      <View style={{ gap: space.xs }}>
        {ACTIVITY_LEVELS.map((a) => (
          <Choice key={a} label={t.activity[a]} hint={t.activity[`${a}Hint`]} selected={h?.activity === a} onPress={() => run({ health: { activity: a } })} />
        ))}
        {error ? <Notice tone="error" text={error} /> : null}
      </View>
    );
  }

  const [min, max] = RANGES[field];
  const value = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(value) && value >= min && value <= max;
  const suffix = field === 'age' ? undefined : field === 'height' ? 'cm' : 'kg';
  return (
    <View style={{ gap: space.md }}>
      <Field
        label={t.me.fields[field]}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setError(null);
        }}
        keyboardType={field === 'weight' ? 'decimal-pad' : 'number-pad'}
        suffix={suffix}
        autoFocus
      />
      {text.trim() && !valid ? <Notice tone="warning" text={f(t.me.invalid, { min, max })} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}
      <Button
        title={t.common.save}
        disabled={!valid}
        loading={update.isPending}
        onPress={() =>
          run({
            health:
              field === 'age'
                ? { birthYear: year - Math.round(value) }
                : field === 'height'
                  ? { heightCm: Math.round(value) }
                  : { weightKg: Math.round(value * 10) / 10 },
          })
        }
      />
    </View>
  );
}
