import { Image } from 'expo-image';
import { router } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { FudyuCharacter } from './art';
import { Icon } from './icons';
import { Button, IconButton, PressableScale, Row, Text } from './ui';
import { mediaUrl } from '@/lib/community';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

export function EditorHeader({ title }: { title: string }) {
  const { t } = useT();
  return (
    <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
      <Text variant="title" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
    </Row>
  );
}

/** Photo slot of an editor: the author's own image, or a prompt to add one. */
export function ImageSlot({ path, label, busy, onPick, height = 180 }: { path: string | null; label: string; busy: boolean; onPick: () => void; height?: number }) {
  const p = usePalette();
  const { t } = useT();
  const uri = mediaUrl('community-media', path);
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={uri ? t.publish.changePhoto : t.publish.addPhoto}
      onPress={onPick}
      disabled={busy}
      style={{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: p.surfaceMuted, alignItems: 'center', justifyContent: 'center', borderWidth: uri ? 0 : 1.5, borderStyle: 'dashed', borderColor: p.borderStrong }}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} contentFit="cover" transition={200} />
          <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,15,30,0.62)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Icon name="camera" size={15} color="#FFFFFF" />
            <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
              {t.publish.changePhoto}
            </Text>
          </View>
        </>
      ) : (
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Icon name={busy ? 'refresh' : 'image'} size={26} color={p.textSecondary} />
          <Text variant="secondaryStrong" color="textSecondary">
            {label}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

/** Result after sending to review: clear that it is NOT published yet. */
export function SentForReview() {
  const { t } = useT();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xxl }}>
      <Animated.View entering={ZoomIn.duration(motion.base)}>
        <FudyuCharacter expression="celebrate" size={112} />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(motion.base).delay(120)} style={{ alignItems: 'center', gap: space.xs }}>
        <Text variant="title" align="center" accessibilityRole="header">
          {t.publish.sentTitle}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 320 }}>
          {t.publish.sentBody}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(motion.base).delay(220)} style={{ alignSelf: 'stretch', marginTop: space.md, gap: space.xs }}>
        <Button
          title={t.publish.backToProfile}
          onPress={() => {
            router.back();
            router.navigate('/profile');
          }}
        />
        <Button title={t.common.close} variant="ghost" onPress={() => router.back()} />
      </Animated.View>
    </View>
  );
}
