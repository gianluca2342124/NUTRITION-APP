import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ARTICLE_MIN_BODY, saveCommunityArticle, type CommunityArticle } from '@repo/data';
import { motion } from '@repo/design';
import { EditorHeader, ImageSlot, SentForReview } from '@/components/publish';
import { Button, Field, Notice, Screen, SegmentedControl, Skeleton, Text, haptic } from '@/components/ui';
import { mediaUrl, pickAndUpload, removeMedia, useCommunityArticle } from '@/lib/community';
import { errorMessage } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { showToast } from '@/lib/stores';
import { supabase } from '@/lib/supabase';
import { radius, space } from '@/lib/theme';

/** Article editor: text with sources, preview, drafts, and review before publishing. */
export default function ArticleEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useCommunityArticle(id);
  const { t } = useT();
  if (id && existing.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EditorHeader title={t.publish.articleEdit} />
        <Skeleton height={180} style={{ marginTop: space.md }} />
      </Screen>
    );
  }
  return <ArticleEditor key={existing.data?.id ?? 'new'} initial={existing.data ?? null} />;
}

function ArticleEditor({ initial }: { initial: CommunityArticle | null }) {
  const { t, f } = useT();
  const qc = useQueryClient();
  const { userId } = useSession();
  const [id] = useState(() => initial?.id ?? uuid());
  const [title, setTitle] = useState(initial?.title ?? '');
  const [coverPath, setCoverPath] = useState<string | null>(initial?.coverPath ?? null);
  const [body, setBody] = useState(initial?.body ?? '');
  const [sources, setSources] = useState((initial?.sources ?? []).join('\n'));
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const sourceList = sources.split('\n').map((s) => s.trim()).filter(Boolean);
  const paragraphs = body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const missing = [
    title.trim().length < 3 ? t.publish.needTitle : null,
    body.trim().length < ARTICLE_MIN_BODY ? f(t.publish.needBody, { min: ARTICLE_MIN_BODY }) : null,
    sourceList.length === 0 ? t.publish.needSources : null,
  ].filter((x): x is string => !!x);

  const addCover = async () => {
    if (!userId) return;
    setUploading(true);
    setError(null);
    try {
      const path = await pickAndUpload('community-media', userId);
      if (path) {
        if (coverPath && coverPath !== initial?.coverPath) removeMedia('community-media', coverPath);
        setCoverPath(path);
      }
    } catch {
      setError(t.publish.uploadError);
    } finally {
      setUploading(false);
    }
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
      await saveCommunityArticle(supabase(), { id, title, coverPath, body, sources: sourceList }, submit);
      await Promise.all([qc.invalidateQueries({ queryKey: ['my-articles'] }), qc.invalidateQueries({ queryKey: ['community-article', id] })]);
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

  const cover = mediaUrl('community-media', coverPath);
  return (
    <Screen edges={['top', 'bottom']} bottomInset={48}>
      <EditorHeader title={initial ? t.publish.articleEdit : t.publish.articleNew} />
      {initial?.status === 'published' ? <Notice tone="info" text={t.publish.editPublishedNote} /> : null}
      {initial?.status === 'rejected' && initial.reviewNote ? <Notice tone="warning" text={f(t.publish.reviewNote, { note: initial.reviewNote })} /> : null}

      <View style={{ marginTop: space.md }}>
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'edit', label: t.publish.edit },
            { value: 'preview', label: t.publish.preview },
          ]}
        />
      </View>

      {mode === 'edit' ? (
        <Animated.View entering={FadeIn.duration(motion.micro)} style={{ gap: space.md, marginTop: space.md }}>
          <ImageSlot path={coverPath} label={t.publish.cover} busy={uploading} onPick={addCover} height={160} />
          <Field label={t.publish.title} value={title} onChangeText={setTitle} maxLength={120} />
          <View style={{ gap: 4 }}>
            <Field label={t.publish.body} value={body} onChangeText={setBody} multiline maxLength={20000} style={{ minHeight: 220, textAlignVertical: 'top' }} />
            <Text variant="caption" color="textTertiary">
              {t.publish.bodyHint} · {f(t.publish.characters, { count: body.trim().length })}
            </Text>
          </View>
          <View style={{ gap: 4 }}>
            <Field label={t.publish.sources} value={sources} onChangeText={setSources} multiline style={{ minHeight: 96, textAlignVertical: 'top' }} autoCapitalize="none" />
            <Text variant="caption" color="textTertiary">
              {t.publish.sourcesHint}
            </Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn.duration(motion.micro)} style={{ gap: space.sm, marginTop: space.md }}>
          {cover ? <Image source={{ uri: cover }} style={{ width: '100%', height: 190, borderRadius: radius.lg }} contentFit="cover" /> : null}
          <Text variant="title">{title.trim() || '—'}</Text>
          <Text variant="caption" color="textTertiary">
            {t.publish.byYou} · {t.me.status[initial?.status ?? 'draft']}
          </Text>
          {paragraphs.map((para, i) => (
            <Text key={i} variant="body">
              {para}
            </Text>
          ))}
          {sourceList.length ? (
            <View style={{ gap: 4, marginTop: space.sm }}>
              <Text variant="section">{t.publish.sources}</Text>
              {sourceList.map((s, i) => (
                <Text key={i} variant="secondary" color="textSecondary">
                  {i + 1}. {s}
                </Text>
              ))}
            </View>
          ) : null}
        </Animated.View>
      )}

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
    </Screen>
  );
}
