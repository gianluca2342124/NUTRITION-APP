import { router } from 'expo-router';
import { Platform, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { Icon, type IconName } from './icons';
import { BottomSheet } from './sheet';
import { PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { closeAddSheet, labelStore, manualLabelDraft, useAddSheetOpen } from '@/lib/stores';
import { radius, space, usePalette } from '@/lib/theme';

let searchRequests = 0;
/** Opens Explore with the keyboard ready (a new value each time re-focuses it). */
function openSearch() {
  searchRequests += 1;
  router.navigate({ pathname: '/explore', params: { focus: String(searchRequests) } });
}

interface Action {
  key: string;
  icon: IconName;
  label: string;
  hint: string;
  run: () => void;
}

/**
 * The "+" sheet: every action is real and goes straight to its flow.
 * Planned features (lists, plans) are not shown until they exist.
 */
export function AddActionSheet() {
  const open = useAddSheetOpen();
  const { t } = useT();

  const go = (fn: () => void) => {
    haptic.light();
    closeAddSheet();
    // Let the sheet start closing before presenting the next screen (iOS modals).
    setTimeout(fn, Platform.OS === 'ios' ? 260 : 0);
  };

  const groups: { title: string; actions: Action[] }[] = [
    {
      title: t.addSheet.scan,
      actions: [
        { key: 'barcode', icon: 'barcode', label: t.addSheet.barcode, hint: t.addSheet.barcodeHint, run: () => router.push({ pathname: '/scan', params: { mode: 'barcode' } }) },
        { key: 'plate', icon: 'camera', label: t.addSheet.plate, hint: t.addSheet.plateHint, run: () => router.push({ pathname: '/scan', params: { mode: 'food' } }) },
        { key: 'label', icon: 'label', label: t.addSheet.label, hint: t.addSheet.labelHint, run: () => router.push({ pathname: '/scan', params: { mode: 'label' } }) },
      ],
    },
    {
      title: t.addSheet.log,
      actions: [
        { key: 'voice', icon: 'mic', label: t.addSheet.voice, hint: t.addSheet.voiceHint, run: () => router.push('/voice') },
        { key: 'search', icon: 'search', label: t.addSheet.search, hint: t.addSheet.searchHint, run: openSearch },
        {
          key: 'manual',
          icon: 'keyboard',
          label: t.addSheet.manual,
          hint: t.addSheet.manualHint,
          run: () => {
            labelStore.set({ draft: manualLabelDraft(), gtin: null, manual: true });
            router.push('/label');
          },
        },
      ],
    },
    {
      title: t.addSheet.create,
      actions: [
        { key: 'recipe', icon: 'book', label: t.addSheet.recipe, hint: t.addSheet.recipeHint, run: () => router.push('/create/recipe') },
        { key: 'article', icon: 'article', label: t.addSheet.article, hint: t.addSheet.articleHint, run: () => router.push('/create/article') },
      ],
    },
  ];

  return (
    <BottomSheet visible={open} onClose={closeAddSheet} title={t.addSheet.title}>
      <View style={{ gap: space.lg }}>
        {groups.map((g, gi) => (
          <View key={g.title} style={{ gap: space.xs }}>
            <Text variant="eyebrow" color="textSecondary">
              {g.title}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.xs }}>
              {g.actions.map((a, i) => (
                <ActionTile key={a.key} action={a} index={gi * 3 + i} onPress={() => go(a.run)} />
              ))}
              {g.actions.length < 3 ? <View style={{ flex: 3 - g.actions.length }} /> : null}
            </View>
          </View>
        ))}
      </View>
    </BottomSheet>
  );
}

function ActionTile({ action, index, onPress }: { action: Action; index: number; onPress: () => void }) {
  const p = usePalette();
  return (
    <Animated.View entering={FadeInDown.duration(motion.micro).delay(60 + index * 28)} style={{ flex: 1 }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={action.label}
        accessibilityHint={action.hint}
        onPress={onPress}
        style={{ minHeight: 112, borderRadius: radius.lg, backgroundColor: p.surfaceMuted, padding: space.sm, gap: 6 }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={action.icon} size={21} color={p.primaryText} strokeWidth={2.1} />
        </View>
        <Text variant="secondaryStrong" numberOfLines={2}>
          {action.label}
        </Text>
        <Text variant="caption" color="textSecondary" numberOfLines={2} style={{ fontSize: 11.5, lineHeight: 14 }}>
          {action.hint}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}
