import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { motion } from '@repo/design';
import { Icon, type IconName } from './icons';
import { BottomSheet } from './sheet';
import { PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { closeAddSheet, useAddSheetOpen } from '@/lib/stores';
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
  run: () => void;
}

/**
 * The "+" sheet: the three everyday ways to log come first and big; search,
 * labels and creation sit below in a quiet list. Every action is real.
 * (Typing label values by hand lives inside the label flow.)
 */
export function AddActionSheet() {
  const open = useAddSheetOpen();
  const { t } = useT();
  const p = usePalette();

  const go = (fn: () => void) => {
    haptic.light();
    closeAddSheet();
    // Let the sheet start closing before presenting the next screen (iOS modals).
    setTimeout(fn, Platform.OS === 'ios' ? 260 : 0);
  };

  const primary: Action[] = [
    { key: 'plate', icon: 'camera', label: t.addSheet.plate, run: () => router.push({ pathname: '/scan', params: { mode: 'food' } }) },
    { key: 'barcode', icon: 'barcode', label: t.addSheet.barcode, run: () => router.push({ pathname: '/scan', params: { mode: 'barcode' } }) },
    { key: 'voice', icon: 'mic', label: t.addSheet.voice, run: () => router.push('/voice') },
  ];
  const secondary: Action[] = [
    { key: 'search', icon: 'search', label: t.addSheet.search, run: openSearch },
    { key: 'label', icon: 'label', label: t.addSheet.label, run: () => router.push({ pathname: '/scan', params: { mode: 'label' } }) },
    { key: 'recipe', icon: 'book', label: t.addSheet.recipe, run: () => router.push('/create/recipe') },
    { key: 'article', icon: 'article', label: t.addSheet.article, run: () => router.push('/create/article') },
  ];

  return (
    <BottomSheet visible={open} onClose={closeAddSheet} title={t.addSheet.title}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {primary.map((a, i) => (
            <Animated.View key={a.key} entering={FadeInDown.duration(motion.micro).delay(40 + i * 35)} style={{ flex: 1 }}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={a.label}
                onPress={() => go(a.run)}
                style={{ height: 118, borderRadius: radius.lg, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 6 }}
              >
                <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={a.icon} size={26} color={p.onPrimary} strokeWidth={2.2} />
                </View>
                <Text variant="secondaryStrong" align="center" numberOfLines={2} style={{ color: p.primaryText }}>
                  {a.label}
                </Text>
              </PressableScale>
            </Animated.View>
          ))}
        </View>
        <Animated.View
          entering={FadeInDown.duration(motion.micro).delay(150)}
          style={{ borderRadius: radius.lg, backgroundColor: p.surfaceMuted, overflow: 'hidden' }}
        >
          {secondary.map((a, i) => (
            <PressableScale
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={() => go(a.run)}
              style={{
                minHeight: 54,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingHorizontal: space.md,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: p.border,
              }}
            >
              <Icon name={a.icon} size={20} color={p.textSecondary} />
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {a.label}
              </Text>
              <Icon name="chevronRight" size={16} color={p.textTertiary} />
            </PressableScale>
          ))}
        </Animated.View>
      </View>
    </BottomSheet>
  );
}
