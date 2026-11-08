import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ACHIEVEMENT_IDS, ACTIVITY_LEVELS, GOALS, formatNumber, type AchievementId, type Goal } from '@repo/core';
import { communityRecipeNutrition, type CommunityArticle, type CommunityRecipe } from '@repo/data';
import { AchievementBadge, AchievementGrid } from '@/components/achievements';
import { FudyuCharacter } from '@/components/art';
import { Avatar, MyAvatar } from '@/components/avatar';
import { PublicationStatusPill } from '@/components/cards';
import { FoodImage } from '@/components/food-image';
import { Icon } from '@/components/icons';
import { BottomSheet } from '@/components/sheet';
import { Button, Card, Choice, Field, IconButton, Notice, PressableScale, Row, Screen, Text, haptic } from '@/components/ui';
import {
  pickAndUpload,
  removeMedia,
  useDeletePublication,
  useMediaUrl,
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
import { radius, shadow, space, usePalette } from '@/lib/theme';
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
 * Perfil: the person first (photo, name, @usuario, bio), then what they
 * publish and earn. Private data sits below in compact cards. The profile is
 * private until the person makes it public; "Cómo te ven los demás" shows
 * exactly what others would see.
 */
export default function ProfileTab() {
  const { t } = useT();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const pub = usePublicProfile();
  const profile = useProfile();
  const game = useGamification();
  const recipes = useMyRecipes();
  const articles = useMyArticles();
  const [sheet, setSheet] = useState<'edit' | 'public' | 'achievements' | null>(null);
  const [field, setField] = useState<FieldKey | null>(null);

  const name = pub.data?.displayName ?? profile.data?.displayName ?? null;
  const isPublic = pub.data?.isPublic === true;
  const publications = useMemo<Publication[]>(
    () =>
      [
        ...(recipes.data ?? []).map((item) => ({ kind: 'recipe' as const, item })),
        ...(articles.data ?? []).map((item) => ({ kind: 'article' as const, item })),
      ].sort((a, b) => b.item.updatedAt.localeCompare(a.item.updatedAt)),
    [recipes.data, articles.data],
  );
  const gamification = game.data?.enabled !== false;
  const earned = game.data?.achievements ?? [];

  return (
    <Screen tabBar padded={false} edges={[]}>
      {/* Cover band (behind the status bar) + identity */}
      <View style={{ height: insets.top + 112, marginBottom: -56 }}>
        <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={p.primary} stopOpacity={0.95} />
              <Stop offset="1" stopColor={p.primaryTint} stopOpacity={0.9} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#cover)" />
        </Svg>
        <Row style={{ justifyContent: 'flex-end', paddingTop: insets.top + space.xs, paddingHorizontal: space.md }}>
          <IconButton icon="settings" label={t.me.settings} onPress={() => router.push('/settings')} />
        </Row>
      </View>

      <View style={{ paddingHorizontal: space.md, alignItems: 'center', gap: 6 }}>
        <View style={[{ borderRadius: 60, borderWidth: 4, borderColor: p.background }, shadow(p, 'card')]}>
          <MyAvatar size={104} />
        </View>
        <Text variant="title" align="center" style={{ marginTop: 4 }} numberOfLines={2}>
          {name ?? t.me.noName}
        </Text>
        <Row gap={space.xs}>
          {pub.data?.username ? (
            <Text variant="secondaryStrong" color="textSecondary">
              @{pub.data.username}
            </Text>
          ) : null}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${isPublic ? t.me.public : t.me.private}. ${t.me.publicView}`}
            onPress={() => setSheet('public')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: isPublic ? p.secondarySoft : p.surfaceMuted }}
          >
            <Icon name={isPublic ? 'globe' : 'lock'} size={12} color={isPublic ? p.secondaryText : p.textSecondary} />
            <Text variant="micro" style={{ color: isPublic ? p.secondaryText : p.textSecondary }}>
              {isPublic ? t.me.public : t.me.private}
            </Text>
          </PressableScale>
        </Row>
        <Text variant="secondary" color={pub.data?.bio ? 'textSecondary' : 'textTertiary'} align="center" style={{ maxWidth: 320 }}>
          {pub.data?.bio ?? t.me.addBio}
        </Text>
        <Row gap={space.xs} style={{ marginTop: space.xs }}>
          <Button title={t.me.editProfile} icon="edit" variant="soft" size="md" onPress={() => setSheet('edit')} />
          <Button title={t.me.publicView} icon="eye" variant="ghost" size="md" onPress={() => setSheet('public')} />
        </Row>

        {/* Small, honest numbers */}
        <Row style={{ alignSelf: 'stretch', marginTop: space.md, backgroundColor: p.surface, borderRadius: radius.lg, paddingVertical: space.sm }}>
          <Stat value={publications.length} label={t.me.statPublications} />
          <Stat value={gamification ? earned.length : null} label={t.me.statAchievements} />
          <Stat value={gamification ? (game.data?.streak.current ?? null) : null} label={t.me.statStreak} />
        </Row>
      </View>

      <View style={{ paddingHorizontal: space.md }}>
        <Publications publications={publications} />

        {/* Achievements: earned badges first; the full grid on demand */}
        <Row style={{ justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm }}>
          <Text variant="section">{t.me.achievements}</Text>
          {gamification && game.data ? (
            <Button title={t.me.seeAll} variant="ghost" size="md" onPress={() => setSheet('achievements')} />
          ) : null}
        </Row>
        {!game.data ? null : !gamification ? (
          <Notice tone="info" text={t.me.achievementsOff} />
        ) : earned.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
            {earned.map((a) => (
              <View key={a.id} style={{ width: 84, alignItems: 'center', gap: 4 }}>
                <AchievementBadge id={a.id} earned size={60} />
                <Text variant="micro" align="center" numberOfLines={2}>
                  {t.achievements.items[a.id].title}
                </Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text variant="secondary" color="textSecondary">
            {t.me.achievementsEmpty}
          </Text>
        )}

        <PersonalData onEditField={setField} />
      </View>

      <BottomSheet visible={sheet === 'edit'} onClose={() => setSheet(null)} title={t.me.editProfile}>
        {sheet === 'edit' ? <ProfileEditor onDone={() => setSheet(null)} /> : null}
      </BottomSheet>
      <BottomSheet visible={sheet === 'public'} onClose={() => setSheet(null)} title={t.me.publicView}>
        {sheet === 'public' ? <PublicView publications={publications} /> : null}
      </BottomSheet>
      <BottomSheet visible={sheet === 'achievements'} onClose={() => setSheet(null)} title={t.me.achievements}>
        {sheet === 'achievements' && game.data ? (
          <AchievementGrid
            ids={ACHIEVEMENT_IDS}
            earned={new Set(earned.map((a) => a.id))}
            progress={{ ...game.data.counts, longestStreak: game.data.streak.longest }}
          />
        ) : null}
      </BottomSheet>
      <BottomSheet visible={field != null} onClose={() => setField(null)} title={field ? t.me.fields[field] : ''}>
        {field ? <PersonalFieldEditor field={field} onDone={() => setField(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function Stat({ value, label }: { value: number | null; label: string }) {
  const { locale } = useT();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }} accessible accessibilityLabel={`${label}: ${value ?? '—'}`}>
      <Text variant="cardTitle" style={{ fontVariant: ['tabular-nums'] }}>
        {value == null ? '—' : formatNumber(value, locale)}
      </Text>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------ publications */

function Publications({ publications }: { publications: Publication[] }) {
  const { t, f } = useT();
  const p = usePalette();
  const remove = useDeletePublication();
  const onDelete = (pubItem: Publication) =>
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
    );

  return (
    <>
      <Text variant="section" style={{ marginTop: space.xl, marginBottom: space.sm }}>
        {t.me.publications}
      </Text>
      {publications.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.lg }}>
          <FudyuCharacter expression="smile" size={72} />
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm }}>
          <CreateTile icon="book" label={t.me.newRecipe} onPress={() => router.push('/create/recipe')} />
          <CreateTile icon="article" label={t.me.newArticle} onPress={() => router.push('/create/article')} />
          {publications.map((x) => (
            <PublicationTile
              key={`${x.kind}:${x.item.id}`}
              pub={x}
              onOpen={() => router.push({ pathname: x.kind === 'recipe' ? '/create/recipe' : '/create/article', params: { id: x.item.id } })}
              onDelete={() => onDelete(x)}
            />
          ))}
          {/* Keep the last row aligned */}
          {publications.length % 2 === 1 ? <View style={{ width: '48.5%' }} /> : null}
        </View>
      )}
      {publications.some((x) => x.item.status === 'rejected' && x.item.reviewNote) ? (
        <Text variant="caption" style={{ color: p.errorText, marginTop: space.xs }}>
          {publications
            .filter((x) => x.item.status === 'rejected' && x.item.reviewNote)
            .map((x) => `${x.item.title}: ${f(t.publish.reviewNote, { note: x.item.reviewNote! })}`)
            .join('\n')}
        </Text>
      ) : null}
    </>
  );
}

function CreateTile({ icon, label, onPress }: { icon: 'book' | 'article'; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: '48.5%', height: 76, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.borderStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
    >
      <Icon name={icon} size={18} color={p.primaryText} />
      <Text variant="secondaryStrong" style={{ color: p.primaryText }}>
        {label}
      </Text>
    </PressableScale>
  );
}

function PublicationTile({ pub, onOpen, onDelete }: { pub: Publication; onOpen?: () => void; onDelete?: () => void }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const path = pub.kind === 'recipe' ? pub.item.imagePath : pub.item.coverPath;
  const uri = useMediaUrl('community-media', path);
  let meta: string = pub.kind === 'recipe' ? t.me.recipe : t.me.article;
  if (pub.kind === 'recipe' && pub.item.ingredients.length) {
    const kcal = communityRecipeNutrition(pub.item).perServing.energy_kcal;
    meta = [pub.item.minutes ? f(t.recipes.minutes, { value: pub.item.minutes }) : null, kcal != null ? `${formatNumber(kcal, locale)} kcal` : null].filter(Boolean).join(' · ') || meta;
  }
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${pub.item.title}. ${t.me.status[pub.item.status]}`}
      onPress={onOpen}
      disabled={!onOpen}
      style={[{ width: '48.5%', borderRadius: radius.lg, backgroundColor: p.surface, overflow: 'hidden' }, shadow(p, 'card')]}
    >
      <View>
        {uri || pub.kind === 'recipe' ? (
          <FoodImage uri={uri} fallback="recipe" width="100%" height={112} radius={0} />
        ) : (
          <View style={{ height: 112, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="article" size={28} color={p.primaryText} />
          </View>
        )}
        <View style={{ position: 'absolute', top: 8, left: 8 }}>
          <PublicationStatusPill status={pub.item.status} />
        </View>
      </View>
      <View style={{ padding: space.sm, gap: 2 }}>
        <Text variant="secondaryStrong" numberOfLines={2}>
          {pub.item.title}
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="caption" color="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
            {meta}
          </Text>
          {onDelete ? <IconButton icon="trash" tone="clear" size={32} label={`${t.common.delete}: ${pub.item.title}`} onPress={onDelete} /> : null}
        </Row>
      </View>
    </PressableScale>
  );
}

/* ---------------------------------------------------------- personal data */

function PersonalData({ onEditField }: { onEditField: (f: FieldKey) => void }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const profile = useProfile();
  const consents = useConsents();
  const health = useHealthProfile();
  const record = useRecordConsent();
  const h = health.data;
  const year = Number(today().slice(0, 4));
  const consented = consents.data?.health_data === true;
  const cells: { key: FieldKey; value: string | null }[] = consented
    ? [
        { key: 'sex', value: h?.sex ? t.sex[h.sex] : null },
        { key: 'age', value: h?.birthYear ? f(t.me.ageValue, { value: year - h.birthYear }) : null },
        { key: 'height', value: h?.heightCm ? `${formatNumber(h.heightCm, locale)} cm` : null },
        { key: 'weight', value: h?.weightKg ? `${formatNumber(h.weightKg, locale, 1)} kg` : null },
        { key: 'activity', value: h?.activity ? t.activity[h.activity as keyof typeof t.activity] : null },
      ]
    : [];

  const cell = (key: FieldKey, value: string | null, width: `${number}%`) => (
    <PressableScale
      key={key}
      accessibilityRole="button"
      accessibilityLabel={`${f(t.me.editField, { field: t.me.fields[key] })}: ${value ?? t.me.notSet}`}
      onPress={() => {
        haptic.light();
        onEditField(key);
      }}
      style={{ width, backgroundColor: p.surface, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8, gap: 2 }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="micro" color="textTertiary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {t.me.fields[key]}
        </Text>
        <Icon name="edit" size={12} color={p.textTertiary} />
      </Row>
      <Text variant="secondaryStrong" numberOfLines={1} color={value ? 'ink' : 'textTertiary'}>
        {value ?? t.me.notSet}
      </Text>
    </PressableScale>
  );

  return (
    <>
      <Row style={{ marginTop: space.xl, marginBottom: 2 }} gap={6}>
        <Icon name="lock" size={14} color={p.textSecondary} />
        <Text variant="section">{t.me.yourData}</Text>
      </Row>
      <Text variant="caption" color="textTertiary" style={{ marginBottom: space.sm }}>
        {t.me.yourDataPrivate}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 }}>
        {cell('goal', profile.data ? t.goals[profile.data.primaryGoal] : null, '100%')}
        {cells.map((c) => cell(c.key, c.value, '32.4%'))}
        {cells.length % 3 === 2 ? <View style={{ width: '32.4%' }} /> : null}
      </View>
      {!consented && consents.data ? (
        <Card style={{ gap: space.xs, marginTop: space.sm }}>
          <Text variant="bodyStrong">{t.me.dataConsentTitle}</Text>
          <Text variant="caption" color="textSecondary">
            {t.me.dataConsentBody}
          </Text>
          <Button title={t.me.dataConsentAction} size="md" variant="soft" loading={record.isPending} onPress={() => record.mutate({ type: 'health_data', granted: true })} />
        </Card>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------ public view */

function PublicView({ publications }: { publications: Publication[] }) {
  const { t } = useT();
  const p = usePalette();
  const { userId } = useSession();
  const pub = usePublicProfile();
  const save = useSavePublicProfile();
  const isPublic = pub.data?.isPublic === true;
  const show = isPublic && pub.data?.showAchievements === true;
  const achievements = usePublicAchievements(userId, show);
  const published = publications.filter((x) => x.item.status === 'published');
  const empty = !pub.data?.displayName && !pub.data?.username && !pub.data?.bio && !pub.data?.avatarPath;

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.xs }}>
        <Row gap={space.sm}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t.me.publicSwitch}</Text>
            <Text variant="caption" color="textSecondary">
              {t.me.publicSwitchHint}
            </Text>
          </View>
          <Switch
            value={isPublic}
            disabled={save.isPending}
            onValueChange={(v) => {
              haptic.selection();
              save.mutate({ isPublic: v });
            }}
            trackColor={{ true: p.primary, false: p.borderStrong }}
            accessibilityLabel={t.me.publicSwitch}
          />
        </Row>
        <Row gap={space.sm} style={{ opacity: isPublic ? 1 : 0.45 }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">{t.me.showAchievements}</Text>
            <Text variant="caption" color="textSecondary">
              {t.me.showAchievementsHint}
            </Text>
          </View>
          <Switch
            value={pub.data?.showAchievements === true}
            disabled={!isPublic || save.isPending}
            onValueChange={(v) => save.mutate({ showAchievements: v })}
            trackColor={{ true: p.primary, false: p.borderStrong }}
            accessibilityLabel={t.me.showAchievements}
          />
        </Row>
      </Card>

      {!isPublic ? (
        <Notice tone="info" icon="lock" text={t.me.privateState} />
      ) : (
        <Card style={{ alignItems: 'center', gap: 6, paddingVertical: space.lg }}>
          {empty ? (
            <Text variant="secondary" color="textSecondary" align="center">
              {t.me.publicEmpty}
            </Text>
          ) : (
            <>
              <Avatar path={pub.data?.avatarPath} name={pub.data?.displayName} size={80} />
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
                <AchievementBadge key={a.achievement} id={a.achievement as AchievementId} earned size={44} />
              ))}
            </View>
          ) : null}
          <Text variant="caption" color="textTertiary" style={{ marginTop: space.sm }}>
            {published.length ? published.map((x) => x.item.title).join(' · ') : t.me.publicContentEmpty}
          </Text>
        </Card>
      )}

      <Row gap={space.xs} style={{ alignItems: 'flex-start' }}>
        <Icon name="lock" size={16} color={p.textTertiary} />
        <Text variant="caption" color="textTertiary" style={{ flex: 1 }}>
          {t.me.publicNote}
        </Text>
      </Row>
    </View>
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
      <Field label={t.me.username} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={25} />
      <Text variant="caption" color="textTertiary" style={{ marginTop: -space.sm }}>
        {t.me.usernameHint}
      </Text>
      <Field label={t.me.bio} value={bio} onChangeText={setBio} multiline maxLength={280} style={{ minHeight: 84, textAlignVertical: 'top' }} />
      <Notice tone="info" icon="lock" text={t.me.photoPublic} />
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
  const run = (v: Parameters<typeof update.mutate>[0]) => update.mutate(v, { onSuccess: done, onError: (e) => setError(errorMessage(e, t)) });

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
            health: field === 'age' ? { birthYear: year - Math.round(value) } : field === 'height' ? { heightCm: Math.round(value) } : { weightKg: Math.round(value * 10) / 10 },
          })
        }
      />
    </View>
  );
}
